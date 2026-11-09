# Asad Hell MD - WhatsApp Bot

Node.js + Baileys bot. Default prefix: `.`

## Deploy on Railway

1. GitHub par ye folder push karein, ya Railway par "Empty project" se zip upload karein.
2. Railway **Variables** mein ye add karein:
   - `OWNER_NUMBER` = `923013600709`
   - `PAIR_NUMBER` = `923013600709` (pairing code ke liye)
   - `SCREENSHOT_API_KEY` = (optional, `.ss` ke liye)
3. Deploy hone ke baad **Logs** kholen. Wahan `🔗 PAIRING CODE: XXXX-XXXX` aayega.
4. Phone par WhatsApp > Settings > Linked devices > Link a device > **Link with phone number** > code enter karein.
5. Logs mein `✅ Asad Hell MD connected` aaye to bot ready hai.

**Zaroori:** Railway ka disk restart par reset ho sakta hai, is liye session save rakhne ke liye Railway mein **Volume** lagayein aur mount path `/app/auth_info` aur `/app/data` set karein. Warna har restart par dobara pair karna parega.

## Local chalana

```bash
npm install
OWNER_NUMBER=923013600709 PAIR_NUMBER=923013600709 npm start
```
Local par `PAIR_NUMBER` na ho to QR terminal mein aata hai.

Sticker, toimg, toptt commands ke liye `ffmpeg` installed hona chahiye.

## Files

- `index.js` - connection, message handler, mode aur moderation
- `config.js` - name, owner, channel link, prefix
- `commands/` - saari commands (general, owner, group, media, download, ai, fun)
- `lib/` - helpers, settings store, command registry
- `assets/dp.png` - profile picture (WhatsApp par set karein)

## Notes

- Ye bot Baileys (unofficial) par chalta hai. Bulk messages ya spam par WhatsApp number ban ho sakta hai.
- Download, AI aur screenshot commands bahar ke third-party APIs par depend karte hain. Agar API band ho to ye commands kaam nahi karenge.

Web pairing page enabled.
