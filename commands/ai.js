import { cmd } from '../lib/registry.js';
import { fetchText } from '../lib/helpers.js';
import { AI_API } from '../config.js';

// AI response: JSON ho to text field nikalo, warna raw text
function extractAnswer(raw) {
  try {
    const j = JSON.parse(raw);
    for (const k of ['answer', 'result', 'response', 'text', 'message', 'reply']) {
      if (typeof j[k] === 'string') return j[k];
    }
    return JSON.stringify(j).slice(0, 3000);
  } catch {
    return raw.trim();
  }
}

async function ask(ctx) {
  const prompt = ctx.query || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || '';
  if (!prompt) return ctx.reply(`Usage: ${ctx.prefix || '.'}ai <question>`);
  await ctx.reply('🤖 Soch raha hoon...');
  const raw = await fetchText(`${AI_API}?prompt=${encodeURIComponent(prompt)}`);
  return ctx.reply(extractAnswer(raw).slice(0, 4000));
}

cmd(['ai', 'ask', 'gpt', 'chatgpt', 'gemini', 'claude', 'llama'], { desc: 'AI chat: ai <question>', cat: 'AI' }, ask);
