import { cmd, commands } from '../lib/registry.js';
import { store } from '../lib/store.js';
import { toJid, num } from '../lib/helpers.js';
import { randomEmoji } from './general.js';

const onOff = (v) => ['on', 'off'].includes((v || '').toLowerCase());

// Global on/off toggle banane ka helper
function globalToggle(key, label, desc) {
  cmd(key, { desc, cat: 'Owner', owner: true }, (ctx) => {
    const v = ctx.args[0];
    if (!onOff(v)) return ctx.reply(`Usage: ${store.get('prefix')}${key} on/off`);
    store.set(key, v.toLowerCase() === 'on');
    return ctx.reply(`✅ ${label} ${v.toLowerCase() === 'on' ? 'ON' : 'OFF'}`);
  });
}

cmd('setprefix', { desc: 'Change prefix', cat: 'Owner', owner: true }, (ctx) => {
  const p = ctx.args[0];
  if (!p || p.length > 2) return ctx.reply('Usage: setprefix !  (max 2 characters)');
  store.set('prefix', p);
  return ctx.reply(`✅ Prefix set: ${p}`);
});

cmd('mode', { desc: 'public / private / inbox', cat: 'Owner', owner: true }, (ctx) => {
  const m = (ctx.args[0] || '').toLowerCase();
  if (!['public', 'private', 'inbox'].includes(m)) {
    return ctx.reply(`Current mode: *${store.get('mode')}*\nUsage: mode public | private | inbox`);
  }
  store.set('mode', m);
  return ctx.reply(`✅ Mode: *${m}*`);
});

cmd('stats', { desc: 'Bot statistics', cat: 'Owner', owner: true }, (ctx) => {
  const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const up = Math.floor(process.uptime());
  return ctx.reply(
    `📊 *Bot Stats*\n` +
      `⏳ Uptime: ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m\n` +
      `💾 RAM: ${mem} MB\n` +
      `🧠 Mode: ${store.get('mode')}\n` +
      `✏️ Prefix: ${store.get('prefix')}\n` +
      `🚫 Blocked: ${(store.get('blocked') || []).length}`,
  );
});

globalToggle('alwaysonline', 'Always online', 'Always online mode on/off');
globalToggle('autoread', 'Auto read', 'Auto read messages on/off');
globalToggle('autoreact', 'Auto react', 'Random reaction to messages on/off');
globalToggle('autostatus', 'Auto view status', 'Auto view status on/off');
globalToggle('statusreact', 'Status react', 'React to status on/off');
globalToggle('antidelete', 'Anti delete', 'Deleted messages owner ko bhejo on/off');
globalToggle('anticall', 'Anti call', 'Incoming calls reject on/off');

cmd('addreact', { desc: 'Keyword reaction: addreact hello 👋', cat: 'Owner', owner: true }, (ctx) => {
  const [keyword, emoji] = ctx.args;
  if (!keyword || !emoji) return ctx.reply('Usage: addreact <keyword> <emoji>');
  const r = store.get('reactions') || {};
  r[keyword.toLowerCase()] = emoji;
  store.set('reactions', r);
  return ctx.reply(`✅ "${keyword}" par ${emoji} react hoga.`);
});

cmd('removereact', { desc: 'Remove keyword reaction', cat: 'Owner', owner: true }, (ctx) => {
  const keyword = (ctx.args[0] || '').toLowerCase();
  const r = store.get('reactions') || {};
  if (!r[keyword]) return ctx.reply('❌ Ye keyword set nahi hai.');
  delete r[keyword];
  store.set('reactions', r);
  return ctx.reply(`🗑️ "${keyword}" reaction removed.`);
});

cmd('reactlist', { desc: 'List keyword reactions', cat: 'Owner', owner: true }, (ctx) => {
  const r = store.get('reactions') || {};
  const lines = Object.entries(r).map(([k, v]) => `• ${k} → ${v}`);
  return ctx.reply(lines.length ? `*Keyword reactions:*\n${lines.join('\n')}` : 'Koi reaction set nahi.');
});

cmd('blocklist', { desc: 'Block list: blocklist add/remove @user', cat: 'Owner', owner: true }, async (ctx) => {
  const action = (ctx.args[0] || '').toLowerCase();
  const list = store.get('blocked') || [];
  if (!action || action === 'list') {
    return ctx.reply(list.length ? `🚫 Blocked:\n${list.map((j) => '• ' + num(j)).join('\n')}` : 'Block list khali hai.');
  }
  const target = ctx.mentioned[0] || ctx.quoted?.sender || (ctx.args[1] ? toJid(ctx.args[1]) : null);
  if (!target) return ctx.reply('Usage: blocklist add @user');
  if (action === 'add') {
    if (!list.includes(target)) list.push(target);
    store.set('blocked', list);
    await ctx.sock.updateBlockStatus(target, 'block').catch(() => {});
    return ctx.reply(`🚫 ${num(target)} blocked.`);
  }
  if (action === 'remove') {
    store.set('blocked', list.filter((j) => j !== target));
    await ctx.sock.updateBlockStatus(target, 'unblock').catch(() => {});
    return ctx.reply(`✅ ${num(target)} unblocked.`);
  }
  return ctx.reply('Usage: blocklist add/remove @user');
});

// Owner ki "pair" command: pairing web page se hoti hai
cmd('pair', { desc: 'Pairing info', cat: 'Owner', owner: true }, (ctx) =>
  ctx.reply('ℹ️ Pairing ke liye Railway web page par apna WhatsApp number enter karein.'),
);

export { randomEmoji, commands };
