import { cmd } from '../lib/registry.js';
import { num, isOwnerJid, resolveTarget } from '../lib/helpers.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const INSULTS = [
  'aap ka IQ itna kam hai ke calculator bhi shrminda hai 🧮',
  'aap ko dekh kar mirror bhi sochta hoga ke kaash na dekhta 🪞',
  'aap ki life ka plot twist ye hai ke abhi bhi chal rahi hai 🎬',
  'aap wo wifi ho jo sirf paas aane par connect hota hai 📶',
];
const FLIRTS = [
  'Tum itni khoobsurat ho ke Google bhi tumhe search karne se pehle sochta hoga 💘',
  'Kya tum WiFi ho? Kyunke mujhe tum se connection feel ho raha hai 📶',
  'Tumhari smile ne mere dil ka password reset kar diya 💖',
];
const LARKI = [
  'Larki ne kaha "Mujhe bhool jao"... Maine kaha "Bhool gaya", phir sari raat usi ko yaad kiya 🥺',
  'Mohabbat mein wo hal hua hai ke ab dil bhi kehta hai, phir se wahi galti karo 💔',
];
const POETRY = [
  'Chand ko dekh kar yaad aaya, tum bhi aisi hi roshan ho... ✨',
  'Khamoshi bhi ab baatein karti hai, teri yaad mein ye dil dharta hai 🌙',
];
const SHAYERI = [
  'Dil ki baat zubaan par aa gayi, teri yaad phir se jaga gayi 🌹',
  'Hum ne khud ko tujh mein dhoondha, aur tujhe khud mein paaya 💫',
];

cmd('insult', { desc: 'Insult a user (fun)', cat: 'Fun', group: false }, (ctx) => {
  const target = resolveTarget(ctx);
  if (!target) return ctx.reply('Usage: insult @user');
  if (isOwnerJid(target)) return ctx.reply('Owner ko insult nahi kar sakte 🙏');
  return ctx.send({ text: `@${num(target)} ${pick(INSULTS)}`, mentions: [target] });
});

cmd('stupid', { desc: '"It\'s so stupid" meme image', cat: 'Fun' }, async (ctx) => {
  const target = resolveTarget(ctx) || ctx.sender;
  const avatar = await ctx.sock.profilePictureUrl(target, 'image').catch(() => 'https://telegra.ph/file/24fa902ead26340f3df2c.png');
  const url = `https://some-random-api.com/canvas/misc/its-so-stupid?avatar=${encodeURIComponent(avatar)}&dog=${encodeURIComponent(ctx.query || 'stupid')}`;
  return ctx.send({ image: { url }, caption: '🤣' });
});

cmd('flirt', { desc: 'Random flirt line', cat: 'Fun' }, (ctx) => ctx.reply(pick(FLIRTS)));
cmd(['larki', 'larkiptana', 'larkiptao'], { desc: 'Random larki line', cat: 'Fun' }, (ctx) => ctx.reply(pick(LARKI)));
cmd('poetry', { desc: 'Random poetry', cat: 'Fun' }, (ctx) => ctx.reply(pick(POETRY)));
cmd('shayeri', { desc: 'Random shayeri', cat: 'Fun' }, (ctx) => ctx.reply(pick(SHAYERI)));
