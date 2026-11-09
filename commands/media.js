import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { cmd } from '../lib/registry.js';
import { fetchBuffer, downloadBuffer, unwrapMessage } from '../lib/helpers.js';
import { TMP_DIR } from '../config.js';

fs.mkdirSync(TMP_DIR, { recursive: true });

// Quoted ya current message se media object nikalta hai
function mediaTarget(ctx) {
  if (ctx.quoted) return { key: ctx.quoted.key, message: ctx.quoted.message };
  return { key: ctx.msg.key, message: ctx.m };
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y', '-loglevel', 'error', ...args], (err) => (err ? reject(err) : resolve()));
  });
}

const tmpFile = (ext) => path.join(TMP_DIR, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);

function cleanup(...files) {
  for (const f of files) fs.rm(f, { force: true }, () => {});
}

// ---------- sticker ----------
cmd(['sticker', 's'], { desc: 'Image/video ko sticker banao (reply ya caption)', cat: 'Media' }, async (ctx) => {
  const t = mediaTarget(ctx);
  const type = Object.keys(t.message || {}).find((k) => /(imageMessage|videoMessage)$/.test(k));
  if (!type) return ctx.reply('Usage: image ya video ke caption/reply mein *.s* likhein.');
  const isVideo = type === 'videoMessage';
  const input = tmpFile(isVideo ? 'mp4' : 'jpg');
  const output = tmpFile('webp');
  try {
    fs.writeFileSync(input, await downloadBuffer(ctx.sock, t));
    const vf = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15';
    const args = ['-i', input, '-vf', vf, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '70', '-loop', '0', '-an'];
    if (isVideo) args.push('-t', '6');
    args.push(output);
    await ffmpeg(args);
    return ctx.send({ sticker: fs.readFileSync(output) });
  } catch (e) {
    return ctx.reply('❌ Sticker nahi bana. (ffmpeg installed hona chahiye)\n' + e.message);
  } finally {
    cleanup(input, output);
  }
});

// ---------- sticker -> image ----------
cmd('toimg', { desc: 'Sticker ko image banao (reply karein)', cat: 'Media' }, async (ctx) => {
  if (!ctx.quoted?.message?.stickerMessage) return ctx.reply('Kisi sticker ko reply karke *.toimg* likhein.');
  const input = tmpFile('webp');
  const output = tmpFile('png');
  try {
    fs.writeFileSync(input, await downloadBuffer(ctx.sock, mediaTarget(ctx)));
    await ffmpeg(['-i', input, output]);
    return ctx.send({ image: fs.readFileSync(output), caption: '🖼️ Converted' });
  } catch (e) {
    return ctx.reply('❌ Convert nahi ho saka. ' + e.message);
  } finally {
    cleanup(input, output);
  }
});

// ---------- audio -> voice note ----------
cmd('toptt', { desc: 'Audio ko voice note banao (reply karein)', cat: 'Media' }, async (ctx) => {
  const t = mediaTarget(ctx);
  if (!t.message?.audioMessage && !t.message?.videoMessage) return ctx.reply('Audio/video ko reply karke *.toptt* likhein.');
  const input = tmpFile('bin');
  const output = tmpFile('ogg');
  try {
    fs.writeFileSync(input, await downloadBuffer(ctx.sock, t));
    await ffmpeg(['-i', input, '-vn', '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1', output]);
    return ctx.send({ audio: fs.readFileSync(output), mimetype: 'audio/ogg; codecs=opus', ptt: true });
  } catch (e) {
    return ctx.reply('❌ Voice note nahi bana. ' + e.message);
  } finally {
    cleanup(input, output);
  }
});

// ---------- media -> public link ----------
cmd('tourl', { desc: 'Media ka public link (reply karein)', cat: 'Media' }, async (ctx) => {
  const t = mediaTarget(ctx);
  const type = Object.keys(t.message || {}).find((k) => /(imageMessage|videoMessage|audioMessage|documentMessage|stickerMessage)$/.test(k));
  if (!type) return ctx.reply('Kisi media ko reply karke *.tourl* likhein.');
  const buf = await downloadBuffer(ctx.sock, t);
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buf]), 'file');
  const r = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  const link = (await r.text()).trim();
  return ctx.reply(link.startsWith('http') ? `🔗 ${link}` : '❌ Upload fail hua.');
});

// ---------- view once ----------
cmd(['vv', 'vc'], { desc: 'View-once media dobara bhejo (reply karein)', cat: 'Media' }, async (ctx) => {
  if (!ctx.quoted) return ctx.reply('View-once message ko reply karke *.vv* likhein.');
  const inner = ctx.quoted.message || {};
  const type = Object.keys(inner).find((k) => /(imageMessage|videoMessage|audioMessage)$/.test(k));
  if (!type) return ctx.reply('❌ Ye media nahi hai.');
  const buf = await downloadBuffer(ctx.sock, { key: ctx.quoted.key, message: inner });
  const caption = inner[type].caption || '';
  if (type === 'imageMessage') return ctx.send({ image: buf, caption });
  if (type === 'videoMessage') return ctx.send({ video: buf, caption });
  return ctx.send({ audio: buf, mimetype: inner.audioMessage.mimetype || 'audio/mpeg' });
});

// ---------- fancy text ----------
const FANCY_BASE = {
  upper: 0x1d400, // 𝐀
  lower: 0x1d41a, // 𝐚
};

cmd('fancy', { desc: 'Fancy bold text: fancy hello', cat: 'Media' }, (ctx) => {
  if (!ctx.query) return ctx.reply('Usage: fancy Asad');
  const out = [...ctx.query]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(FANCY_BASE.upper + (c - 65));
      if (c >= 97 && c <= 122) return String.fromCodePoint(FANCY_BASE.lower + (c - 97));
      return ch;
    })
    .join('');
  return ctx.reply(out);
});

// ---------- emoji mix ----------
cmd('emojimix', { desc: 'Mix two emojis: emojimix 😂+🔥', cat: 'Media' }, async (ctx) => {
  const [a, b] = ctx.query.split('+').map((s) => s.trim());
  if (!a || !b) return ctx.reply('Usage: emojimix 😂+🔥');
  const url = `https://emojik.vercel.app/s/${encodeURIComponent(a)}_${encodeURIComponent(b)}?size=256`;
  const buf = await fetchBuffer(url);
  return ctx.send({ image: buf, caption: `😄 ${a} + ${b}` });
});
