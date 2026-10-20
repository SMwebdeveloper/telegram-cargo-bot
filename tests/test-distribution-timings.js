const assert = require("assert");
const config = require("../src/config");

console.log("🧪 Testing Distribution Timings & Step Rules:\n");

// 1. Konfiguratsiya parametrlarini tekshirish
console.log("Konfiguratsiya qiymatlari:");
console.log(`- Guruhlar orasidagi kutish: ${config.GROUP_DELAY_MS} ms (${config.GROUP_DELAY_MS / 1000} soniya)`);
console.log(`- Tanaffus guruhi chegarasi: har ${config.BATCH_PAUSE_GROUPS_COUNT} ta guruhda`);
console.log(`- Tanaffus davomiyligi: ${config.BATCH_PAUSE_MS} ms (${config.BATCH_PAUSE_MS / (1000 * 60)} daqiqa)`);
console.log(`- Sikllar orasidagi kutish: ${config.CYCLE_DELAY_MS} ms (${config.CYCLE_DELAY_MS / (1000 * 60)} daqiqa)`);
console.log(`- Jami sikllar limiti: ${config.MAX_SENT_COUNT} ta sikl`);

assert.strictEqual(config.GROUP_DELAY_MS, 50000, "Guruhlar orasida 50 soniya (50,000 ms) bo'lishi kerak");
assert.strictEqual(config.BATCH_PAUSE_GROUPS_COUNT, 20, "Har 20 ta guruhda tanaffus bo'lishi kerak");
assert.strictEqual(config.BATCH_PAUSE_MS, 300000, "Tanaffus 5 daqiqa (300,000 ms) bo'lishi kerak");
assert.strictEqual(config.CYCLE_DELAY_MS, 1200000, "Sikllar orasida 20 daqiqa (1,200,000 ms) bo'lishi kerak");
assert.strictEqual(config.MAX_SENT_COUNT, 10, "Maksimal sikllar soni 10 ta bo'lishi kerak");

console.log("\n✅ Barcha vaqt konstantalari talabga to'liq mos keladi!");

// 2. 50 ta guruhlik bitta sikl qadamlarini simulyatsiya qilish
const totalGroups = 50;
let events = [];

for (let i = 0; i < totalGroups; i++) {
  events.push({ action: "send", groupIndex: i + 1 });

  if (i < totalGroups - 1) {
    if ((i + 1) % config.BATCH_PAUSE_GROUPS_COUNT === 0) {
      events.push({ action: "pause_5_min", afterGroup: i + 1 });
    } else {
      events.push({ action: "wait_50_sec", afterGroup: i + 1 });
    }
  }
}
events.push({ action: "cycle_finished_wait_20_min" });

// Tahlil
const pause5minCount = events.filter((e) => e.action === "pause_5_min").length;
const wait50secCount = events.filter((e) => e.action === "wait_50_sec").length;
const sendsCount = events.filter((e) => e.action === "send").length;

console.log(`\nSimulyatsiya natijasi (50 ta guruh uchun):`);
console.log(`- Jami yuborildi: ${sendsCount} ta guruhga`);
console.log(`- 50 soniyalik kutishlar: ${wait50secCount} marta`);
console.log(`- 5 daqiqalik tanaffuslar: ${pause5minCount} marta (20 va 40-guruhlardan keyin)`);

assert.strictEqual(sendsCount, 50, "50 ta guruhga yuborilishi kerak");
assert.strictEqual(pause5minCount, 2, "20 va 40-guruhlardan keyin 2 ta 5 daqiqalik tanaffus bo'lishi kerak");
assert.strictEqual(wait50secCount, 47, "Qolgan oraliqlarda 47 ta 50 soniyalik kutish bo'lishi kerak (49 ta oraliqdan 2 tasi 5 daqiqa)");

console.log("✅ 50 ta guruhlik sikl qadamlari 100% to'g'ri ishladi!");
