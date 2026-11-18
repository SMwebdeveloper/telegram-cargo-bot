const assert = require("assert");
const db = require("../src/database/db");
const bot = require("../src/bot/index");
const { renderBatchGroupsSelector } = bot;

console.log("🧪 Testing Batch Groups 10-per-page Pagination & List Numbering from 1:\n");

// 1. Mock groups - 25 ta guruh yaratamiz (3 ta sahifa: 10, 10, 5)
const originalGroups = db.getTargetGroups();
const testGroups = [];
for (let i = 1; i <= 25; i++) {
  testGroups.push({
    id: `-10099${i}`,
    title: `Logistika Guruhi #${i}`,
    username: `group_${i}`,
  });
}
db.setTargetGroups(testGroups);

const batch = db.createBatch("Test To'plam Guruhlar", [], ["-100991", "-100995", "-1009912"]);

// 2. Sahifa 1 (page = 0) test
let capturedMessage = null;
let capturedKeyboard = null;

const mockCtxPage0 = {
  callbackQuery: { id: "cb_1" },
  answerCbQuery: async () => {},
  editMessageText: async (text, extra) => {
    capturedMessage = text;
    capturedKeyboard = extra.reply_markup ? extra.reply_markup.inline_keyboard : [];
  },
  replyWithHTML: async (text, extra) => {
    capturedMessage = text;
    capturedKeyboard = extra.reply_markup ? extra.reply_markup.inline_keyboard : [];
  },
};

(async () => {
  // Test Page 0
  await renderBatchGroupsSelector(mockCtxPage0, batch.id, 0);

  console.log("--- 1-SAHIFA XABAR MATNI ---");
  console.log(capturedMessage);
  console.log("----------------------------");

  // Matn tekshiruvi:
  // Sahifa 1/3 bo'lishi kerak
  assert.ok(capturedMessage.includes("<b>1 / 3</b>"), "1/3 sahifa ko'rsatilishi kerak");
  assert.ok(capturedMessage.includes("1–10 dan 25"), "1-10 guruhlar oralig'i ko'rsatilishi kerak");

  // 1 dan 10 gacha ro'yxat bo'lishi kerak
  assert.ok(capturedMessage.includes("1. ✅ <b>Logistika Guruhi #1</b> — <b>[Tanlangan]</b>"), "1-guruh tanlangan ko'rinishi kerak");
  assert.ok(capturedMessage.includes("2. ◻️ <b>Logistika Guruhi #2</b> — <i>[Tanlanmagan]</i>"), "2-guruh tanlanmagan ko'rinishi kerak");
  assert.ok(capturedMessage.includes("10. ◻️ <b>Logistika Guruhi #10</b> — <i>[Tanlanmagan]</i>"), "10-guruh ro'yxatda bo'lishi kerak");
  assert.ok(!capturedMessage.includes("11. "), "1-sahifada 11-guruh bo'lmasligi kerak");

  // Tugmalar tekshiruvi:
  // Har doim aynan 10 ta guruh tugmasi chiqishi kerak
  const groupButtonsPage0 = capturedKeyboard.filter(
    (row) => row.length === 1 && row[0].callback_data.startsWith("tbgrp_")
  );
  assert.strictEqual(groupButtonsPage0.length, 10, "1-sahifada aynan 10 ta guruh tugmasi bo'lishi kerak");
  assert.strictEqual(groupButtonsPage0[0][0].text, "1. ✅ Logistika Guruhi #1");
  assert.strictEqual(groupButtonsPage0[9][0].text, "10. ◻️ Logistika Guruhi #10");

  // Sahifalash (Orqaga va Oldinga tugmalari)
  const navRowPage0 = capturedKeyboard.find((row) =>
    row.some((b) => b.text.includes("Oldinga") || b.text.includes("Orqaga"))
  );
  assert.ok(navRowPage0, "Navigatsiya qatori mavjud bo'lishi kerak");
  assert.strictEqual(navRowPage0.length, 3, "Orqaga, sahifa raqami va Oldinga tugmalari bo'lishi kerak");
  assert.ok(navRowPage0[0].text.includes("Orqaga"), "Orqaga tugmasi bo'lishi kerak");
  assert.strictEqual(navRowPage0[0].callback_data, `bgrp_first_${batch.id}`, "Birinchi sahifada orqaga bosilsa bgrp_first_ bo'lishi kerak");
  assert.ok(navRowPage0[2].text.includes("Oldinga"), "Oldinga tugmasi bo'lishi kerak");
  assert.strictEqual(navRowPage0[2].callback_data, `bgroups_${batch.id}_1`, "1-sahifadan 2-sahifaga o'tish kodi bo'lishi kerak");

  console.log("1. ✅ 1-sahifa (1..10 guruhlar, 10 ta tugma, Oldinga/Orqaga) muvaffaqiyatli tekshirildi!");

  // Test Page 1 (2-sahifa)
  await renderBatchGroupsSelector(mockCtxPage0, batch.id, 1);

  assert.ok(capturedMessage.includes("<b>2 / 3</b>"), "2/3 sahifa ko'rsatilishi kerak");
  assert.ok(capturedMessage.includes("11–20 dan 25"), "11-20 oralig'i ko'rsatilishi kerak");
  assert.ok(capturedMessage.includes("11. ◻️ <b>Logistika Guruhi #11</b>"), "11-guruh bo'lishi kerak");
  assert.ok(capturedMessage.includes("12. ✅ <b>Logistika Guruhi #12</b> — <b>[Tanlangan]</b>"), "12-guruh tanlangan bo'lishi kerak");
  assert.ok(capturedMessage.includes("20. ◻️ <b>Logistika Guruhi #20</b>"), "20-guruh bo'lishi kerak");

  const groupButtonsPage1 = capturedKeyboard.filter(
    (row) => row.length === 1 && row[0].callback_data.startsWith("tbgrp_")
  );
  assert.strictEqual(groupButtonsPage1.length, 10, "2-sahifada ham aynan 10 ta guruh chiqishi kerak");
  assert.strictEqual(groupButtonsPage1[0][0].text, "11. ◻️ Logistika Guruhi #11");
  assert.strictEqual(groupButtonsPage1[1][0].text, "12. ✅ Logistika Guruhi #12");
  assert.strictEqual(groupButtonsPage1[9][0].text, "20. ◻️ Logistika Guruhi #20");

  const navRowPage1 = capturedKeyboard.find((row) =>
    row.some((b) => b.text.includes("Oldinga") || b.text.includes("Orqaga"))
  );
  assert.strictEqual(navRowPage1[0].callback_data, `bgroups_${batch.id}_0`, "2-sahifadan 1-sahifaga orqaga qaytish bo'lishi kerak");
  assert.strictEqual(navRowPage1[2].callback_data, `bgroups_${batch.id}_2`, "2-sahifadan 3-sahifaga oldinga o'tish bo'lishi kerak");

  console.log("2. ✅ 2-sahifa (11..20 guruhlar, 10 ta tugma, Orqaga -> 0, Oldinga -> 2) muvaffaqiyatli tekshirildi!");

  // Test Page 2 (3-sahifa: oxirgi sahifa, 5 ta qolgan guruh)
  await renderBatchGroupsSelector(mockCtxPage0, batch.id, 2);

  assert.ok(capturedMessage.includes("<b>3 / 3</b>"), "3/3 sahifa ko'rsatilishi kerak");
  assert.ok(capturedMessage.includes("21–25 dan 25"), "21-25 oralig'i ko'rsatilishi kerak");
  assert.ok(capturedMessage.includes("21. ◻️ <b>Logistika Guruhi #21</b>"), "21-guruh bo'lishi kerak");
  assert.ok(capturedMessage.includes("25. ◻️ <b>Logistika Guruhi #25</b>"), "25-guruh bo'lishi kerak");

  const navRowPage2 = capturedKeyboard.find((row) =>
    row.some((b) => b.text.includes("Oldinga") || b.text.includes("Orqaga"))
  );
  assert.strictEqual(navRowPage2[0].callback_data, `bgroups_${batch.id}_1`, "3-sahifadan 2-sahifaga orqaga qaytish bo'lishi kerak");
  assert.strictEqual(navRowPage2[2].callback_data, `bgrp_last_${batch.id}`, "Oxirgi sahifada oldinga bosilsa bgrp_last_ bo'lishi kerak");

  console.log("3. ✅ 3-sahifa (oxirgi sahifa, Oldinga tugmasi oxirgi sahifa haqida xabardor qiladi) muvaffaqiyatli tekshirildi!");

  // Tozalash
  db.deleteBatch(batch.id);
  db.setTargetGroups(originalGroups);
  console.log("\n🎉 Barcha guruhlarni tanlash va paginatsiya testlari 100% muvaffaqiyatli o'tdi!");
})();
