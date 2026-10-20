const assert = require("assert");
const db = require("../src/database/db");
const scheduler = require("../src/services/scheduler");

console.log("🧪 Testing Batch Lifecycle, Group Stats & 10 Cycles:\n");

// 1. Yangi to'plam yaratish
const batch = db.createBatch("Test To'plam", []);
console.log("1. Yaratilgan to'plam:", batch.title, "| Holati:", batch.status);
assert.strictEqual(batch.status, "faol", "Yangi to'plam holati faol bo'lishi kerak");
assert.strictEqual(batch.completed_cycles, 0, "Boshlang'ich sikllar 0 bo'lishi kerak");

// 2. To'plam holatini o'zgartirish (Yangi funksiya)
db.updateBatchStatus(batch.id, "nofaol");
assert.strictEqual(db.getBatchById(batch.id).status, "nofaol", "To'plam nofaolga o'tishi kerak");
db.updateBatchStatus(batch.id, "faol");
assert.strictEqual(db.getBatchById(batch.id).status, "faol", "To'plam yana faolga o'tishi kerak");
console.log("2. ✅ To'plam holatini o'zgartirish (faol <-> nofaol) tekshirildi!");

// 3. Guruhlarga yuborish statistikasini yozib borish (Yangi funksiya 1)
const mockGroups = [
  { id: "-100111", title: "Guruh 1 (Almaty Logistika)" },
  { id: "-100222", title: "Guruh 2 (Toshkent Yuk)" },
  { id: "-100333", title: "Guruh 3 (Tranzit)" },
];

for (let cycle = 1; cycle <= 10; cycle++) {
  mockGroups.forEach((group, gIdx) => {
    const variant = scheduler.getNextVariant(batch.id, group.id, cycle, gIdx);
    db.recordBatchGroupDispatch(batch.id, group, cycle, variant);
  });
  // 1 to'liq sikl yakunlandi
  db.incrementBatchCompletedCycle(batch.id);
}

// 4. Statistikani tekshirish
const finalBatch = db.getBatchById(batch.id);
console.log(`3. 10 ta to'liq sikldan keyin:
   - Completed cycles: ${finalBatch.completed_cycles}/10
   - Holati: ${finalBatch.status}`);

assert.strictEqual(finalBatch.completed_cycles, 10, "10 ta sikl bajarilgan bo'lishi kerak");
assert.strictEqual(finalBatch.status, "nofaol", "10 ta sikldan so'ng to'plam holati 'nofaol'ga o'tishi kerak!");
console.log("4. ✅ 10 ta sikldan so'ng to'plam avtomatik 'nofaol'ga o'tdi!");

// 5. Har bir guruh bo'yicha yuborilish sonini tekshirish
mockGroups.forEach((g) => {
  const stat = finalBatch.group_stats[g.id];
  console.log(`   - "${g.title}": ${stat.count} marta yuborildi (Oxirgi sikl: ${stat.last_cycle})`);
  assert.strictEqual(stat.count, 10, `Har bir guruhga aynan 10 marta yuborilgan bo'lishi kerak`);
});
console.log("5. ✅ To'plamning har bir guruhga yuborilish soni to'liq qayd etildi!");

// 6. Matn variantlarining ketma-ket takrorlanmasligini tekshirish
console.log("\n6. Matn variantlari ketma-ketligi tekshirilmoqda:");
const g1History = finalBatch.sent_history.filter((h) => h.group_id === "-100111");
for (let i = 0; i < g1History.length - 1; i++) {
  assert.notStrictEqual(
    g1History[i].variant,
    g1History[i + 1].variant,
    `Guruh 1 ga ketma-ket bir xil variant yuborilmasligi kerak! (Sikl ${i + 1} va ${i + 2})`,
  );
}
console.log("   Variantlar tarixi (Guruh 1):", g1History.map((h) => `Sikl ${h.cycle}: Var #${h.variant}`).join(" -> "));
console.log("✅ Hech qachon ketma-ket bir xil variant yuborilmasligi tasdiqlandi!");

// Tozalash
db.deleteBatch(batch.id);
console.log("\n✅ Barcha testlar muvaffaqiyatli o'tdi!");
