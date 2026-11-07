/* Minimal static server for KRA preview (no PHP). API calls return preview fixtures. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.php': 'application/json', '.mp4': 'video/mp4' };

const TOOL_SEED = {
  'Filesystem & Workspace': [['read_file', 'Read UTF-8 content of a workspace file'], ['write_file', 'Write or overwrite file with directory creation'], ['edit_file', 'Targeted search-and-replace edit on existing file'], ['list_dir', 'List files and directories with metadata'], ['grep_code', 'Ripgrep regex search in file contents']],
  'Terminal & Process': [['shell_exec', 'Execute allowlisted terminal command'], ['bash', 'Run bash / POSIX subshell script'], ['pty_stream', 'Stream interactive terminal session'], ['peek_terminal', 'Capture current buffer of active terminal screen']],
  'Git & Version Control': [['git_status', 'Inspect working tree status and branch'], ['git_diff', 'Generate unified diff against HEAD'], ['git_commit', 'Commit staged changes with message'], ['gh_pr_create', 'Create pull request with title and body']],
  'Code Intelligence': [['ast_parse', 'Parse source code into Abstract Syntax Tree'], ['find_references', 'Trace all usages of symbol across project'], ['test_run_unit', 'Run targeted test suite with assertion report']],
  'SSH Remote & sFTP': [['ssh_connect', 'Open secure SSH connection to remote host'], ['sftp_upload', 'Upload local workspace file to remote server'], ['ssh_tunnel', 'Establish port forwarding tunnel']],
  'Web Browser Automation': [['browser_goto', 'Navigate browser tab to target URL'], ['browser_click', 'Click element matching CSS selector'], ['browser_screenshot', 'Capture viewport screenshot PNG']],
  'Web & Network': [['web_search', 'Query internet search engine'], ['web_fetch', 'Fetch webpage content as markdown'], ['http_request', 'Send REST API request']],
  'MCP & Skills': [['mcp_call_tool', 'Dispatch tool call to configured MCP server'], ['skill_load', 'Inject skill prompt into agent instructions']],
  'Relay & Notifications': [['telegram_send', 'Send notification to Telegram'], ['whatsapp_send', 'Send message to WhatsApp relay']],
  'Task & Plan Management': [['task_decompose', 'Break requirement into sequential checklist'], ['task_stage_proposal', 'Stage file changes into Approval Gate']],
  'Security & Slop Audit': [['audit_workspace', 'Run security and code quality scan'], ['slop_score', 'Analyze AI-generated code for slop']]
};

function toolsFixture() {
  const tools = {};
  let n = 0;
  for (const [cat, list] of Object.entries(TOOL_SEED)) {
    for (const [name, description] of list) tools[name] = { name, category: cat, description, installed: true }, n++;
  }
  while (n < 212) { const name = 'agent_subtool_' + String(n + 1).padStart(3, '0'); tools[name] = { name, category: 'Autonomous Extensions', description: 'Specialized autonomous coding sub-routine #' + (n + 1), installed: true }; n++; }
  return { count: n, tools };
}

const MODELS = {
  DeepSeek: [{ id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', badge: 'Recommended', context: '64k context window', description: 'Cepat & hemat biaya untuk tugas pengkodean standar.' }, { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', badge: 'Reasoning', context: '64k context window', description: 'Penalaran mendalam langkah demi langkah.' }, { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', badge: 'Flagship', context: '128k context window', description: 'MoE terbaru untuk perbaikan bug multi-file.' }],
  OpenAI: [{ id: 'gpt-5.1-tone', name: 'GPT-5.1 Tone', badge: 'Recommended', context: '1000k context window', description: 'Model reasoning flagship untuk autonomous audit.' }, { id: 'gpt-4o', name: 'GPT-4o Omnimodal', badge: 'Fast', context: '128k context window', description: 'Kecepatan dan penalaran cerdas sehari-hari.' }],
  Copilot: [{ id: 'copilot-claude-3.5-sonnet', name: 'Copilot Claude 3.5 Sonnet', badge: 'Recommended', context: '200k context window', description: 'Standar industri penulisan kode dan review PR.' }],
  Antigravity: [{ id: 'combo-free', name: '9router / combo-free', badge: 'Active Local', context: '32k context window', description: 'Gateway routing hemat token dengan fallback otomatis.' }],
  Groq: [{ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', badge: 'Ultra Fast LPU', context: '128k context window', description: 'Inferensi >280 token/detik di Groq LPU.' }],
  Mistral: [{ id: 'codestral-latest', name: 'Codestral 2501', badge: 'Code Specialist', context: '256k context window', description: 'Dikhususkan untuk 80+ bahasa pemrograman.' }],
  Qwen: [{ id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', badge: 'Top Coding', context: '128k context window', description: 'Kemampuan pengkodean tier-1 dengan biaya efisien.' }],
  BYOK: [{ id: 'custom-openai-compatible', name: 'Custom OpenAI-Compatible API', badge: 'BYOK', context: 'Configurable', description: 'Endpoint sendiri: vLLM, LM Studio, Ollama, OpenRouter.' }]
};

const SESSIONS = [{
  id: 'session_audit_01', title: 'Audit struktur repo & status git', time: 'Baru', active: true, model: '9router / combo-free', mode: 'Agent',
  tasks: [],
  messages: []
}, { id: 'session_sec_02', title: 'Subagent: Security audit v2', time: '11:55', model: '9router / combo-free', mode: 'Auto', tasks: [], messages: [] }, { id: 'session_read_03', title: 'Subagent: Read-only verification', time: '08:25', model: '9router / combo-free', mode: 'Plan', tasks: [], messages: [] }];

const TASKS = { task_demo_1: { id: 'task_demo_1', title: 'Refactor auth middleware expiry check', status: 'WAITING_APPROVAL', targetFile: 'api/lib/KraAuth.php', agentId: 'budi' }, task_demo_2: { id: 'task_demo_2', title: 'Tambah endpoint studio-state', status: 'EXECUTED', targetFile: 'api/index.php', agentId: 'maya' } };

function stub(action) {
  switch (action) {
    case 'auth-status': return { ok: true, authenticated: true, user: { id: 'user_rama', username: 'rama', display_name: 'Rama (Preview)', role: 'supervisor' } };
    case 'studio-state': return { ok: true, toolCount: 212, tools: toolsFixture().tools, models: MODELS, harnessProfiles: {
      'chatgpt-codex': { id: 'chatgpt-codex', name: 'ChatGPT Codex Agent', provider: 'openai', defaultModel: 'gpt-5.1-tone', authType: 'oauth', description: 'Codex-grade autonomous agent with reasoning step decomposition.', active: true, badge: 'OAUTH CODEX' },
      'copilot-github': { id: 'copilot-github', name: 'GitHub Copilot Workspace', provider: 'github', defaultModel: 'copilot-claude-3.5-sonnet', authType: 'oauth', description: 'GitHub-native coding assistant with repo indexing and PR creation.', active: false, badge: 'GITHUB COPILOT' },
      'antigravity': { id: 'antigravity', name: 'Antigravity Orchestrator', provider: 'antigravity', defaultModel: 'combo-free', authType: 'native', description: 'Native local harness with 9router gateway and Code Mode runtime.', active: true, badge: 'ANTIGRAVITY NATIVE' },
      'byok-openai': { id: 'byok-openai', name: 'BYOK (OpenAI-Compatible)', provider: 'byok', defaultModel: 'custom-model', authType: 'api_key', description: 'Bring Your Own Key for any OpenAI-compatible gateway.', active: true, badge: 'BYOK OPENAI' }
    }, sessions: SESSIONS, relay: { whatsapp: { status: 'STANDBY' } } };
    case 'providers': return { ok: true, config: { providers: {
      '9router': { baseUrl: 'http://100.77.206.14:20128/v1', model: 'combo-free', availableModel: 'combo-free', apiKeyConfigured: true, configured: true, fallbackProvider: 'ollama' },
      openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKeyConfigured: false, configured: true },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest', apiKeyConfigured: false, configured: true }
    } } };
    case 'tasks': return { ok: true, tasks: TASKS };
    case 'task-preview': return { ok: true, targetFile: 'api/lib/KraAuth.php', beforeContent: "if ($expires < time()) {\n  return false;\n}", proposedContent: "if ($expires <= time()) {\n  return false;\n}\nreturn true;" };
    case 'skills': return { ok: true, skills: [{ id: 'antislop', name: 'Anti-Slop Coding', category: 'quality', description: 'Stop generic AI slop in generated code.' }, { id: 'taste-typography', name: 'Typography Craft', category: 'design', description: 'Pairing rules and fluid type scales.' }, { id: 'sql-optimization', name: 'SQL Optimization', category: 'database', description: 'Query tuning and indexing strategy.' }] };
    case 'workflow-list': return { ok: true, workflows: [{ id: 'wf_n100n', name: 'N100N Content Pipeline', status: 'active', description: 'Riset → naskah → storyboard → review', trigger: 'cron 08:00', stages: [1, 2, 3, 4] }, { id: 'wf_rna', name: 'RNA Router Route Sync', status: 'idle', description: 'Sinkronisasi model gateway', trigger: 'manual', stages: [1, 2] }] };
    case 'github-changer-status': return { ok: true, connected: false, appUrl: 'http://127.0.0.1:4173' };
    case 'github-changer-repos': return { ok: true, repos: [{ full_name: 'rama/kantor-rama-ai', private: true }, { full_name: 'rama/kra-studio', private: false }] };
    case 'github-changer-activity': return { ok: true, activity: [{ action: 'commit', summary: 'feat(studio): fullscreen agentic workstation' }, { action: 'push', summary: 'arena/cbf4b10e-kantor-rama-ai' }] };
    case 'workspace-files': return { ok: true, root: 'C:/xampp/htdocs/kantor-rama-ai', path: '', entries: [
      { name: 'api', path: 'api', kind: 'directory' }, { name: 'web', path: 'web', kind: 'directory' }, { name: 'tools', path: 'tools', kind: 'directory' },
      { name: 'package.json', path: 'package.json', kind: 'file', size: 2410 }, { name: 'README.md', path: 'README.md', kind: 'file', size: 3210 }
    ] };
    case 'workspace-read': return { ok: true, path: 'README.md', content: '# Kantor-Rama-AI\n\nAutonomous coding studio + virtual office.\n\n## Modules\n- web/index.html\n- api/index.php\n- api/lib/KraStudioEngine.php\n\n## Agentic Studio\nFullscreen workstation ala ODON/Codex.\n' };
    case 'terminal-run': return { ok: true, output: '## main...origin/main\n M web/index.html\n M web/kra_studio.css\n?? web/kra_studio.js', exitCode: 0 };
    case 'studio-ssh': return { ok: true, hosts: [{ id: 'host_local_01', name: 'KRA Local Workstation', host: '127.0.0.1', port: 22, user: 'developer', status: 'online', remotePath: '/var/www/kantor-rama-ai' }, { id: 'host_prod_stage', name: 'Staging Cloud Worker', host: '100.76.172.67', port: 2222, user: 'deploy', status: 'standby', remotePath: '/home/deploy/workspace' }] };
    case 'studio-browser': return { ok: true, installed: true, binary: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', lastUrl: 'http://127.0.0.1:80/kantor-rama-ai/web/index.html' };
    case 'studio-whatsapp': return { ok: true, enabled: true, status: 'STANDBY', targetChat: '+628123456789@s.whatsapp.net' };
    case 'studio-agent-run': return {
      ok: true,
      reasoning: 'Menganalisis instruksi: "git status -s"\nProfile harness aktif: Full Agentic | Model: GPT-5.1 Tone\nMendeteksi permintaan eksekusi terminal: git status -s\nMenjalankan subprocess di workspace: kantor-rama-ai\nEksekusi berhasil (exit code 0).',
      toolCalls: [{
        id: 'tc_' + Date.now(),
        tool: 'shell_exec',
        command: 'git status -s',
        status: 'COMPLETED',
        output: '## main...origin/main\n M web/index.html\n M web/app.js\n M web/style.css\n M web/office_stage.css'
      }],
      content: 'Perintah `git status -s` telah dieksekusi secara mandiri di workspace.\n\nStatus: 4 files modified.',
      diff: null
    };
    // This preview server has no PHP runtime, so it cannot run the real agent
    // loop. Say so instead of faking reasoning steps.
    case 'react-chat': return { ok: false, error: 'Preview server tanpa PHP: jalankan lewat XAMPP/Apache untuk agent live.' };
    default: return { ok: true, items: [] };
  }
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.startsWith('/api/')) {
    const action = new URL(req.url, 'http://127.0.0.1').searchParams.get('action') || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stub(action)));
  }
  let file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8080, '127.0.0.1', () => console.log('STATIC READY'));
