const assert = require("assert");
const formatter = require("../src/services/formatter");

console.log("🧪 Testing 10 Variants of Almaty -> Tashkent:\n");

// 1. Foydalanuvchi taqdim etgan aniq 10 ta variantni tekshirish
for (let i = 1; i <= 10; i++) {
  const text = formatter.formatSingleCargo(null, i);
  console.log(`=== Variant ${i} ===\n${text}\n`);
  assert(text.length > 20, `Variant ${i} matni bo'sh bo'lmasligi kerak`);
}

// 2. Ketma-ket variantlar har xilligini tekshirish (hech qachon bir xil bo'lmasligi kerak)
for (let i = 1; i <= 10; i++) {
  const current = formatter.formatSingleCargo(null, i);
  const next = formatter.formatSingleCargo(null, i === 10 ? 1 : i + 1);
  assert.notStrictEqual(current, next, `Variant ${i} va ${i + 1} bir xil bo'lmasligi kerak`);
}
console.log("✅ 10 ta variant ketma-ket har xilligi tekshirildi!");

// 3. Maxsus cargo bilan tekshirish
const customCargo = {
  from: "Алматы, Казахстан 🇰🇿",
  to: "Ташкент, Узбекистан 🇺🇿",
  distance: "808 км",
  cargo: "напитки",
  weight_volume: "20т / 86м3",
  transport: "1 тент (зад)",
  cargo_status: "завтра",
  advance: "Аванс есть",
  payment: "безналичная",
  contact: "+998940046475",
};

const v1 = formatter.formatSingleCargo(customCargo, 1);
console.log("\nCustom Cargo Variant 1:\n", v1);
assert(v1.includes("808 км"), "808 km bo'lishi kerak");
assert(v1.includes("напитки"), "напитки bo'lishi kerak");
assert(v1.includes("+998940046475"), "telefon raqam bo'lishi kerak");

console.log("\n✅ Formatter Test muvaffaqiyatli o'tdi!");
