const assert = require("assert");
const db = require("../src/database/db");
const formatter = require("../src/services/formatter");

console.log("🧪 Testing Username Contact Formatting & Cargo Edit Functions:\n");

// 1. Username kiritilganda e'londa username chiqishini tekshirish (Almati -> Toshkent bo'lsa ham!)
const cargoWithUsername = db.createCargo({
  from: "Алматы, Казахстан 🇰🇿",
  to: "Ташкент, Узбекистан 🇺🇿",
  distance: "808 км",
  cargo: "напитки",
  weight_volume: "20т / 86м3",
  transport: "1 тент (зад)",
  cargo_status: "завтра",
  advance: "Аванс есть",
  payment: "безналичная",
  contact: "@SamandarMirzaraxmonov",
  status: "faol",
});

console.log("1. Cargo created with username:", cargoWithUsername.contact);

for (let v = 1; v <= 10; v++) {
  const formatted = formatter.formatSingleCargo(cargoWithUsername, v);
  // E'londa kiritilgan username chiqishi kerak, eskicha tel raqam (+998940046475) emas!
  assert(
    formatted.includes("@SamandarMirzaraxmonov"),
    `Variant ${v} da username chiqishi kerak! Chiqqan matn:\n${formatted}`
  );
  assert(
    !formatted.includes("+998940046475"),
    `Variant ${v} da eskicha tel raqam chiqmasligi kerak!`
  );
}
console.log("✅ Barcha 10 ta variantda username to'g'ri chiqdi va tel raqam bilan almashtirilmadi!");

// 2. Agar foydalanuvchi @ belgisisiz kiritgan bo'lsa (masalan "samandar_user")
const cargoNoAt = {
  from: "Ташкент",
  to: "Самарканд",
  distance: "300 км",
  cargo: "мебель",
  weight_volume: "10т",
  transport: "тент",
  cargo_status: "тайёр",
  advance: "бор",
  payment: "нал",
  contact: "samandar_user",
};

const v1Text = formatter.formatSingleCargo(cargoNoAt, 1);
assert(
  v1Text.includes("@samandar_user"),
  `@ belgisisiz kiritilgan username avtomatik @ bilan chiqishi kerak! Chiqqan matn:\n${v1Text}`
);
console.log("✅ @ belgisisiz username avtomatik to'g'rilandi (@samandar_user)!");

// 3. E'lonni tahrirlash funksiyasini tekshirish (db.updateCargo)
console.log("\n3. Testing db.updateCargo:");

// 3.1. Bitta maydonni tahrirlash (masalan kontaktni o'zgartirish)
db.updateCargo(cargoWithUsername.id, { contact: "@YangiUsername" });
const updated1 = db.getCargoById(cargoWithUsername.id);
assert.strictEqual(updated1.contact, "@YangiUsername");
const updated1Preview = formatter.formatSingleCargo(updated1, 1);
assert(updated1Preview.includes("@YangiUsername"));
console.log("✅ Kontakt muvaffaqiyatli tahrirlandi:", updated1.contact);

// 3.2. Boshqa maydonlarni tahrirlash (masalan yuk va masofa)
db.updateCargo(cargoWithUsername.id, {
  cargo: "яшикларда олма",
  distance: "820 км",
  from: "Shymkent", // Lotincha kiritilsa, kirillga o'girilishi kerak
});
const updated2 = db.getCargoById(cargoWithUsername.id);
assert.strictEqual(updated2.cargo, "яшикларда олма");
assert.strictEqual(updated2.distance, "820 км");
assert.strictEqual(updated2.from, "Шымкент");
console.log("✅ Yuk, masofa va qayerdan maydonlari tahrirlandi!");

// 4. Tozalash
db.deleteCargo(cargoWithUsername.id);
console.log("✅ Test ma'lumotlari tozalandi.");

console.log("\n🎉 Barcha testlar 100% muvaffaqiyatli o'tdi!");
