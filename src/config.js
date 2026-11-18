require('dotenv').config();
const path = require('path');

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  API_ID: parseInt(process.env.API_ID || '0', 10),
  API_HASH: process.env.API_HASH || '',
  PHONE_NUMBER: process.env.PHONE_NUMBER || '',
  SESSION_STRING: process.env.SESSION_STRING || '',
  OWNER_ID: process.env.OWNER_ID ? parseInt(process.env.OWNER_ID, 10) : null,

  // Proxy support
  HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '',
  TELEGRAM_API_ROOT: process.env.TELEGRAM_API_ROOT || '',

  // Path constants
  DATA_DIR: path.join(__dirname, '..', 'data'),
  DB_FILE: path.join(__dirname, '..', 'data', 'db.json'),
  SESSION_FILE: path.join(__dirname, '..', 'data', 'session.txt'),

  // Anti-spam and cycle timing parameters
  GROUP_DELAY_MS: parseInt(process.env.GROUP_DELAY_MS || process.env.GROUP_DELAY_MIN_MS || '50000', 10), // aniq 50 soniya
  BATCH_PAUSE_GROUPS_COUNT: parseInt(process.env.BATCH_PAUSE_GROUPS_COUNT || '5', 10), // har 5 ta guruhdan so'ng dam olish
  BATCH_PAUSE_MIN_MS: parseInt(process.env.BATCH_PAUSE_MIN_MS || '180000', 10), // 3 daqiqa
  BATCH_PAUSE_MAX_MS: parseInt(process.env.BATCH_PAUSE_MAX_MS || '240000', 10), // 4 daqiqa
  BATCH_PAUSE_MS: parseInt(process.env.BATCH_PAUSE_MS || '210000', 10), // 3-4 daqiqa dam olish (o'rtacha 3.5 daqiqa)
  CYCLE_DELAY_MS: parseInt(process.env.CYCLE_DELAY_MS || process.env.CYCLE_DELAY_MIN_MS || '900000', 10), // sikllar orasidagi tanaffus

  // Limits
  MAX_SENT_COUNT: parseInt(process.env.MAX_SENT_COUNT || '5', 10), // 5 ta to'liq sikl
  MAX_BATCH_GROUPS: parseInt(process.env.MAX_BATCH_GROUPS || '15', 10), // faqat 15 tanlangan guruh
  AUTO_DELETE_HOURS: 48,
  MAX_BATCH_CARGOES: 5,
};
