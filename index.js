const dns = require('dns');
// Force IPv4 first order in Node.js DNS lookup (fixes api.telegram.org connection issues on many ISPs)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const config = require('./src/config');
const db = require('./src/database/db');
const userbot = require('./src/services/userbot');
const bot = require('./src/bot');
const scheduler = require('./src/services/scheduler');

async function main() {
  console.log('--------------------------------------------------');
  console.log('🚚 Telegram Cargo Dispatcher Bot ishga tushmoqda...');
  console.log('--------------------------------------------------');

  if (!config.BOT_TOKEN) {
    console.warn('⚠️ BOT_TOKEN o\'rnatilmagan. Userbot rejimi orqali ishlayveradi.');
  }

  // 1. Initialize Userbot (GramJS MTProto)
  console.log('🔑 Telegram Userbot ga ulanmoqda...');
  const userbotConnected = await userbot.init();

  if (!userbotConnected) {
    console.warn('⚠️ Userbot ulanmadi. Botingiz faqat Admin menyusi rejimida ishlaydi.');
  }

  // 2. Launch Telegraf Admin Bot (if token provided)
  if (config.BOT_TOKEN) {
    try {
      await bot.launch({
        dropPendingUpdates: true
      });
      console.log('🤖 Telegraf Admin Bot muvaffaqiyatli ishga tushdi!');
    } catch (err) {
      console.error('⚠️ Admin Bot API ga ulanishda xatolik:', err.message);
      console.log('\nℹ️ ESLATMA: Telegram Userbot muvaffaqiyatli ulangan!');
      console.log('📱 Siz Telegram\'ingizdagi "Saqlangan xabarlar" (Избранное / Saved Messages) chatiga borib, quyidagi buyruqlardan foydalanishingiz mumkin:');
      console.log('   .start  - Boshlash va menyuni ko\'rish');
      console.log('   .run    - E\'lonlarni tarqatishni boshlash');
      console.log('   .stop   - Tarqatishni to\'xtatish');
      console.log('   .list   - E\'lonlar ro\'yxati');
      console.log('   .stats  - Statistikani ko\'rish');
    }
  }

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 (${signal}) Qabul qilindi. Bot to'xtatilmoqda...`);
    scheduler.stop();
    if (bot) bot.stop(signal);
    if (userbot.client) await userbot.client.disconnect();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  if (reason && reason.description && reason.description.includes('query is too old')) {
    return;
  }
  console.warn('⚠️ Kutilmagan asinxron xatolik:', reason?.message || reason);
});

main().catch(err => {
  console.error('❌ Ishga tushishda jiddiy xatolik:', err);
});
