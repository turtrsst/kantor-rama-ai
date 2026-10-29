const assert = require('node:assert/strict');
const fs = require('node:fs');

const db = fs.readFileSync('api/lib/KraDb.php', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');
const migration = fs.readFileSync('assets/argon/Batch11_Modular_Agents/kra_agents_appearance_schema.sql', 'utf8');

assert.match(db, /`appearance` JSON NULL/);
assert.match(db, /ALTER TABLE `kra_agents`[\s\S]*ADD COLUMN IF NOT EXISTS `appearance` JSON NULL/);
assert.match(db, /`appearance`/);
assert.match(db, /'appearance'\s*=>/);
assert.match(db, /json_decode\(\$row\['appearance'\]/);
assert.match(app, /modularAgentCache/);
assert.match(app, /drawModularAgent/);
assert.match(app, /agent\.appearance/);
assert.match(app, /appearance:/);
assert.match(migration, /ADD COLUMN IF NOT EXISTS `appearance` JSON NULL/);

console.log('KRA appearance persistence verification passed.');
