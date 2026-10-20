# 🚚 Telegram Yuk E'lonlarini Ommaviy Tarqatuvchi Bot

Ushbu bot shaxsiy Telegram profilidan 50 ga yaqin logistika guruhlariga yuk e'lonlarini xavfsiz va avtomatlashtirilgan tarzda tarqatadi hamda Telegraf Admin Bot interfeysi orqali e'lonlarni boshqarish imkonini beradi.

---

## 🌟 Asosiy Imkoniyatlari

- 📱 **Shaxsiy profil nomidan tarqatish:** GramJS (MTProto) orqali logistika guruhlariga xabar yuboriladi.
- 🔀 **Matn variantlari rotatsiyasi:** Har bir yangi siklda e'lon matni 10 xil Kirill variantlaridan biriga avtomatik o'zgartiriladi.
- ☎️ **Moslashuvchan kontaktlar:** Aloqa uchun telefon raqam, Telegram `@username` yoki ikkalasi birga saqlanadi va chiroyli formatlanadi.
- 🎲 **Guruhlar ketma-ketligi randomizatsiyasi:** Anti-spam uchun har bir siklda guruhlar tartibi aralashtiriladi.
- ⏳ **Pauza va Taymerlar:** 
  - Guruhlar orasida **30-60 soniya** random kutish.
  - Har bir sikldan so'ng **15-20 daqiqa** tanaffus.
- 📊 **Limit va Sikllar:**
  - Bitta e'lon/to'plam barcha belgilangan guruhlarga 1 marta to'liq yuborilishi — **1 ta sikl** hisoblanadi.
  - Har bir e'lon jami **10 ta to'liq sikl** tarqatilgach, status avtomatik `nofaol`ga o'tadi.
  - `nofaol` e'lonlar **48 soatdan** (2 kun) so'ng bazadan avtomatik o'chiriladi.
- 📝 **Telegraf Admin Bot Menyu:**
  - Alohida maydonlar bo'yicha e'lon yaratish (Wizard Form).
  - To'plamlar (Batches) boshqaruvi va guruhlarni belgilash.
  - Statuslarni boshqarish (Faol, Nofaol, Qoralama).
  - Boshlash / To'xtatish tugmalari va real-vaqt sikllar statistikasi.

---

## 🛠 O'rnatish va Sozlash

### 1-qadam: Kutubxonalarni o'rnatish
```bash
npm install
```

### 2-qadam: Konfiguratsiya (.env faylini yaratish)
Katalogda `.env` faylini yarating va quyidagi ma'lumotlarni kiriting:

```env
BOT_TOKEN=7123456789:AAE... (Telegram Admin Bot tokeni - @BotFather dan olinadi)
API_ID=1234567 (https://my.telegram.org saytidan olinadi)
API_HASH=0123456789abcdef0123456789abcdef
PHONE_NUMBER=+998901234567 (Telegram profil telefon raqamingiz)
OWNER_ID=123456789 (Sizning Telegram ID'ingiz)
```

---

## 🚀 Botni Ishga Tushirish

```bash
node index.js
```

> **Birinchi marta ishga tushirilganda:** Terminalda Telegram raqamingizga kelgan SMS/App kod kiritiladi va `data/session.txt` faylida sessiya saqlanib qoladi. Keyingi safar kod kiritish talab etilmaydi!

---

## 🧪 Testlarni Tekshirish

```bash
node tests/test-formatter.js
node tests/test-db.js
```
