// ============================================================
//  ASAD HELL MD - WhatsApp bot (Baileys)
// ============================================================
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { createServer } from 'node:http';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { BOT_NAME, PAIR_NUMBER, AUTH_DIR, DEV_NUMBER } from './config.js';
import { store } from './lib/store.js';
import { buildCtx, toJid } from './lib/helpers.js';
import { commands } from './commands/index.js';
import { moderate, activityHook, mentionHook, handleParticipants } from './commands/group.js';
import { afkHook, randomEmoji } from './commands/general.js';

const MAX_CACHE = 500;
const msgCache = new Map(); // antidelete ke liye (message id -> info)
let alwaysTimer = null;

// Railway health/public URL endpoint. The WhatsApp bot remains the main process.
const port = Number(process.env.PORT || 3000);
createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, service: 'Asad Hell MD' }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
}).listen(port, '0.0.0.0', () => console.log(`🌐 Health server listening on port ${port}`));

process.on('unhandledRejection', (e) => console.error('Unhandled:', e?.message || e));

function startAlwaysOnline(sock) {
  clearInterval(alwaysTimer);
  alwaysTimer = setInterval(() => {
    if (store.get('alwaysonline')) sock.sendPresenceUpdate('available').catch(() => {});
  }, 25000);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing code (PAIR_NUMBER set ho to). Railway jaisi hosting par QR ki jagah ye use karein.
  if (PAIR_NUMBER && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PAIR_NUMBER);
        console.log(`🔗 PAIRING CODE: ${code}`);
        console.log('WhatsApp > Linked devices > Link with phone number, ye code enter karein.');
      } catch (e) {
        console.error('Pairing code error:', e.message);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr && !PAIR_NUMBER) {
      console.log('WhatsApp > Linked devices > Link a device, ye QR scan karein:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log(`✅ ${BOT_NAME} connected`);
      startAlwaysOnline(sock);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Logged out. Session reset karke dobara pair karein.');
        return;
      }
      console.log('Connection band hua, reconnect ho raha hai...');
      setTimeout(startBot, 3000);
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    for (const msg of messages) {
      handleMessage(sock, msg, type).catch((e) => console.error('Handler error:', e?.message));
    }
  });

  sock.ev.on('group-participants.update', (ev) => {
    handleParticipants(sock, ev).catch(() => {});
  });

  sock.ev.on('call', (calls) => {
    if (!store.get('anticall')) return;
    for (const c of calls) {
      if (c.status === 'offer') sock.rejectCall(c.id, c.from).catch(() => {});
    }
  });
}

async function handleMessage(sock, msg, type) {
  if (!msg.message || !msg.key?.remoteJid) return;
  const jid = msg.key.remoteJid;

  // Status updates
  if (jid === 'status@broadcast') {
    if (store.get('autostatus')) await sock.readMessages([msg.key]).catch(() => {});
    if (store.get('statusreact') && !msg.key.fromMe) {
      await sock.sendMessage(
        'status@broadcast',
        { react: { text: randomEmoji(), key: msg.key } },
        { statusJidList: [msg.key.participant].filter(Boolean) },
      ).catch(() => {});
    }
    return;
  }

  // Deleted message detect (antidelete)
  const proto = msg.message.protocolMessage;
  if (proto && proto.type === 0) {
    if (store.get('antidelete')) {
      const orig = msgCache.get(proto.key?.id);
      if (orig) {
        await sock.sendMessage(toJid(DEV_NUMBER), {
          text: `🗑️ *Deleted message*\nFrom: @${orig.senderNum}\nChat: ${orig.jid}\n\n${orig.text}`,
          mentions: [orig.sender],
        }).catch(() => {});
      }
    }
    return;
  }

  if (type !== 'notify') return;

  const ctx = await buildCtx(sock, msg);
  const prefix = store.get('prefix');
  ctx.prefix = prefix;

  // Cache for antidelete
  if (ctx.body) {
    msgCache.set(msg.key.id, { jid, sender: ctx.sender, senderNum: ctx.senderNum, text: ctx.body });
    if (msgCache.size > MAX_CACHE) msgCache.delete(msgCache.keys().next().value);
  }

  if (!msg.key.fromMe) {
    if (store.get('autoread')) await sock.readMessages([msg.key]).catch(() => {});
    if (store.get('autoreact')) await ctx.react(randomEmoji()).catch(() => {});

    if ((store.get('blocked') || []).includes(ctx.sender)) return;

    activityHook(ctx);
    await afkHook(ctx);
    await mentionHook(ctx);

    const kw = ctx.body.trim().toLowerCase();
    const reactions = store.get('reactions') || {};
    if (kw && reactions[kw]) await ctx.react(reactions[kw]).catch(() => {});

    if (await moderate(ctx)) return;
  }

  if (!ctx.body.startsWith(prefix)) return;

  // Mode checks: public / private / inbox
  const mode = store.get('mode');
  if (!ctx.isOwner && mode !== 'public') return;
  if (mode === 'inbox' && ctx.isGroup) return;

  const [rawName, ...args] = ctx.body.slice(prefix.length).trim().split(/\s+/);
  const entry = commands.get((rawName || '').toLowerCase());
  if (!entry) return;

  ctx.args = args;
  ctx.query = args.join(' ');

  if (entry.owner && !ctx.isOwner) return ctx.reply('❌ Ye command sirf owner use kar sakta hai.');
  if (entry.group && !ctx.isGroup) return ctx.reply('❌ Ye command sirf group mein chalti hai.');
  if (entry.admin && !(ctx.isAdmin || ctx.isOwner)) return ctx.reply('❌ Ye command sirf group admins use kar sakte hain.');

  try {
    await entry.run(ctx);
  } catch (e) {
    console.error(`[${entry.name}] error:`, e);
    await ctx.reply(`❌ Error: ${String(e?.message || e).slice(0, 200)}`).catch(() => {});
  }
}

startBot().catch((e) => {
  console.error('Startup error:', e);
  process.exit(1);
});
