// ============================================================
// ASAD HELL MD - main config
// Railway / env variables se override ho sakti hain
// ============================================================

export const BOT_NAME = process.env.BOT_NAME || 'Asad Hell MD';

// Owner / developer number (country code ke saath, bina + aur spaces)
export let DEV_NUMBER = (process.env.OWNER_NUMBER || '923013600709').replace(/\D/g, '');
export function setDevNumber(number) {
  DEV_NUMBER = String(number || '').replace(/\D/g, '') || DEV_NUMBER;
}
export const DEV_NAME = 'Asad';
export const DEV_TG = '@asad_rajar';
export const DEV_TG_URL = 'https://t.me/asad_rajar';

export const CHANNEL_NAME = '𝖱𝖠𝖩𝖠𝖱 𝖳𝖤𝖢𝖧 ˢⁱᵍᵐᵃ™';
export const CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8Xdg41NCrN4PNROq2Q';

export const DEFAULT_PREFIX = '.';

// Pairing code ke liye (optional). Number set karein to QR ki jagah pairing code milega.
// Example: 923013600709
export const PAIR_NUMBER = (process.env.PAIR_NUMBER || '').replace(/\D/g, '');

// Optional API keys / endpoints
export const SCREENSHOT_API_KEY = process.env.SCREENSHOT_API_KEY || '';
export const DOWNLOADER_API = process.env.DOWNLOADER_API || 'https://youtube-dwn.up.railway.app/api/download';
export const AI_API = process.env.AI_API || 'https://gemini-api-from-ammar.vercel.app/api/ask';

export const AUTH_DIR = process.env.AUTH_DIR || './auth_info';
export const DATA_DIR = process.env.DATA_DIR || './data';
export const TMP_DIR = process.env.TMP_DIR || './data/tmp';
export const DP_PATH = './assets/dp.png';
