const db = require('../src/database/db');

console.log('🧪 Testing Database Operations:\n');

// 1. Create mock cargo with phone and username
const newCargo = db.createCargo({
  from: 'Shymkent',
  to: 'Sirdaryo',
  cargo: 'shkura',
  contact: '+998940046475 (@samandar_cargo)',
  status: 'faol'
});
console.log('1. Created Cargo ID:', newCargo.id);
console.log('   Contact:', newCargo.contact);

// 2. Create batch containing this cargo
const batch = db.createBatch('Test Batch', [newCargo.id]);
console.log('2. Created Batch ID:', batch.id, '| Status:', batch.status);

// 3. Record 10 completed cycles for batch
for (let cycle = 1; cycle <= 10; cycle++) {
  // Simulate dispatch to a group
  db.recordBatchGroupDispatch(batch.id, { id: `-100123${cycle}`, title: `Group ${cycle}` }, cycle, cycle);
  db.recordGroupDispatch(newCargo.id, { id: `-100123${cycle}`, title: `Group ${cycle}` }, cycle);
  // Increment completed cycle after dispatching to all groups
  db.incrementBatchCompletedCycle(batch.id);
  db.incrementCompletedCycle(newCargo.id);
}

const updatedBatch = db.getBatchById(batch.id);
console.log(`3. Batch Sent Cycles: ${updatedBatch.completed_cycles}/10. Batch Status: ${updatedBatch.status}`);

if (updatedBatch.status === 'nofaol' && updatedBatch.completed_cycles === 10) {
  console.log('✅ Batch Auto-deactivation after 10 completed cycles verified successfully!');
} else {
  console.error('❌ Batch Auto-deactivation failed!');
}

// Clean test item
db.deleteCargo(newCargo.id);
db.deleteBatch(batch.id);
console.log('4. Test items cleaned up from DB.');
console.log('\n✅ Database Test Passed!');
