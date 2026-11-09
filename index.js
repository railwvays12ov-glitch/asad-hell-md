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
import { BOT_NAME, AUTH_DIR, DEV_NUMBER } from './config.js';
import { store } from './lib/store.js';
import { buildCtx, toJid } from './lib/helpers.js';
import { commands } from './commands/index.js';
import { moderate, activityHook, mentionHook, handleParticipants } from './commands/group.js';
import { afkHook, randomEmoji } from './commands/general.js';

const MAX_CACHE = 500;
const msgCache = new Map(); // antidelete ke liye (message id -> info)
let alwaysTimer = null;
let activeSocket = null;
let activeState = null;
let lastPairRequestAt = 0;

const pairingPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${BOT_NAME} Pairing</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,sans-serif;background:#111827;color:#f9fafb}main{width:min(100%,430px);padding:28px;border:1px solid #374151;border-radius:20px;background:#1f2937;box-shadow:0 20px 60px #0006}h1{margin:0 0 8px;font-size:25px}p{color:#cbd5e1;line-height:1.5}label{display:block;margin:22px 0 8px;font-weight:700}input,button{width:100%;padding:13px 14px;border-radius:10px;font-size:16px}input{border:1px solid #64748b;background:#111827;color:white}button{margin-top:14px;border:0;background:#22c55e;color:#052e16;font-weight:800;cursor:pointer}button:disabled{opacity:.6;cursor:wait}#result{margin-top:20px;padding:16px;border-radius:12px;background:#0f172a;white-space:pre-wrap}.code{margin:10px 0;font-size:30px;letter-spacing:4px;color:#86efac;font-weight:900;text-align:center}small{color:#94a3b8}</style></head><body><main><h1>${BOT_NAME} WhatsApp Pairing</h1><p>Enter your WhatsApp number with country code, without <b>+</b> or spaces.</p><form id="form"><label for="number">WhatsApp number</label><input id="number" name="number" inputmode="numeric" placeholder="923001234567" minlength="8" maxlength="15" required/><button id="button">Get pairing code</button></form><div id="result"><small>After receiving the code: WhatsApp → Settings → Linked devices → Link a device → Link with phone number.</small></div></main><script>const form=document.getElementById('form'),button=document.getElementById('button'),result=document.getElementById('result');form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;result.textContent='Requesting pairing code…';try{const response=await fetch('/api/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({number:document.getElementById('number').value})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not get pairing code');result.innerHTML='<div>Pairing code:</div><div class="code">'+data.code+'</div><small>Enter this code in WhatsApp → Linked devices → Link with phone number.</small>'}catch(error){result.textContent=error.message}finally{button.disabled=false}});</script></body></html>`;

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// Railway public web page and pairing-code endpoint.
const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    if (req.url === '/health') return sendJson(res, 200, { ok: true, service: BOT_NAME });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(pairingPage);
  }
  if (req.method === 'POST' && req.url === '/api/pair') {
    const now = Date.now();
    if (now - lastPairRequestAt < 30000) return sendJson(res, 429, { error: 'Please wait 30 seconds before requesting another code.' });
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let number = '';
    try { number = String(JSON.parse(raw).number || '').replace(/\D/g, ''); } catch { return sendJson(res, 400, { error: 'Invalid request.' }); }
    if (!/^\d{8,15}$/.test(number)) return sendJson(res, 400, { error: 'Enter a valid number with country code, digits only.' });
    if (!activeSocket || !activeState) return sendJson(res, 503, { error: 'WhatsApp connection is still starting. Try again in a few seconds.' });
    if (activeState.creds.registered) return sendJson(res, 409, { error: 'This bot is already paired. Remove auth_info to pair a new number.' });
    try {
      lastPairRequestAt = now;
      const code = await activeSocket.requestPairingCode(number);
      return sendJson(res, 200, { ok: true, code });
    } catch (error) { return sendJson(res, 502, { error: `Pairing failed: ${error?.message || error}` }); }
  }
  sendJson(res, 404, { ok: false, error: 'Not found' });
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
  activeState = state;
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    markOnlineOnConnect: false,
  });
  activeSocket = sock;

  sock.ev.on('creds.update', saveCreds);

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
