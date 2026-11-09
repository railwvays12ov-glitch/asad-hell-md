import fs from 'fs';
import { cmd, commands } from '../lib/registry.js';
import { store } from '../lib/store.js';
import { fetchBuffer, fetchText, toJid, num } from '../lib/helpers.js';
import {
  BOT_NAME, DEV_NAME, DEV_TG, DEV_TG_URL, CHANNEL_NAME, CHANNEL_LINK,
  SCREENSHOT_API_KEY, DP_PATH, TMP_DIR,
} from '../config.js';

const EMOJIS = ['😂', '🔥', '❤️', '👍', '😎', '🙏', '🤖', '💯'];
export const randomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

const uptime = () => {
  const s = Math.floor(process.uptime());
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
};

// ---------- MENU ----------
cmd(['menu', 'help'], { desc: 'Show all commands', cat: 'General' }, async (ctx) => {
  const p = store.get('prefix');
  const seen = new Set();
  const byCat = {};
  for (const entry of commands.values()) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    (byCat[entry.cat] ||= []).push(entry);
  }

  let text = `╭━━━〔 *${BOT_NAME}* 〕━━━╮\n`;
  text += `┇ 👤 User   : @${ctx.senderNum}\n`;
  text += `┇ ⏳ Uptime : ${uptime()}\n`;
  text += `┇ 🧠 Mode   : ${store.get('mode')}\n`;
  text += `┇ ✏️ Prefix : ${p}\n`;
  text += `╰━━━━━━━━━━━━━━━━━━━━╯\n`;

  for (const [catName, list] of Object.entries(byCat)) {
    text += `\n╭━━〔 *${catName}* 〕━━╮\n`;
    for (const e of list) {
      text += `┃ ▸ ${p}${e.name}${e.desc ? ` - ${e.desc}` : ''}\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━╯`;
  }
  text += `\n\n📢 Channel: ${CHANNEL_LINK}\n> ©️ ${BOT_NAME}`;

  if (fs.existsSync(DP_PATH)) {
    return ctx.send({ image: fs.readFileSync(DP_PATH), caption: text });
  }
  return ctx.reply(text);
});

cmd('ping', { desc: 'Check bot speed', cat: 'General' }, async (ctx) => {
  const t = Date.now();
  await ctx.reply('🏓 Pong!');
  return ctx.reply(`⚡ Speed: ${Date.now() - t}ms`);
});

cmd('id', { desc: 'Your number and chat ID', cat: 'General' }, (ctx) =>
  ctx.reply(`👤 Your number: ${ctx.senderNum}\n💬 Chat ID: ${ctx.jid}`),
);

cmd('time', { desc: 'Current Pakistan time', cat: 'General' }, (ctx) =>
  ctx.reply(`🕒 ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}`),
);

cmd('uptime', { desc: 'Bot uptime', cat: 'General' }, (ctx) => ctx.reply(`⏳ Uptime: ${uptime()}`));

cmd('dev', { desc: 'Developer contact', cat: 'General' }, (ctx) =>
  ctx.reply(
    `👨‍💻 *Developer:* ${DEV_NAME}\n` +
      `📩 *Telegram:* ${DEV_TG} (${DEV_TG_URL})\n` +
      `📢 *Channel:* ${CHANNEL_NAME}`,
  ),
);

cmd(['botlink', 'channel'], { desc: 'Official WhatsApp channel', cat: 'General' }, (ctx) =>
  ctx.reply(`📢 *${CHANNEL_NAME}*\nFollow karein: ${CHANNEL_LINK}`),
);

cmd('echo', { desc: 'Repeat your text', cat: 'General' }, (ctx) => {
  if (!ctx.query) return ctx.reply(`Usage: ${store.get('prefix')}echo <text>`);
  return ctx.reply(ctx.query);
});

cmd('calc', { desc: 'Calculator, e.g. calc 12*5+3', cat: 'General' }, (ctx) => {
  if (!ctx.query) return ctx.reply('Usage: calc 12*5+3');
  if (!/^[0-9+\-*/().%\s]+$/.test(ctx.query)) {
    return ctx.reply('❌ Sirf numbers aur + - * / % ( ) allowed hain.');
  }
  try {
    const result = Function(`"use strict"; return (${ctx.query});`)();
    return ctx.reply(`🧮 ${ctx.query} = ${result}`);
  } catch {
    return ctx.reply('❌ Invalid expression.');
  }
});

cmd('roll', { desc: 'Roll a dice (default 6)', cat: 'General' }, (ctx) => {
  const sides = Math.max(2, parseInt(ctx.args[0]) || 6);
  return ctx.reply(`🎲 You rolled: ${Math.floor(Math.random() * sides) + 1} (1-${sides})`);
});

cmd('flip', { desc: 'Coin flip', cat: 'General' }, (ctx) =>
  ctx.reply(`🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`),
);

cmd('poll', { desc: 'Poll: poll Question | opt1 | opt2', cat: 'General' }, (ctx) => {
  const parts = ctx.query.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return ctx.reply('Usage: poll Question | Option 1 | Option 2');
  return ctx.send({
    poll: { name: parts[0], values: parts.slice(1, 13), selectableCount: 1 },
  });
});

cmd('qrcode', { desc: 'Make QR code from text', cat: 'General' }, (ctx) => {
  if (!ctx.query) return ctx.reply('Usage: qrcode <text>');
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(ctx.query)}`;
  return ctx.send({ image: { url }, caption: '🔳 QR code' });
});

cmd('shorturl', { desc: 'Shorten a link', cat: 'General' }, async (ctx) => {
  const link = ctx.args[0];
  if (!link) return ctx.reply('Usage: shorturl https://example.com');
  const short = await fetchText('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(link));
  return ctx.reply(`🔗 ${short}`);
});

cmd('tr', { desc: 'Translate: tr <lang> <text>', cat: 'General' }, async (ctx) => {
  const lang = ctx.args[0];
  let text = ctx.args.slice(1).join(' ') || ctx.quoted?.message?.conversation || '';
  if (!lang || !text) return ctx.reply('Usage: tr urdu Hello how are you');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;
  const data = JSON.parse(await fetchText(url));
  const out = data[0].map((x) => x[0]).join('');
  return ctx.reply(`🌍 ${out}`);
});

cmd('weather', { desc: 'Weather of a city', cat: 'General' }, async (ctx) => {
  if (!ctx.query) return ctx.reply('Usage: weather Karachi');
  const url = `https://wttr.in/${encodeURIComponent(ctx.query)}?format=%l:+%C+%c+%t+(Feels+like+%f)\nWind:+%w\nHumidity:+%h`;
  return ctx.reply(`🌤️ ${(await fetchText(url)).trim()}`);
});

cmd('google', { desc: 'Google search link', cat: 'General' }, (ctx) => {
  if (!ctx.query) return ctx.reply('Usage: google <query>');
  return ctx.reply(`🔎 https://www.google.com/search?q=${encodeURIComponent(ctx.query)}`);
});

cmd('ss', { desc: 'Screenshot of a website', cat: 'General' }, async (ctx) => {
  const link = ctx.args[0];
  if (!link) return ctx.reply('Usage: ss https://example.com');
  if (!SCREENSHOT_API_KEY) return ctx.reply('❌ Owner ne SCREENSHOT_API_KEY set nahi ki.');
  const url = `https://api.screenshotmachine.com/?key=${SCREENSHOT_API_KEY}&device=phone&dimension=1290x2796&url=${encodeURIComponent(link)}`;
  return ctx.send({ image: { url }, caption: `📸 ${link}` });
});

cmd('img', { desc: 'AI image: img <prompt>', cat: 'General' }, (ctx) => {
  if (!ctx.query) return ctx.reply('Usage: img a cat in space');
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(ctx.query)}?width=1024&height=1024&nologo=true`;
  return ctx.send({ image: { url }, caption: `🎨 ${ctx.query}` });
});

cmd('tts', { desc: 'Text to speech: tts <lang> <text>', cat: 'General' }, async (ctx) => {
  const lang = ctx.args[0];
  const text = ctx.args.slice(1).join(' ');
  if (!lang || !text) return ctx.reply('Usage: tts ur Assalam o alaikum');
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;
  const buf = await fetchBuffer(url);
  return ctx.send({ audio: buf, mimetype: 'audio/mpeg', ptt: true });
});

cmd('reminder', { desc: 'Reminder: reminder 10m text', cat: 'General' }, (ctx) => {
  const [time, ...rest] = ctx.args;
  const text = rest.join(' ');
  const m = /^(\d+)(s|m|h)$/.exec(time || '');
  if (!m || !text) return ctx.reply('Usage: reminder 10m Namaz parho');
  const ms = Number(m[1]) * { s: 1000, m: 60000, h: 3600000 }[m[2]];
  setTimeout(() => ctx.reply(`⏰ Reminder: ${text}`).catch(() => {}), ms);
  return ctx.reply(`✅ Theek hai, ${time} baad yaad dila dunga.`);
});

cmd('afk', { desc: 'Away mode: afk <reason>', cat: 'General', group: false }, (ctx) => {
  const afk = store.get('afk') || {};
  afk[ctx.sender] = { reason: ctx.query || 'AFK', since: Date.now() };
  store.set('afk', afk);
  return ctx.reply(`💤 AFK set: ${afk[ctx.sender].reason}`);
});

// Har message par AFK check (index.js se call hota hai)
export async function afkHook(ctx) {
  const afk = store.get('afk') || {};
  if (afk[ctx.sender] && !ctx.body.toLowerCase().startsWith(store.get('prefix') + 'afk')) {
    delete afk[ctx.sender];
    store.set('afk', afk);
    await ctx.reply(`👋 Welcome back @${ctx.senderNum}`, { mentions: [ctx.sender] }).catch(() => {});
  }
  for (const j of ctx.mentioned) {
    const info = afk[j];
    if (info) {
      await ctx.reply(`💤 @${num(j)} abhi AFK hain.\nReason: ${info.reason}`, { mentions: [j] }).catch(() => {});
    }
  }
}

// Profile picture ko DP_PATH se bhi check karne ke liye (tmp dir create)
export function ensureTmp() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

export { toJid };
