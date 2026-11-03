'use strict';

/** Regresi layout Studio Terminal: tab tidak menimpa shell, composer dua baris,
 *  dan area percakapan tidak boleh menyusut jadi sliver di layar 720p. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('web/index.html');
const terminal = read('web/creator_studio_terminal.css');
const polish = read('web/ui_polish.css');
const refresh = read('web/ui_refresh.css');
const app = read('web/app.js');

assert(html.includes('creator_studio_terminal.css?v=20261103-terminal-1')
  && html.includes('ui_refresh.css?v=20261103-intern-1')
  && html.includes('ui_polish.css?v=20261103-terminal-1')
  && html.includes('app.js?v=20261103-intern-1'), 'Asset cache keys are bumped so the live site picks up the terminal fix.');

assert(!terminal.includes('mask-image'), 'Tab row no longer fades/clips the last specialist tab.');
assert(terminal.includes('z-index: 1') && terminal.includes('padding: 3px 2px 14px'), 'Tabs sit clearly above the dark shell with a real gap.');
assert(terminal.includes('display: grid') && terminal.includes('"input send"') && terminal.includes('"tools hint"'), 'Composer uses a deliberate two-row grid.');
assert(terminal.includes('.creator-studio-terminal-form #creator-studio-chat-send') && polish.includes('.creator-studio-terminal-form #creator-studio-chat-send'), 'Send-button styling is scoped; crew-mode toggles keep their compact style.');
assert(!polish.includes('.creator-studio-terminal-form button {'), 'No late override re-styles the crew-mode buttons as big send buttons.');
assert(terminal.includes('max-height: 120px') && app.includes('Math.min(input.scrollHeight, 120)'), 'Auto-growing textarea is capped so the composer cannot eat the chat log.');
assert(refresh.includes('min-height:clamp(620px') && refresh.includes('min-height:220px'), 'Split and chat log keep a usable conversation height on 720p screens.');
assert(app.includes("'Tulis arahan untuk Studio Crew…'") && app.includes("'KIRIM KE CREW'"), 'Placeholder and send label are short enough for one line.');
assert(html.includes('Pilih tab specialist untuk chat pribadi') && html.includes('Terminal ini tidak menjalankan N100N'), 'Heading copy is concise; the long workflow detail moved to the note.');
assert(terminal.includes('grid-template-areas: "input" "send" "tools" "hint"'), 'Small screens stack the composer instead of wrapping it.');
assert(polish.includes('"desc desc"') && polish.includes('display: contents'), 'The heading grid still spans its description across the full panel width.');

console.log('Creator terminal layout verification passed: separated tab row, two-row composer, clamped textarea, and a usable chat log height.');
