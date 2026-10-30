'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const app = read('web/app.js');
const html = read('web/index.html');
const api = read('api/index.php');
const agentChat = read('api/lib/KraAgentChat.php');
const react = read('api/lib/KraReActEngine.php');
const providerExample = JSON.parse(read('api/config.example.json'));

const detectionStart = app.indexOf('function isCurrentInfoQuestion(');
const detectionEnd = app.indexOf('async function sendAgentChat(', detectionStart);
assert(detectionStart >= 0 && detectionEnd > detectionStart, 'Current-information detector is present');
const sandbox = {};
vm.runInNewContext(app.slice(detectionStart, detectionEnd) + '\nthis.isCurrentInfoQuestion = isCurrentInfoQuestion;', sandbox);
assert.equal(sandbox.isCurrentInfoQuestion('Saya ingin tahu cuaca hari ini di Klaten?'), true, 'Indonesian weather questions trigger live research');
assert.equal(sandbox.isCurrentInfoQuestion('What are the latest news today?'), true, 'Current news questions trigger live research');
assert.equal(sandbox.isCurrentInfoQuestion('Halo Rama, apa kabar?'), false, 'Ordinary conversation stays on the direct live chat path');

const terminalBranchStart = app.indexOf('// Natural language in the terminal pane is chat');
const terminalBranchEnd = app.indexOf('// Free chat is channel-aware', terminalBranchStart);
const terminalBranch = app.slice(terminalBranchStart, terminalBranchEnd);
assert(terminalBranch.includes('sendAgentChat(cmd, options);'), 'Plain terminal messages dispatch to live chat');
assert(!terminalBranch.includes('switchChatChannel(destination)'), 'Plain terminal messages do not jump to another conversation tab');
assert(app.includes("const stopThinking = channel === 'terminal'\n    ? startTermSpinner"), 'Terminal live-chat activity appears in the terminal output');
assert(app.includes("activeChatChannel === 'terminal' ? 'rama'"), 'Terminal ReAct uses Rama, whose tool policy allows web search');
assert(app.includes('log-chat') || api.includes("KraDb::logChat($sender"), 'Terminal/ReAct conversations are retained in chat history');
assert(react.includes("'web_search', 'web_fetch'"), 'Rama has web-research tools for current-information questions');
assert(api.includes("$action === 'react-chat'") && api.includes("$payload['channel'] ?? 'react'"), 'ReAct requests persist under the correct chat channel');

assert(app.includes('const naturalAppCreation') && app.includes('showProjectPathGate(cmd, cmd)'), 'Natural-language app requests enter the same project-location gate as /create-app');
assert(app.includes("lower.startsWith('/create-app')") && app.includes('proposeWithModel('), '/create-app generates an approval-gated proposal through the live model path');
assert(agentChat.includes("'provider' => $comp['provider']") && agentChat.includes("'allowSimulator' => false"), 'Ordinary chats use live provider output, not role-based canned replies');
assert(agentChat.includes('Live AI providers are unavailable; simulated replies are disabled for chat.'), 'Missing providers fail clearly instead of returning a template');
assert.equal(providerExample.defaultProvider, 'ollama', 'Fresh example configuration defaults to live local Ollama, not the simulator');
assert.equal(providerExample.providers.ollama.fallbackProvider, undefined, 'Ollama has no simulator fallback for natural chat');

for (const id of ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer']) {
  assert(app.includes("id: '" + id + "'") && agentChat.includes("'" + id + "' => ["), `${id} is a built-in Creator persona and local roster member`);
}
assert(html.includes('4 specialist agents ready') && !html.includes('id="creator-hire-agent"'), 'Creator Studio no longer requires a manual hire to populate the team');
assert(app.includes('data-open-creator-chat') && app.includes('openCreatorStudioTerminal(agentId)'), 'Creator cards open the dedicated in-Studio terminal without leaving Creator mode');
assert(app.includes("return 'creator_studio_' + (suffix || 'agent')") && app.includes("action=chat-agent"), 'Creator terminal messages use distinct Studio history channels and the live chat API');
assert(app.includes("CREATOR_STUDIO_GROUP_ID = 'creator_studio_team'") && app.includes('KIRIM KE STUDIO CREW'), 'Creator Studio has an explicit group chat addressed to all built-in specialists');
assert(app.includes("...(isGroup ? {} : { agentId })"), 'Creator Studio group dispatch does not collapse into a single-agent request');
assert(react.includes("'creator_research' => 'budi'"), 'Creator Research has a safe ReAct alias with web-search capability');

console.log('Chat-mode verification passed: live Team/private chat, direct terminal chat, current-info web research routing, natural-language app gate, and built-in Creator specialist channels.');
