const assert = require("assert");
const db = require("../src/database/db");
const scheduler = require("../src/services/scheduler");
const config = require("../src/config");

console.log("🧪 Testing Batch Target Groups Selection & Live Status Format:\n");

// 1. MAX_SENT_COUNT tekshiruvi (5 ta sikl)
assert.strictEqual(config.MAX_SENT_COUNT, 5, "Sikllar soni aynan 5 ta bo'lishi kerak!");
console.log("1. ✅ config.MAX_SENT_COUNT = 5 tekshirildi.");

// 2. To'plam yaratish va guruhlarni biriktirish
const originalTargetGroups = db.getTargetGroups();
const mockGroups = [
  { id: "-100111", title: "Logistika Toshkent" },
  { id: "-100222", title: "Shymkent Yuklari" },
  { id: "-100333", title: "Samarqand Tranzit" },
  { id: "-100444", title: "Vodiy Yuklari" },
];
db.setTargetGroups(mockGroups);

const batch = db.createBatch("Toshkent-Shymkent to'plami", [], ["-100111", "-100222"]);
console.log("2. Yaratilgan to'plam:", batch.title);
assert.strictEqual(batch.target_group_ids.length, 2, "Boshlang'ich biriktirilgan guruhlar 2 ta bo'lishi kerak");

// 3. Guruh toggle qilish
db.toggleBatchTargetGroup(batch.id, "-100333"); // qo'shish
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.includes("-100333"), true, "-100333 qo'shilishi kerak");
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.length, 3);

db.toggleBatchTargetGroup(batch.id, "-100333"); // olib tashlash
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.includes("-100333"), false, "-100333 olib tashlanishi kerak");
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.length, 2);
console.log("3. ✅ To'plamga guruhni qo'shish va olib tashlash (toggle) muvaffaqiyatli!");

// 4. Barchasini tanlash va tozalash
db.selectAllGroupsForBatch(batch.id, mockGroups.map(g => g.id));
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.length, 4, "Barcha 4 ta guruh tanlangan bo'lishi kerak");

db.clearBatchTargetGroups(batch.id);
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.length, 0, "Guruhlar tozalangan bo'lishi kerak");

db.setBatchTargetGroups(batch.id, ["-100111", "-100222"]);
assert.strictEqual(db.getBatchById(batch.id).target_group_ids.length, 2);
console.log("4. ✅ selectAll, clear, setBatchTargetGroups metodlari muvaffaqiyatli!");

// 5. Statistika va oxirgi xabar matni ko'rinishi (Live Status message text)
db.recordBatchGroupDispatch(batch.id, mockGroups[0], 1, 1, { id: 1234, link: "https://t.me/c/111/1234" });

const targetGroups = mockGroups.slice(0, 2);
const mockPreview = "🚚 Toshkent ➔ Shymkent | 198km | 22t | Tel: +998901234567";

const statusText = scheduler.buildStatisticsText(
  batch,
  1,
  0,
  targetGroups,
  `"${mockGroups[0].title}"ga yuborildi`,
  mockPreview
);

console.log("\n--- SHAKLLANGAN JONLI XABAR KO'RINISHI ---\n");
console.log(statusText);
console.log("\n----------------------------------------\n");

// Matnda to'plam nomi, guruhlar va ularning yuborilganlik soni borligini tekshirish
assert.ok(statusText.includes("TARQATILAYOTGAN TO'PLAM: Toshkent-Shymkent to'plami"), "To'plam nomi bo'lishi kerak");
assert.ok(statusText.includes("/5 ta"), "5 ta sikl bo'lishi kerak");
assert.ok(statusText.includes("Logistika Toshkent"), "Guruh nomi bo'lishi kerak");
assert.ok(statusText.includes("1/5 marta"), "Guruhga yuborilganlik soni (1/5) bo'lishi kerak");
assert.ok(statusText.includes("Shymkent Yuklari"), "Ikkinchi guruh nomi bo'lishi kerak");
assert.ok(statusText.includes("0/5 marta"), "Navbatdagi guruh soni (0/5) bo'lishi kerak");
assert.ok(statusText.includes("TARQATILAYOTGAN TO'PLAM MATNI:"), "To'plam matni sarlavhasi bo'lishi kerak");
assert.ok(statusText.includes("Toshkent ➔ Shymkent"), "Haqiqiy to'plam matni bo'lishi kerak");

console.log("5. ✅ buildStatisticsText jonli xabari barcha talablarga 100% javob beradi!");

// Tozalash
db.deleteBatch(batch.id);
db.setTargetGroups(originalTargetGroups);
console.log("\n🎉 Barcha yangi imkoniyatlar testdan a'lo darajada o'tdi!");
