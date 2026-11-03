'use strict';

/** Verifikasi model agen magang (DSH prototype adaptation) dan wiring KRA. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const PIN = '6337fc823ce20251c8de8085948165c81aaa701e';
const base = 'models/dsh-superagent-intern';

// --- Model pack -------------------------------------------------------------
for (const file of ['UPSTREAM.md', 'MODEL.md', 'PHILOSOPHY.md', 'LICENSE', 'model.json']) {
  assert(exists(`${base}/${file}`), `Intern model pack file present: ${file}`);
}
const prompts = fs.readdirSync(path.join(root, base, 'prompts'), { recursive: true })
  .filter((name) => String(name).endsWith('.md'));
assert(prompts.length >= 15, `All upstream reference prompts are bundled (found ${prompts.length})`);
assert(!exists(`${base}/src`) && !exists(`${base}/cordis.patch.yml`) && !exists(`${base}/SETUP.md`), 'The DSH runtime is deliberately NOT bundled.');

const upstream = read(`${base}/UPSTREAM.md`);
assert(upstream.includes('deepseek-ai/dsh-superagent-prototype') && upstream.includes(PIN), 'Model pack is pinned to a traceable upstream commit.');
assert(upstream.includes('research prototype') && upstream.includes('bukan perangkat lunak produksi'), 'Research-only status is documented.');
const philosophy = read(`${base}/PHILOSOPHY.md`);
assert(philosophy.includes('Take as little human attention as possible'), 'Core attention-aware principle is included.');
const model = JSON.parse(read(`${base}/model.json`));
assert(model.id === 'dsh-superagent-intern' && model.kind === 'agent-model' && model.runtime === 'kra-prompt-policy-pack', 'Manifest describes an agent model, not an LLM endpoint.');
assert(model.source.commit === PIN && model.persona.id === 'dira' && model.persona.reportsTo === 'rama', 'Manifest pins source, persona, and supervisor.');
assert(Array.isArray(model.guardrails) && model.guardrails.length >= 6, 'Guardrails are explicit.');
const guardrailText = JSON.stringify(model.guardrails) + read(`${base}/MODEL.md`);
for (const forbidden of ['git push', 'auto-merge', 'upload']) {
  assert(guardrailText.toLowerCase().includes(forbidden), `Guardrail documented: ${forbidden}`);
}

// --- Agent spec + dossier ---------------------------------------------------
const spec = JSON.parse(read('agents/dira.agent.json'));
assert(spec.name === 'Dira' && spec.model === 'models/dsh-superagent-intern/model.json', 'Agent spec points at the single model pack.');
assert(spec.configs.reportsTo === 'rama' && spec.configs.guardrails.includes('no-git-push'), 'Intern is supervised and has no write authority.');
assert(read('agents/Dira.md').includes('anak magang') || read('agents/Dira.md').includes('Anak Magang'), 'Office dossier describes the intern role.');

// --- PHP registry + chat ----------------------------------------------------
const registry = read('api/lib/KraAgentRegistry.php');
assert(registry.includes("'intern' => [") && registry.includes("'name' => 'Dira'")
  && registry.includes("'supervised' => true") && registry.includes("'reportsTo' => 'rama'"), 'API registry exposes Dira as a supervised intern.');
const chat = read('api/lib/KraAgentChat.php');
assert(chat.includes("'dira' => [") && chat.includes("'Super-Agent Intern"), 'Chat persona for Dira exists.');
assert(chat.includes("@dira") && chat.includes("'siti', 'rama', 'dira'"), 'Team mentions and message routing recognise @dira.');

// --- Office UI --------------------------------------------------------------
const app = read('web/app.js');
const html = read('web/index.html');
const css = read('web/ui_refresh.css');
assert(app.includes("id: 'dira'") && app.includes("'Super-Agent Intern"), 'Dira is a seventh office agent with a distinct appearance.');
const diraStart = app.indexOf("id: 'dira'");
assert(diraStart >= 0 && app.slice(diraStart, diraStart + 700).includes('appearance:'), 'Intern has its own avatar appearance.');
assert(app.includes("dira: { label: 'PRIVATE CHANNEL DIRA") && app.includes("dira: 'Minta Dira"), 'Private chat channel and placeholder are registered.');
assert(app.includes("agent.id === 'dira'"), 'Chat avatar resolves to Dira rather than falling back to Rama.');
assert(html.includes('data-channel="dira"') && html.includes('>Dira</span>'), 'Chat tab for the intern is visible.');
assert(css.includes('.char-dira'), 'Intern has an initials avatar style.');

// --- Docs, scripts, CI ------------------------------------------------------
assert(exists('docs/INTERN-SUPERAGENT.md') && read('docs/INTERN-SUPERAGENT.md').includes('arena/cbf4b10e-kantor-rama-ai'), 'Operational guide documents the deploy branch.');
assert(read('README.md').includes('dsh-superagent-intern'), 'README lists the intern model.');
assert(JSON.parse(read('package.json')).scripts['verify:intern-agent'], 'Root npm script verifies the intern model.');
assert(read('.github/workflows/ci.yml').includes('verify:intern-agent'), 'CI verifies the intern model.');

console.log('Intern super-agent verification passed: pinned model pack, guardrails, PHP registry/chat, office roster, chat tab, docs, and CI.');
