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
  GROUP_DELAY_MS: parseInt(process.env.GROUP_DELAY_MS || '50000', 10), // aniq 50 soniya
  BATCH_PAUSE_GROUPS_COUNT: parseInt(process.env.BATCH_PAUSE_GROUPS_COUNT || '20', 10), // har 20 ta guruh
  BATCH_PAUSE_MS: parseInt(process.env.BATCH_PAUSE_MS || '300000', 10), // 5 daqiqa tanaffus (300,000 ms)
  CYCLE_DELAY_MS: parseInt(process.env.CYCLE_DELAY_MS || '1200000', 10), // 20 daqiqa (1,200,000 ms)

  // Limits
  MAX_SENT_COUNT: 10, // 10 ta to'liq sikl
  AUTO_DELETE_HOURS: 48,
  MAX_BATCH_CARGOES: 5,
};
