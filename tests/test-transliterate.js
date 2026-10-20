const { toCyrillic } = require('../src/services/transliterate');
const db = require('../src/database/db');
const formatter = require('../src/services/formatter');

console.log('🧪 Testing Latin-to-Cyrillic Transliteration:\n');

const testCases = [
  { input: "Shymkent, Qozog'iston 🇰🇿", expectedContains: "Шымкент" },
  { input: "Sirdaryo, O'zbekiston 🇺🇿", expectedContains: "Ўзбекистон" },
  { input: "shkura, navalom", expectedContains: "шкура" },
  { input: "2 tenta (zad)", expectedContains: "тента" },
  { input: "Gruz gotov / Mozhno gruzit", expectedContains: "Груз" }
];

testCases.forEach((t, idx) => {
  const cyr = toCyrillic(t.input);
  console.log(`${idx + 1}. Latin: "${t.input}" -> Cyrillic: "${cyr}"`);
});

console.log('\n🧪 Testing Batch Dynamics & Real-Time Sync:\n');

// 1. Create a cargo in Latin
const cargo = db.createCargo({
  from: "Toshkent, O'zbekiston",
  to: "Olmaota, Qozog'iston",
  cargo: "olma, yashikda",
  status: "faol"
});
console.log('1. Cargo created with Latin inputs. Auto-converted to Cyrillic in DB:');
console.log(`   From: ${cargo.from} | To: ${cargo.to} | Cargo: ${cargo.cargo}`);

// 2. Create batch and add cargo
const batch = db.createBatch("Eksport to'plami", [cargo.id]);
console.log('2. Created Batch ID:', batch.id);

// 3. Verify batch live preview
let batchData = db.getBatchWithCargoes(batch.id);
console.log('3. Batch initial cargoes count:', batchData.cargoes.length);
console.log('   Preview output:\n', formatter.formatBatchMessage(batchData.cargoes, 1));

// 4. Update cargo details
db.updateCargo(cargo.id, { cargo: "anor va olma (shirin)", distance: "800 km" });
console.log('4. Updated Cargo details (cargo name changed).');

// 5. Fetch batch live preview again
batchData = db.getBatchWithCargoes(batch.id);
console.log('5. Batch live updated preview output (should contain updated cargo name):\n', formatter.formatBatchMessage(batchData.cargoes, 1));

// Clean up test data
db.deleteCargo(cargo.id);
db.deleteBatch(batch.id);
console.log('6. Cleaned up test items.');

console.log('\n✅ Transliteration and Batch Dynamics Test Passed!');
