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
const router = read('api/lib/KraRouterGateway.php');
const dispatcher = read('api/lib/KraModelDispatcher.php');
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
assert(agentChat.includes("$agent['workspace']['mode']") && agentChat.includes('isCreatorChannel'), 'Persisted Creator hires are resolved and chat channels are workspace-scoped');
assert(agentChat.includes('Creator specialists are only available in Content Creator mode.') && agentChat.includes('This Creator Studio channel can only route to its assigned Creator specialist.') && agentChat.includes('Unknown Creator specialist. Its profile must be saved to the KRA server roster before chat.'), 'Cross-mode and unsaved Creator profiles are rejected instead of falling back to Office personas');
assert(api.includes("$scope = in_array((string) $agent, $creatorBuiltins, true) || $creatorHire ? 'creator' : 'office'") && api.includes("['scope' => $scope]"), 'Chat-generated Creator proposals are assigned to the Creator task-board scope');
assert(app.includes("hired.workspace.mode = 'creator'") && app.includes("agent.workspace?.mode === 'creator'"), 'New Creator hires persist their distinct workspace mode and are hydrated separately from Office hires');
assert(api.includes("if (!KraDb::saveAgent($payload))") && api.includes("'The server database is unavailable; the agent profile was not saved.'"), 'Creator hire requests are reported successful only after server-side persistence succeeds');
assert(react.includes("['scope' => $creatorScope ? 'creator' : 'office']") && react.includes("$creatorMode = in_array(strtolower(trim($agentId)), array_keys(self::AGENT_ALIASES), true)"), 'Creator ReAct sessions and proposals remain within Creator identities and task-board scope');
assert(router.includes('FALLBACK_BUDGET_SECONDS = 55') && router.includes('CONNECT_TIMEOUT_SECONDS = 6') && router.includes('CURLOPT_CONNECTTIMEOUT'), 'Provider requests and fallback chains have bounded connection/wall-clock waits');
assert(router.includes("in_array($name, ['anthropic', 'gemini'], true)") && dispatcher.includes('completeChat') && dispatcher.includes('systemInstruction'), 'Anthropic and Gemini chat use their native API schemas instead of OpenAI-only endpoints');
assert(api.includes("'status' => 'not_checked'") && !api.includes('KraRouterGateway::health($providerName)'), 'Runtime bootstrap does not serially probe every configured provider');
assert(react.includes("$emitProgress('action'") && api.includes("unset($step['thought'])") && api.includes("'summary' => $summary") && app.includes("event.type === 'progress'") && app.includes('step.observation.summary'), 'ReAct shows safe live action summaries while keeping raw thoughts and tool output out of the browser trace');
assert(agentChat.includes("'elapsedMs' =>") && app.includes('completion.elapsedMs'), 'Chat surfaces real elapsed time for diagnosing slow replies');

console.log('Chat-mode verification passed: live Team/private chat, direct terminal chat, current-info web research routing, natural-language app gate, and built-in Creator specialist channels.');
