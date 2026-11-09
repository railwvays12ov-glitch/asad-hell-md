import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { DEV_NUMBER } from '../config.js';

// ---------- message parsing ----------

const WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
];

export function unwrapMessage(m = {}) {
  let cur = m || {};
  for (let i = 0; i < 5; i++) {
    const key = WRAPPERS.find((k) => cur[k]?.message);
    if (!key) break;
    cur = cur[key].message;
  }
  return cur;
}

export function isViewOnce(m = {}) {
  return !!(m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension);
}

export function getBody(m = {}) {
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

export function getMediaType(m = {}) {
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return m.audioMessage.ptt ? 'voice' : 'audio';
  if (m.stickerMessage) return 'sticker';
  if (m.documentMessage) return 'document';
  return null;
}

export function getContextInfo(m = {}) {
  const type = Object.keys(m).find((k) => k !== 'messageContextInfo' && m[k]?.contextInfo);
  return (type && m[type].contextInfo) || {};
}

export function getMentioned(m = {}) {
  return getContextInfo(m).mentionedJid || [];
}

export function getQuoted(msg, m) {
  const ci = getContextInfo(m);
  if (!ci.quotedMessage) return null;
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      id: ci.stanzaId,
      participant: ci.participant,
      fromMe: false,
    },
    message: unwrapMessage(ci.quotedMessage),
    raw: ci.quotedMessage,
    sender: ci.participant,
  };
}

// ---------- jid helpers ----------

export function num(jid = '') {
  return jid.split('@')[0].split(':')[0];
}

export function toJid(number) {
  return number.replace(/\D/g, '') + '@s.whatsapp.net';
}

export function isOwnerJid(jid = '') {
  return num(jid) === DEV_NUMBER;
}

// ---------- network ----------

export async function fetchBuffer(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

export async function fetchText(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

export async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

// Media ka buffer download karta hai (direct ya quoted message)
export async function downloadBuffer(sock, msgLike) {
  return downloadMediaMessage(msgLike, 'buffer', {}, {
    reuploadRequest: sock.updateMediaMessage,
  });
}

// ---------- group metadata cache (60 sec) ----------

const metaCache = new Map();

export async function getGroupMeta(sock, jid) {
  const hit = metaCache.get(jid);
  if (hit && Date.now() - hit.at < 60000) return hit.data;
  try {
    const data = await sock.groupMetadata(jid);
    metaCache.set(jid, { data, at: Date.now() });
    return data;
  } catch {
    return null;
  }
}

// ---------- context builder ----------

export async function buildCtx(sock, msg) {
  const jid = msg.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');
  const raw = msg.message || {};
  const m = unwrapMessage(raw);
  const sender = isGroup
    ? msg.key.participant || jid
    : msg.key.fromMe
      ? sock.user.id
      : jid;
  const isOwner = !!msg.key.fromMe || isOwnerJid(sender);
  const body = getBody(m);

  const ctx = {
    sock,
    msg,
    jid,
    isGroup,
    sender,
    senderNum: num(sender),
    m,
    body,
    isOwner,
    isAdmin: false,
    botAdmin: false,
    groupMeta: null,
    viewOnce: isViewOnce(raw),
    mentioned: getMentioned(m),
    quoted: getQuoted(msg, m),
    args: [],
    query: '',
  };

  if (isGroup) {
    ctx.groupMeta = await getGroupMeta(sock, jid);
    const parts = ctx.groupMeta?.participants || [];
    ctx.isAdmin = !!parts.find((p) => p.id === sender)?.admin;
    const botNum = num(sock.user?.id);
    ctx.botAdmin = !!parts.find((p) => num(p.id) === botNum)?.admin;
  }

  ctx.reply = (text, extra = {}) => sock.sendMessage(jid, { text, ...extra }, { quoted: msg });
  ctx.send = (content, opts = {}) => sock.sendMessage(jid, content, { quoted: msg, ...opts });
  ctx.react = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });
  return ctx;
}

// Target user: mention, quoted sender, ya number argument
export function resolveTarget(ctx) {
  if (ctx.mentioned.length) return ctx.mentioned[0];
  if (ctx.quoted?.sender) return ctx.quoted.sender;
  const n = (ctx.args || []).find((a) => /^\+?\d{7,15}$/.test(a));
  if (n) return toJid(n);
  return null;
}
