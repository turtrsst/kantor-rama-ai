'use strict';
/* Static wiring checks for the 2026-11-01 Creator upgrades batch:
   1) Creator Skill Pack (11 skills + lock + prompt digest excerpts)
   2) Telegram bot monitor (settings, bridge, webhook, notify hooks)
   3) Fast parallel Studio Crew chat (server fanout + client + typing UI)
   4) Mobile console (manifest, icon, additive mobile.css)
   5) YouTube Analytics loop (scope, summary, API action, card)
   Runtime behavior (real Telegram/Google/provider calls) is exercised on the
   owner's machine; this script guards the contract surface in-repo. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

/* ---- 1) Creator Skill Pack ---- */
const creatorSkills = [
  'creator-analytics-review', 'creator-concat-edit-brief', 'creator-fact-check',
  'creator-hook-smith', 'creator-policy-guard', 'creator-prepublish-qa',
  'creator-repurpose-shorts', 'creator-retention-script', 'creator-seo-metadata',
  'creator-shot-list', 'creator-trend-radar',
];
const lock = JSON.parse(read('resources/skills/SKILLS_LOCK.json').replace(/^\uFEFF/, ''));
for (const id of creatorSkills) {
  const relative = `resources/skills/${id}/SKILL.md`;
  assert(exists(relative), `Skill file exists: ${id}`);
  const content = read(relative);
  assert(content.startsWith('---') && content.includes(`name: ${id}`), `Skill frontmatter names ${id}.`);
  assert(content.includes('## Ringkasan aturan'), `Skill ${id} exposes a "Ringkasan aturan" section for the prompt digest.`);
  const entry = lock.skills[id];
  assert(entry && entry.status === 'approved' && entry.reviewState === 'approved', `Skill ${id} is approved in SKILLS_LOCK.json.`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
  assert(entry.sha256 === hash, `Skill ${id} lock hash matches file bytes (no drift).`);
}
const skillEngine = read('api/lib/KraSkillEngine.php');
for (const agentId of ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer']) {
  assert(skillEngine.includes(`'${agentId}'`), `KraSkillEngine maps ${agentId}.`);
}
assert(skillEngine.includes('rulesExcerpt') && skillEngine.includes('Ringkasan aturan'), 'KraSkillEngine injects rule excerpts into chat prompts.');
assert(skillEngine.indexOf('rulesExcerpt(') !== skillEngine.lastIndexOf('rulesExcerpt('), 'KraSkillEngine digest actually calls rulesExcerpt().');
assert(read('resources/skills/creator-concat-edit-brief/SKILL.md').includes('contoh-concat-edit'), 'Concat edit brief targets the seeded n100n workflow.');

/* ---- 2) Telegram bot monitor ---- */
assert(exists('api/lib/KraTelegramBridge.php'), 'Telegram bridge exists.');
const apiIndex = read('api/index.php');
assert(apiIndex.includes("'/lib/KraTelegramBridge.php'") && apiIndex.includes("'/lib/KraYouTubeUploader.php'"), 'api/index.php loads the Telegram bridge and the YouTube uploader.');
assert(apiIndex.includes("$action === 'telegram-webhook'") && apiIndex.includes('verifyWebhookSecret'), 'Public Telegram webhook verifies the secret header.');
for (const action of ['telegram-config', 'telegram-pairing', 'telegram-test', 'telegram-set-webhook', 'telegram-disconnect']) {
  assert(apiIndex.includes(`'${action}'`), `Supervisor action ${action} is routed.`);
}
const settings = read('api/lib/KraIntegrationSettings.php');
for (const method of ['function telegram(', 'saveTelegramToken', 'startTelegramPairing', 'consumeTelegramPairing', 'clearTelegramPairing']) {
  assert(settings.includes(method), `KraIntegrationSettings provides ${method}.`);
}
assert(read('api/lib/KraTaskEngine.php').includes('KraTelegramBridge::notify'), 'New proposals notify the owner on Telegram.');
assert(apiIndex.includes("KraTelegramBridge::notify('🎬 Upload YouTube selesai"), 'Successful YouTube uploads notify on Telegram.');
assert(read('web/index.html').includes('id="telegram-config-form"') && read('web/app.js').includes('telegramAction'), 'Telegram settings UI is wired.');
assert(exists('docs/TELEGRAM-INTEGRATION.md'), 'Telegram setup guide exists.');

/* ---- 3) Fast parallel Studio Crew chat ---- */
const agentChat = read('api/lib/KraAgentChat.php');
assert(agentChat.includes("$payload['fanout']") && agentChat.includes('fanoutPrimary'), 'Server supports client-orchestrated fan-out rounds.');
const appSource = read('web/app.js');
assert(appSource.includes('fanout: true') && appSource.includes('renderCreatorStudioTyping'), 'Studio Crew sends parallel fan-out requests with typing placeholders.');
assert(appSource.includes('replaceNode = null'), 'Studio renderer signature carries the replaceNode placeholder parameter.');
assert(read('web/creator_studio_terminal.css').includes('creator-studio-chat-typing'), 'Typing indicator is styled.');
assert(read('desktop/main.js').includes('PHP_CLI_SERVER_WORKERS'), 'Desktop PHP server gets workers for parallel chat (POSIX).');

/* ---- 4) Mobile console ---- */
const manifest = JSON.parse(read('web/manifest.webmanifest'));
assert(manifest.short_name === 'KRA' && manifest.display === 'standalone', 'Web app manifest is install-oriented.');
assert(exists('web/kra-icon.svg') && exists('web/mobile.css'), 'Mobile icon + stylesheet exist.');
const indexHtml = read('web/index.html');
assert(indexHtml.includes('rel="manifest"') && indexHtml.includes('name="theme-color"') && indexHtml.includes('mobile.css?v='), 'index.html links manifest, theme color, and mobile.css.');
const mobileCss = read('web/mobile.css');
assert(mobileCss.includes('@media (max-width: 820px)') && !mobileCss.includes('@media (min-width'), 'mobile.css only restyles small screens (desktop untouched).');

/* ---- 5) YouTube Analytics loop ---- */
const oauth = read('api/lib/KraYouTubeOAuth.php');
assert(oauth.includes('yt-analytics.readonly') && oauth.includes('function analyticsSummary'), 'OAuth requests analytics scope and summarizes 28 days.');
assert(oauth.includes("self::UPLOAD_SCOPE . ' ' . self::ANALYTICS_SCOPE"), 'Authorization URL actually requests the analytics scope.');
assert(apiIndex.includes("$action === 'youtube-analytics'"), 'youtube-analytics API action is routed.');
assert(indexHtml.includes('id="creator-analytics-grid"') && appSource.includes('loadCreatorAnalytics'), 'Analytics card UI is wired.');

console.log('Creator upgrades verification passed: skill pack + lock integrity, Telegram monitor, fast fan-out chat, mobile console, YouTube Analytics.');
