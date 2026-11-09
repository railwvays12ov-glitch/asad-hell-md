import { cmd } from '../lib/registry.js';
import { store } from '../lib/store.js';
import { num, toJid, resolveTarget, getMediaType, getGroupMeta } from '../lib/helpers.js';

const P = () => store.get('prefix');

// ---------- toggles (group ke andar on/off) ----------
const GROUP_TOGGLES = {
  antilink: 'Anti link (all links)',
  antilinkwhatsapp: 'Anti WhatsApp group link',
  antitag: 'Anti mass tag',
  antiflood: 'Anti flood (spam)',
  welcome: 'Welcome message',
  goodbye: 'Goodbye message',
  bw: 'Bad words filter',
  antivideo: 'Delete videos',
  antiaudio: 'Delete audio',
  antivoice: 'Delete voice notes',
  antipic: 'Delete pictures',
  antisticker: 'Delete stickers',
  autolock: 'Lock group (only admins chat)',
  mentionreply: 'Reply when bot is mentioned',
};

for (const [key, label] of Object.entries(GROUP_TOGGLES)) {
  cmd(key, { desc: `${label} on/off`, cat: 'Group', group: true, admin: true }, (ctx) => {
    const v = (ctx.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return ctx.reply(`Usage: ${P()}${key} on/off`);
    store.gset(ctx.jid, key, v === 'on');
    return ctx.reply(`✅ ${label}: ${v.toUpperCase()}`);
  });
}

cmd('slowmode', { desc: 'Slow mode: slowmode 10 (seconds), 0 = off', cat: 'Group', group: true, admin: true }, (ctx) => {
  const s = parseInt(ctx.args[0]);
  if (isNaN(s) || s < 0) return ctx.reply(`Usage: ${P()}slowmode 10  (0 = off)`);
  store.gset(ctx.jid, 'slowmode', s);
  return ctx.reply(s ? `🐢 Slow mode ${s}s` : '✅ Slow mode off');
});

cmd('setwelcome', { desc: 'Set welcome text ({user} = name)', cat: 'Group', group: true, admin: true }, (ctx) => {
  if (!ctx.query) return ctx.reply(`Usage: ${P()}setwelcome Welcome {user}!`);
  store.gset(ctx.jid, 'welcomeText', ctx.query);
  return ctx.reply('✅ Welcome text set.');
});

cmd('filterword', { desc: 'Banned words: filterword add/remove/list word', cat: 'Group', group: true, admin: true }, (ctx) => {
  const [action, ...rest] = ctx.args;
  const word = rest.join(' ').toLowerCase();
  const list = store.gget(ctx.jid, 'filterwords') || [];
  if (!action || action === 'list') return ctx.reply(list.length ? `🚫 Banned: ${list.join(', ')}` : 'Koi banned word nahi.');
  if (action === 'add' && word) {
    if (!list.includes(word)) list.push(word);
    store.gset(ctx.jid, 'filterwords', list);
    return ctx.reply(`✅ "${word}" banned.`);
  }
  if (action === 'remove' && word) {
    store.gset(ctx.jid, 'filterwords', list.filter((w) => w !== word));
    return ctx.reply(`✅ "${word}" removed.`);
  }
  return ctx.reply(`Usage: ${P()}filterword add/remove/list <word>`);
});

// ---------- group actions ----------
cmd('kick', { desc: 'Remove member (mention/reply)', cat: 'Group', group: true, admin: true }, async (ctx) => {
  if (!ctx.botAdmin) return ctx.reply('❌ Pehle mujhe group admin banayein.');
  const t = resolveTarget(ctx);
  if (!t) return ctx.reply('Usage: kick @user (mention ya reply karein)');
  await ctx.sock.groupParticipantsUpdate(ctx.jid, [t], 'remove');
  return ctx.reply('✅ Member removed.');
});

cmd('add', { desc: 'Add member: add 923001234567', cat: 'Group', group: true, admin: true }, async (ctx) => {
  if (!ctx.botAdmin) return ctx.reply('❌ Pehle mujhe group admin banayein.');
  const n = ctx.args[0];
  if (!n) return ctx.reply(`Usage: ${P()}add 923001234567`);
  await ctx.sock.groupParticipantsUpdate(ctx.jid, [toJid(n)], 'add');
  return ctx.reply('✅ Member add request bhej di.');
});

cmd('promote', { desc: 'Make admin', cat: 'Group', group: true, admin: true }, async (ctx) => {
  const t = resolveTarget(ctx);
  if (!t) return ctx.reply('Usage: promote @user');
  await ctx.sock.groupParticipantsUpdate(ctx.jid, [t], 'promote');
  return ctx.reply('✅ Promoted.');
});

cmd('demote', { desc: 'Remove admin', cat: 'Group', group: true, admin: true }, async (ctx) => {
  const t = resolveTarget(ctx);
  if (!t) return ctx.reply('Usage: demote @user');
  await ctx.sock.groupParticipantsUpdate(ctx.jid, [t], 'demote');
  return ctx.reply('✅ Demoted.');
});

cmd('tagall', { desc: 'Tag all members', cat: 'Group', group: true, admin: true }, async (ctx) => {
  const parts = ctx.groupMeta?.participants || [];
  const ids = parts.map((p) => p.id);
  const list = ids.map((id, i) => `${i + 1}. @${num(id)}`).join('\n');
  return ctx.send({ text: `📢 *${ctx.query || 'Attention everyone'}*\n\n${list}`, mentions: ids });
});

cmd('hidetag', { desc: 'Tag all silently: hidetag <text>', cat: 'Group', group: true, admin: true }, (ctx) => {
  const ids = (ctx.groupMeta?.participants || []).map((p) => p.id);
  return ctx.send({ text: ctx.query || '📢', mentions: ids });
});

cmd('group', { desc: 'group open / close', cat: 'Group', group: true, admin: true }, async (ctx) => {
  const v = (ctx.args[0] || '').toLowerCase();
  if (!ctx.botAdmin) return ctx.reply('❌ Pehle mujhe group admin banayein.');
  if (v === 'open') {
    await ctx.sock.groupSettingUpdate(ctx.jid, 'not_announcement');
    return ctx.reply('🔓 Group open: sab members message kar sakte hain.');
  }
  if (v === 'close') {
    await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement');
    return ctx.reply('🔒 Group close: sirf admins message kar sakte hain.');
  }
  return ctx.reply(`Usage: ${P()}group open/close`);
});

cmd('del', { desc: 'Delete replied message', cat: 'Group', group: true, admin: true }, async (ctx) => {
  if (!ctx.quoted) return ctx.reply('Usage: kisi message ko reply karke del likhein.');
  await ctx.sock.sendMessage(ctx.jid, { delete: ctx.quoted.key });
  return null;
});

cmd('groupinfo', { desc: 'Group details', cat: 'Group', group: true }, (ctx) => {
  const g = ctx.groupMeta;
  if (!g) return ctx.reply('❌ Group info nahi mili.');
  const admins = g.participants.filter((p) => p.admin).length;
  return ctx.reply(
    `👥 *${g.subject}*\n` +
      `🆔 ${g.id}\n` +
      `👤 Members: ${g.participants.length}\n` +
      `🛡️ Admins: ${admins}\n` +
      `📝 ${g.desc || 'No description'}`,
  );
});

cmd('admins', { desc: 'List admins', cat: 'Group', group: true }, (ctx) => {
  const admins = (ctx.groupMeta?.participants || []).filter((p) => p.admin).map((p) => p.id);
  const list = admins.map((id, i) => `${i + 1}. @${num(id)}`).join('\n') || 'No admins';
  return ctx.send({ text: `🛡️ *Admins*\n\n${list}`, mentions: admins });
});

cmd('grouplink', { desc: 'Group invite link', cat: 'Group', group: true, admin: true }, async (ctx) => {
  const code = await ctx.sock.groupInviteCode(ctx.jid);
  return ctx.reply(`🔗 https://chat.whatsapp.com/${code}`);
});

cmd('resetlink', { desc: 'Reset group invite link', cat: 'Group', group: true, admin: true }, async (ctx) => {
  if (!ctx.botAdmin) return ctx.reply('❌ Pehle mujhe group admin banayein.');
  const code = await ctx.sock.groupRevokeInvite(ctx.jid);
  return ctx.reply(`🔄 New link: https://chat.whatsapp.com/${code}`);
});

cmd('pp', { desc: 'Profile picture of user or group', cat: 'Group' }, async (ctx) => {
  const t = resolveTarget(ctx) || ctx.jid;
  const url = await ctx.sock.profilePictureUrl(t, 'image').catch(() => null);
  if (!url) return ctx.reply('❌ Profile picture nahi mili.');
  return ctx.send({ image: { url }, caption: `🖼️ @${num(t)}`, mentions: [t] });
});

cmd('number', { desc: 'Show user number', cat: 'Group' }, (ctx) => {
  const t = resolveTarget(ctx) || ctx.sender;
  return ctx.reply(`📱 ${num(t)}`);
});

const activity = new Map(); // groupJid -> Map(sender -> count)
cmd('activeusers', { desc: 'Most active members (since bot start)', cat: 'Group', group: true }, (ctx) => {
  const map = activity.get(ctx.jid);
  if (!map || !map.size) return ctx.reply('Abhi tak koi activity nahi.');
  const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const lines = top.map(([j, c], i) => `${i + 1}. @${num(j)} - ${c} msgs`).join('\n');
  return ctx.send({ text: `🏆 *Active users*\n\n${lines}`, mentions: top.map(([j]) => j) });
});

cmd('mentionreply', { desc: 'Reply when bot is mentioned', cat: 'Group', group: true, admin: true }, (ctx) => {
  const v = (ctx.args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(v)) return ctx.reply(`Usage: ${P()}mentionreply on/off`);
  store.gset(ctx.jid, 'mentionreply', v === 'on');
  return ctx.reply(`✅ Mention reply: ${v.toUpperCase()}`);
});

// ---------- hooks used by index.js ----------

const floodMap = new Map();
const slowMap = new Map();
const BAD_WORDS = ['madarchod', 'bhenchod', 'chutiya', 'fuck', 'bitch'];

// Non-admin messages par moderation. true return = message delete ho gaya.
export async function moderate(ctx) {
  if (!ctx.isGroup || ctx.isOwner || ctx.isAdmin) return false;
  const g = store.gall(ctx.jid);
  const body = (ctx.body || '').toLowerCase();

  const act = async (reason) => {
    if (!ctx.botAdmin) return false;
    await ctx.sock.sendMessage(ctx.jid, { delete: ctx.msg.key }).catch(() => {});
    await ctx.sock.sendMessage(ctx.jid, {
      text: `⚠️ @${ctx.senderNum} ${reason}`,
      mentions: [ctx.sender],
    }).catch(() => {});
    return true;
  };

  if (g.antilink && /(https?:\/\/|www\.|chat\.whatsapp\.com)/i.test(body)) return act('links allowed nahi hain.');
  if (g.antilinkwhatsapp && /chat\.whatsapp\.com/i.test(body)) return act('WhatsApp group links allowed nahi hain.');
  if (g.antitag && ctx.mentioned.length >= 5) return act('mass tagging allowed nahi hai.');

  const words = [...(g.filterwords || [])];
  if (g.bw) words.push(...BAD_WORDS);
  if (words.length && words.some((w) => body.includes(w))) return act('ye word allowed nahi hai.');

  const type = getMediaType(ctx.m);
  const mediaKey = { image: 'antipic', video: 'antivideo', audio: 'antiaudio', voice: 'antivoice', sticker: 'antisticker' }[type];
  if (mediaKey && g[mediaKey]) return act(`${type} allowed nahi hai.`);

  if (g.autolock) return act('group lock hai.');

  if (g.slowmode) {
    const k = ctx.jid + ctx.sender;
    const last = slowMap.get(k) || 0;
    if (Date.now() - last < g.slowmode * 1000) return act(`slow mode on hai, ${g.slowmode}s baad message karein.`);
    slowMap.set(k, Date.now());
  }

  if (g.antiflood) {
    const k = ctx.jid + ctx.sender;
    const now = Date.now();
    const arr = (floodMap.get(k) || []).filter((t) => now - t < 5000);
    arr.push(now);
    floodMap.set(k, arr);
    if (arr.length > 6) return act('flooding allowed nahi hai.');
  }
  return false;
}

// Group activity count
export function activityHook(ctx) {
  if (!ctx.isGroup) return;
  const map = activity.get(ctx.jid) || new Map();
  map.set(ctx.sender, (map.get(ctx.sender) || 0) + 1);
  activity.set(ctx.jid, map);
}

// Mention par reply
export async function mentionHook(ctx) {
  if (!ctx.isGroup || !store.gget(ctx.jid, 'mentionreply')) return;
  const botNum = num(ctx.sock.user?.id);
  if (ctx.mentioned.some((j) => num(j) === botNum)) {
    await ctx.reply(`👋 Hi @${ctx.senderNum}! Commands ke liye ${P()}menu likhein.`, { mentions: [ctx.sender] }).catch(() => {});
  }
}

// Welcome / goodbye (group-participants.update event)
export async function handleParticipants(sock, ev) {
  const { id, participants, action } = ev;
  if (!['add', 'remove'].includes(action)) return;
  if (action === 'add' && !store.gget(id, 'welcome')) return;
  if (action === 'remove' && !store.gget(id, 'goodbye')) return;
  const meta = await getGroupMeta(sock, id);
  for (const p of participants) {
    const tpl =
      action === 'add'
        ? store.gget(id, 'welcomeText') || 'Welcome {user} 👋 ' + (meta?.subject || '')
        : 'Goodbye {user} 👋';
    const text = tpl.replace('{user}', '@' + num(p));
    await sock.sendMessage(id, { text, mentions: [p] }).catch(() => {});
  }
}
