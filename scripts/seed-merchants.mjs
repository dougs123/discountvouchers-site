// Seed merchants into D1 from merchants.json
import fs from 'fs';

const merchants = JSON.parse(fs.readFileSync('./data/merchants.json', 'utf8'));

// Deduplicate by name
const seen = new Set();
const unique = merchants.filter(m => {
  if (seen.has(m.name)) return false;
  seen.add(m.name);
  return true;
});

console.log(`Deduped ${merchants.length} → ${unique.length} merchants`);

// Build SQL INSERT statements with INSERT OR IGNORE
let sql = '';
const batchSize = 100;

for (let i = 0; i < unique.length; i += batchSize) {
  const batch = unique.slice(i, i + batchSize);
  const values = batch.map(m =>
    `('${m.name.replace(/'/g, "''")}', '${m.domain}', '${m.category}')`
  ).join(',');

  sql += `INSERT OR IGNORE INTO merchants (name, domain, category) VALUES ${values};\n`;
}

fs.writeFileSync('./data/seed-merchants.sql', sql);
console.log(`Generated seed SQL for ${unique.length} merchants at data/seed-merchants.sql`);
console.log(`Run: wrangler d1 execute discountvouchers --file ./data/seed-merchants.sql`);
