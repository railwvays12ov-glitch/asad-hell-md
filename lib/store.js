// Simple JSON settings store (bot aur groups ki settings)
import fs from 'fs';
import path from 'path';
import { DATA_DIR, DEFAULT_PREFIX } from '../config.js';

const FILE = path.join(DATA_DIR, 'settings.json');

const defaults = () => ({
  global: {
    mode: 'public', // public | private | inbox
    prefix: DEFAULT_PREFIX,
    alwaysonline: false,
    autoread: false,
    autoreact: false,
    statusreact: false,
    autostatus: false,
    antidelete: false,
    anticall: false,
    reactions: {}, // keyword -> emoji
    blocked: [], // blocked jids
    afk: {}, // jid -> { reason, since }
  },
  groups: {}, // groupJid -> settings
});

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const base = defaults();
    return { global: { ...base.global, ...raw.global }, groups: raw.groups || {} };
  } catch {
    return defaults();
  }
}

let db = load();
let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
    } catch (e) {
      console.error('Settings save error:', e.message);
    }
  }, 300);
}

export const store = {
  get(key) {
    return db.global[key];
  },
  set(key, value) {
    db.global[key] = value;
    save();
  },
  gget(jid, key) {
    return db.groups[jid]?.[key];
  },
  gset(jid, key, value) {
    (db.groups[jid] ||= {})[key] = value;
    save();
  },
  gall(jid) {
    return db.groups[jid] || {};
  },
};
