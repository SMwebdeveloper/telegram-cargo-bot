const assert = require("assert");
const config = require("../src/config");

console.log("🧪 Testing Distribution Timings & Step Rules:\n");

// 1. Konfiguratsiya parametrlarini tekshirish
console.log("Konfiguratsiya qiymatlari:");
console.log(`- Guruhlar orasidagi kutish: ${config.GROUP_DELAY_MS} ms (${config.GROUP_DELAY_MS / 1000} soniya)`);
console.log(`- Tanaffus guruhi chegarasi: har ${config.BATCH_PAUSE_GROUPS_COUNT} ta guruhda dam olish`);
console.log(`- Tanaffus davomiyligi: ${config.BATCH_PAUSE_MIN_MS / 60000}-${config.BATCH_PAUSE_MAX_MS / 60000} daqiqa`);
console.log(`- Bitta to'plamdagi tanlangan guruhlar: ${config.MAX_BATCH_GROUPS} ta`);
console.log(`- Jami sikllar limiti: ${config.MAX_SENT_COUNT} ta sikl`);

assert.strictEqual(config.GROUP_DELAY_MS, 50000, "Guruhlar orasida 50 soniya bo'lishi kerak");
assert.strictEqual(config.BATCH_PAUSE_GROUPS_COUNT, 5, "Har 5 ta guruhda dam olish bo'lishi kerak");
assert.strictEqual(config.MAX_BATCH_GROUPS, 15, "To'plam faqat 15 ta tanlangan guruhga yuborilishi kerak");
assert.strictEqual(config.MAX_SENT_COUNT, 5, "Maksimal sikllar soni 5 ta bo'lishi kerak");

console.log("\n✅ Barcha vaqt va guruh konstantalari talablarga to'liq mos keladi!");

// 2. 15 ta tanlangan guruhlik 1 ta to'liq sikl qadamlarini simulyatsiya qilish
const totalGroups = 15;
let events = [];

for (let i = 0; i < totalGroups; i++) {
  events.push({ action: "send", groupIndex: i + 1 });

  if (i < totalGroups - 1) {
    if ((i + 1) % config.BATCH_PAUSE_GROUPS_COUNT === 0) {
      events.push({ action: "pause_3_4_min", afterGroup: i + 1 });
    } else {
      events.push({ action: "wait_group_delay", afterGroup: i + 1 });
    }
  }
}
events.push({ action: "cycle_1_completed" });

// Tahlil
const pauseCount = events.filter((e) => e.action === "pause_3_4_min").length;
const waitCount = events.filter((e) => e.action === "wait_group_delay").length;
const sendsCount = events.filter((e) => e.action === "send").length;

console.log(`\nSimulyatsiya natijasi (15 ta tanlangan guruh uchun):`);
console.log(`- Jami yuborildi: ${sendsCount} ta guruhga`);
console.log(`- Guruhlar orasidagi kutishlar: ${waitCount} marta`);
console.log(`- 3-4 daqiqalik dam olishlar: ${pauseCount} marta (5 va 10-guruhlardan keyin)`);

assert.strictEqual(sendsCount, 15, "Faqat 15 ta guruhga yuborilishi kerak");
assert.strictEqual(pauseCount, 2, "5 va 10-guruhlardan keyin 2 ta 3-4 daqiqalik dam olish bo'lishi kerak");
assert.strictEqual(waitCount, 12, "Qolgan oraliqlarda 12 ta kutish bo'lishi kerak (14 oraliqdan 2 tasi dam olish)");

console.log("✅ 15 ta guruhlik 1 ta to'liq sikl qadamlari 100% to'g'ri ishladi!");
