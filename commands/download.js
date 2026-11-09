import { cmd } from '../lib/registry.js';
import { fetchJson, fetchBuffer } from '../lib/helpers.js';
import { DOWNLOADER_API } from '../config.js';

// API response mein se pehla media link dhoondhta hai
function findMediaUrl(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^https?:\/\//.test(v) && /url|link|download|media|video|audio/i.test(k)) return v;
  }
  for (const v of Object.values(obj)) {
    const found = findMediaUrl(v);
    if (found) return found;
  }
  return null;
}

async function downloadAndSend(ctx, kind) {
  const link = ctx.args[0];
  if (!link || !/^https?:\/\//.test(link)) {
    return ctx.reply(`Usage: ${ctx.prefix || '.'}${kind} <link>`);
  }
  await ctx.reply('⏳ Download ho raha hai...');
  const api = `${DOWNLOADER_API}?url=${encodeURIComponent(link)}&resolution=360`;
  const data = await fetchJson(api);
  const mediaUrl = findMediaUrl(data);
  if (!mediaUrl) return ctx.reply('❌ Media link nahi mila.');
  const buf = await fetchBuffer(mediaUrl);
  const isAudio = kind === 'play' || kind === 'song';
  if (isAudio) return ctx.send({ audio: buf, mimetype: 'audio/mpeg' });
  return ctx.send({ video: buf, caption: '✅ Downloaded' });
}

const DL = [
  { names: ['play', 'song'], desc: 'YouTube audio: play <link>' },
  { names: ['video', 'yt'], desc: 'YouTube video: video <link>' },
  { names: ['tt', 'tiktok'], desc: 'TikTok download: tt <link>' },
  { names: ['fb', 'facebook'], desc: 'Facebook download: fb <link>' },
  { names: ['ig', 'insta'], desc: 'Instagram download: ig <link>' },
  { names: ['tw', 'x'], desc: 'Twitter/X download: tw <link>' },
  { names: ['snap'], desc: 'Snapchat download: snap <link>' },
  { names: ['threads'], desc: 'Threads download: threads <link>' },
  { names: ['pin'], desc: 'Pinterest download: pin <link>' },
  { names: ['reddit'], desc: 'Reddit download: reddit <link>' },
];

for (const d of DL) {
  cmd(d.names, { desc: d.desc, cat: 'Download' }, (ctx) => downloadAndSend(ctx, d.names[0]));
}
