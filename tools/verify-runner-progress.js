const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('web/index.html', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');

// 1. HTML must have a status badge for live progress
assert.match(html, /id="modal-exec-status"/, 'approval modal needs #modal-exec-status');

// 2. Spinner/typing helpers must exist (from earlier loading work)
assert.match(app, /function startTermSpinner\(/);
assert.match(app, /function startStatusSpinner\(/);
assert.match(app, /function typeIntoElement\(/);
assert.match(app, /KRA_REDUCED_MOTION/);

// 3. resolveTask must update the status badge across the approve/reject flow
const resolveIdx = app.indexOf('async function resolveTask(decision)');
assert.ok(resolveIdx !== -1, 'resolveTask not found');
const resolveEnd = app.indexOf('\n}\n\ndocument.getElementById(\'modal-btn-approve\')', resolveIdx);
assert.ok(resolveEnd !== -1, 'resolveTask end not found');
const resolveBody = app.slice(resolveIdx, resolveEnd);

assert.match(resolveBody, /modal-exec-status/, 'resolveTask must update status badge');
assert.match(resolveBody, /startStatusSpinner\(/, 'resolveTask must animate the badge');
assert.match(resolveBody, /startTermSpinner\(/, 'resolveTask must show a log spinner while awaiting the API');
assert.match(resolveBody, /typeIntoElement\(/, 'resolveTask must type out runner output');

console.log('KRA runner live progress verification passed.');
