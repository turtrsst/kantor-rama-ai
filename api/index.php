<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/lib/KraAudit.php';
require_once __DIR__ . '/lib/KraAgentRegistry.php';
require_once __DIR__ . '/lib/KraDb.php';
require_once __DIR__ . '/lib/KraProjectPath.php';
require_once __DIR__ . '/lib/KraTaskEngine.php';
require_once __DIR__ . '/lib/KraTemplateRegistry.php';
require_once __DIR__ . '/lib/KraSkillLock.php';
require_once __DIR__ . '/lib/KraSkillHub.php';
require_once __DIR__ . '/lib/KraSkillEngine.php';
require_once __DIR__ . '/lib/KraModelDispatcher.php';
require_once __DIR__ . '/lib/KraRouterGateway.php';
require_once __DIR__ . '/lib/KraAgentChat.php';
require_once __DIR__ . '/lib/KraExecutionRunner.php';
require_once __DIR__ . '/lib/KraVaultSync.php';
require_once __DIR__ . '/lib/KraTerminalBridge.php';
require_once __DIR__ . '/lib/KraAuth.php';
require_once __DIR__ . '/lib/KraReActEngine.php';
require_once __DIR__ . '/lib/KraSemanticMemory.php';
require_once __DIR__ . '/lib/KraDatasetEngine.php';
require_once __DIR__ . '/lib/KraVisionEngine.php';
require_once __DIR__ . '/lib/KraWorkflowEngine.php';
require_once __DIR__ . '/lib/KraGitHubBridge.php';
require_once __DIR__ . '/lib/KraWebSearchBridge.php';
require_once __DIR__ . '/lib/KraRemotionBridge.php';
require_once __DIR__ . '/ProviderConfig.php';

function getProjectRoot(): string
{
    $root = realpath(__DIR__ . '/..');
    return $root !== false ? $root : getcwd();
}

function getMemoryRoot(): string
{
    $env = getenv('KRA_MEMORY_ROOT');
    if ($env && is_dir($env)) {
        return $env;
    }
    $candidate = 'C:' . DIRECTORY_SEPARATOR . 'vault' . DIRECTORY_SEPARATOR . 'KRA';
    return is_dir($candidate) ? $candidate : '';
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = $_GET['action'] ?? 'status';

try {
    $projectRoot = getProjectRoot();
    $memoryRoot = getMemoryRoot();
    KraAuth::seedDefaultOfficers();

    // Public surface stays limited to authentication and health checks.
    if (!in_array($action, ['status', 'login', 'register', 'auth-status'], true)) {
        KraAuth::requireUser();
    }

    if ($action === 'status') {
        respond([
            'ok' => true,
            'service' => 'KRA Local Bridge',
            'projectRoot' => $projectRoot,
            'memoryRoot' => $memoryRoot,
            'projectExists' => is_dir($projectRoot),
            'memoryExists' => $memoryRoot !== '' && is_dir($memoryRoot),
            'readOnlyAudit' => true,
        ]);
    }

    if ($action === 'agents') {
        respond([
            'ok' => true,
            'agents' => KraAgentRegistry::all(),
        ]);
    }

    if ($action === 'presence') {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            respond(['ok' => true, 'presence' => KraDb::getPresence(), 'events' => KraDb::getAgentEvents()]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'presence requires GET or POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        if (isset($payload['presence'])) KraDb::savePresence($payload['presence']);
        if (isset($payload['event'])) KraDb::saveAgentEvent($payload['event']);
        respond(['ok' => true, 'saved' => true]);
    }

    if ($action === 'save-agent') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'save-agent requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        KraDb::saveAgent($payload);
        respond(['ok' => true, 'saved' => true]);
    }

    if ($action === 'hired-agents') {
        respond(['ok' => true, 'agents' => KraDb::getHiredAgents()]);
    }

    if ($action === 'log-chat') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'log-chat requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        KraDb::logChat(
            (string) ($payload['sender'] ?? 'User'),
            (string) ($payload['message'] ?? ''),
            (string) ($payload['channel'] ?? 'office')
        );
        respond(['ok' => true]);
    }

    if ($action === 'chat-history') {
        $channel = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['channel'] ?? 'team'));
        $limit = (int) ($_GET['limit'] ?? 50);
        respond([
            'ok' => true,
            'channel' => $channel !== '' ? $channel : 'team',
            'messages' => KraDb::getChatHistory($channel !== '' ? $channel : 'team', $limit),
        ]);
    }

    if ($action === 'react-chat') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'react-chat requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        $agent = (string) ($payload['agentId'] ?? 'budi');
        $message = (string) ($payload['message'] ?? '');
        $maxTurns = (int) ($payload['maxTurns'] ?? 6);
        $chainHandoff = (bool) ($payload['chainHandoff'] ?? true);
        if ($message === '') {
            respond(['ok' => false, 'error' => 'Message is required.'], 400);
        }
        respond(KraReActEngine::runLoop($agent, $message, $maxTurns, $chainHandoff));
    }

    if ($action === 'chat-agent') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'chat-agent requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        respond(KraAgentChat::dispatch($payload));
    }

    if ($action === 'tasks') {
        respond([
            'ok' => true,
            'tasks' => KraTaskEngine::loadTasks(),
        ]);
    }

    if ($action === 'auth-status') {
        $user = KraAuth::authenticate();
        respond([
            'ok' => true,
            'authenticated' => $user !== null,
            'user' => $user,
        ]);
    }

    if ($action === 'login') {
        $user = KraAuth::login($_POST['username'] ?? '', $_POST['password'] ?? '');
        if ($user) {
            if (isset($user['error'])) {
                respond(['ok' => false, 'error' => $user['error']]);
            } else {
                respond(['ok' => true, 'token' => $user['token'], 'user' => $user['user']]);
            }
        } else {
            respond(['ok' => false, 'error' => 'Username atau password salah']);
        }
    }

    if ($action === 'register') {
        $res = KraAuth::register($_POST);
        respond(['ok' => isset($res['success']), 'error' => $res['error'] ?? null]);
    }

    if ($action === 'auth-officers') {
        respond([
            'ok' => true,
            'officers' => KraAuth::getOfficerDirectory(),
        ]);
    }

    if ($action === 'decorations') {
        $user = KraAuth::requireUser();
        $floor = (int) ($_GET['floor'] ?? 1);
        respond([
            'ok' => true,
            'floor' => $floor,
            'owner' => $user['id'],
            'items' => KraDb::getDecorations($floor, $user['id']),
        ]);
    }

    if ($action === 'save-decor') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'save-decor requires POST.'], 405);
        }
        $user = KraAuth::requireUser();
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $floor = (int) ($payload['floor'] ?? 1);
        $tileX = (int) ($payload['x'] ?? 0);
        $tileY = (int) ($payload['y'] ?? 0);
        $item = (string) ($payload['item'] ?? '');
        // Client-supplied owner is deliberately ignored to prevent IDOR vulnerabilities
        KraDb::saveDecoration($floor, $tileX, $tileY, $item, $user['id']);
        respond(['ok' => true, 'saved' => true, 'owner' => $user['id']]);
    }

    if ($action === 'clear-decor') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'clear-decor requires POST.'], 405);
        }
        $user = KraAuth::requireUser();
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $floor = (int) ($payload['floor'] ?? 1);
        KraDb::clearDecorations($floor, $user['id']);
        respond(['ok' => true, 'cleared' => true, 'owner' => $user['id']]);
    }

    if ($action === 'runtime') {
        $memoryRoot = getMemoryRoot();
        $memoryWritable = $memoryRoot !== '' && is_writable($memoryRoot);
        $providerConfig = ProviderConfig::load();
        $providerSummary = [];
        foreach (($providerConfig['providers'] ?? []) as $providerName => $dummy) {
            $providerSummary[$providerName] = KraRouterGateway::health($providerName);
        }
        respond([
            'ok' => true,
            'service' => 'KRA Local Bridge',
            'php' => PHP_VERSION,
            'projectRoot' => $projectRoot,
            'database' => KraDb::connect() instanceof PDO,
            'taskCount' => count(KraTaskEngine::loadTasks()),
            'executionStates' => ['WAITING_APPROVAL', 'EXECUTING', 'EXECUTED', 'FAILED', 'REJECTED'],
            'memoryRoot' => $memoryRoot,
            'memoryRootFromEnv' => (string) getenv('KRA_MEMORY_ROOT') !== '',
            'memoryExists' => $memoryRoot !== '' && is_dir($memoryRoot),
            'memoryWritable' => $memoryWritable,
            'defaultProvider' => (string) ($providerConfig['defaultProvider'] ?? ''),
            'providers' => $providerSummary,
        ]);
    }

    if ($action === 'model-propose') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Model proposals require POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        $provider = (string) ($payload['provider'] ?? ProviderConfig::load()['defaultProvider'] ?? '');
        if ($provider === '9router') {
            try {
                $result = KraRouterGateway::complete($payload);
            } catch (Throwable $error) {
                $config = ProviderConfig::load();
                $fallback = (string) ($config['providers']['9router']['fallbackProvider'] ?? '');
                if ($fallback === '' || $fallback === '9router') throw $error;
                $result = KraRouterGateway::complete(array_replace($payload, ['provider' => $fallback]));
                $result['fallbackFrom'] = '9router';
            }
        } else {
            $result = KraModelDispatcher::propose($payload);
        }
        respond(['ok' => true, 'result' => $result]);
    }

    if ($action === 'router-health') {
        respond(['ok' => true, 'health' => KraRouterGateway::health()]);
    }

    if ($action === 'router-models') {
        respond(['ok' => true, 'catalog' => KraRouterGateway::models()]);
    }

    if ($action === 'vault-sync') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Vault sync requires POST.'], 405);
        }
        respond(KraVaultSync::sync($projectRoot));
    }

    if ($action === 'meeting-record') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'meeting-record requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $topic = (string) ($payload['topic'] ?? 'Executive Alignment');
        $participants = (array) ($payload['participants'] ?? ['Rama', 'Jarvis']);
        $dialogues = (array) ($payload['dialogues'] ?? []);
        $verdict = (string) ($payload['verdict'] ?? 'APPROVED');
        $actionItems = (array) ($payload['actionItems'] ?? []);
        respond(KraVaultSync::recordMeeting($topic, $participants, $dialogues, $verdict, $actionItems));
    }

    if ($action === 'vault-recall') {
        $query = (string) ($_GET['q'] ?? '');
        $mode = (string) ($_GET['mode'] ?? 'semantic');
        if ($mode === 'semantic') {
            respond([
                'ok' => true,
                'mode' => 'semantic_rag',
                'results' => KraSemanticMemory::recall($query),
            ]);
        }
        respond(KraVaultSync::recall($query));
    }

    if ($action === 'dataset-export') {
        respond(KraDatasetEngine::exportDataset());
    }

    if ($action === 'vision-inspect') {
        respond(KraVisionEngine::captureAndInspect($projectRoot));
    }

    if ($action === 'workflow-create') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'workflow-create requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $title = (string) ($payload['title'] ?? 'Autonomous Swarm Plan');
        $nodes = (array) ($payload['nodes'] ?? []);
        respond(KraWorkflowEngine::create($title, $nodes));
    }

    if ($action === 'workflow-plan') {
        $id = (string) ($_GET['id'] ?? '');
        respond(KraWorkflowEngine::plan($id));
    }

    if ($action === 'workflow-stage') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'workflow-stage requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $id = (string) ($payload['id'] ?? '');
        $wave = (int) ($payload['wave'] ?? 0);
        respond(KraWorkflowEngine::stageWave($id, $wave));
    }

    if ($action === 'vault-dashboard') {
        $vaultDir = KraVaultSync::getVaultDir();
        $dashFile = $vaultDir !== '' ? ($vaultDir . DIRECTORY_SEPARATOR . 'Dashboard KRA Project.md') : '';
        $found = $dashFile !== '' && is_file($dashFile);
        $content = $found ? (string) file_get_contents($dashFile) : '';
        $milestoneCount = (int) preg_match_all('/^\d+\.\s+\*\*/m', $content);
        $reportCount = (int) preg_match_all('/^\|\s*2026-\d{2}-\d{2}\s*\|/m', $content);
        respond([
            'ok' => true,
            'vault' => $vaultDir,
            'connected' => $found,
            'milestones' => $milestoneCount,
            'reports' => $reportCount,
            'systemStatus' => $found ? 'Memory Connected: Dashboard KRA' : 'Vault Offline',
        ]);
    }

    if ($action === 'project-path') {
        $mode = (string) ($_GET['mode'] ?? 'suggest');
        if ($mode === 'browse') {
            $dir = (string) ($_GET['dir'] ?? KraProjectPath::projectsRoot());
            respond(['ok' => true] + KraProjectPath::browse($dir));
        }
        if ($mode === 'check') {
            respond(KraProjectPath::validate((string) ($_GET['path'] ?? '')));
        }
        $name = (string) ($_GET['name'] ?? 'aplikasi-baru');
        $suggested = KraProjectPath::suggest($name);
        respond(['ok' => true, 'projectsRoot' => KraProjectPath::projectsRoot(), 'suggested' => $suggested]
            + KraProjectPath::validate($suggested));
    }

    if ($action === 'terminal-run') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Terminal execution requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        $command = (string) ($payload['command'] ?? '');
        respond(KraTerminalBridge::run($command, $projectRoot));
    }

    if ($action === 'propose') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true) ?: $_POST;
        $agent = $payload['agentId'] ?? $_GET['agentId'] ?? 'creator';
        $type = $payload['actionType'] ?? $_GET['actionType'] ?? 'create';
        $title = $payload['title'] ?? $_GET['title'] ?? 'Proposed change';
        $target = $payload['targetFile'] ?? $_GET['targetFile'] ?? 'scratch.txt';
        $content = $payload['proposedContent'] ?? $_GET['proposedContent'] ?? '';
        $summary = $payload['summary'] ?? $_GET['summary'] ?? 'Pending approval';
        $taskProjectRoot = isset($payload['projectRoot']) ? trim((string) $payload['projectRoot']) : '';
        if ($taskProjectRoot !== '') {
            $pathCheck = KraProjectPath::validate($taskProjectRoot);
            if (!($pathCheck['ok'] ?? false)) {
                respond([
                    'ok' => false,
                    'error' => 'Project path rejected: ' . implode(' ', $pathCheck['reasons']),
                    'projectPath' => $pathCheck,
                ], 400);
            }
            $taskProjectRoot = $pathCheck['path'];
        } else {
            $taskProjectRoot = null;
        }

        $task = KraTaskEngine::propose($agent, $type, $title, $target, $content, $summary, $taskProjectRoot);
        respond(['ok' => true, 'task' => $task]);
    }

    if ($action === 'approve' || $action === 'reject') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Approval decisions require POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $taskId = (string) ($payload['taskId'] ?? '');
        if ($taskId === '') {
            respond(['ok' => false, 'error' => 'Missing taskId parameter.'], 400);
        }
        if ($action === 'approve') {
            $task = KraTaskEngine::approve($taskId, 'Boss/User');
        } else {
            $task = KraTaskEngine::reject($taskId, 'Rejected by user');
        }
        respond(['ok' => true, 'task' => $task]);
    }

    if ($action === 'undo') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Undo requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $taskId = (string) ($payload['taskId'] ?? '');
        if ($taskId === '') {
            respond(['ok' => false, 'error' => 'Missing taskId parameter.'], 400);
        }
        respond(['ok' => true, 'task' => KraTaskEngine::undo($taskId)]);
    }

    if ($action === 'providers') {
        respond(['ok' => true, 'config' => ProviderConfig::load()]);
    }

    if ($action === 'templates') {
        respond([
            'ok' => true,
            'count' => count(KraTemplateRegistry::listTemplates()),
            'templates' => KraTemplateRegistry::listTemplates(),
        ]);
    }

    if ($action === 'skills') {
        $catalog = KraSkillEngine::catalog();
        $agentId = strtolower(trim((string) ($_GET['agentId'] ?? '')));
        $query = (string) ($_GET['q'] ?? '');
        $pending = [];
        foreach ($catalog as $id => $skill) {
            if (($skill['approved'] ?? false) !== true) {
                $pending[] = $id;
            }
        }
        respond([
            'ok' => true,
            'count' => count($catalog),
            'approved' => count($catalog) - count($pending),
            'pending' => $pending,
            'skills' => $catalog,
            'active' => $agentId !== '' ? KraSkillEngine::activeFor($agentId, $query) : [],
            'mode' => KraSkillEngine::mode($query),
        ]);
    }

    if ($action === 'skill-read') {
        $id = (string) ($_GET['id'] ?? '');
        $content = KraSkillEngine::read($id);
        if ($content === null) {
            respond(['ok' => false, 'error' => 'Unknown or unsafe skill id.'], 404);
        }
        respond(['ok' => true, 'id' => $id, 'content' => $content]);
    }

    if ($action === 'skill-hub') {
        respond([
            'ok' => true,
            'hub' => KraSkillEngine::hubState(),
        ]);
    }

    if ($action === 'skill-toggle') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Skill toggle requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $catalog = KraSkillEngine::catalog();
        if (($payload['approved'] ?? false) === true) {
            $applied = KraSkillHub::apply($payload, $catalog);
            if (!($applied['ok'] ?? false)) {
                respond($applied, 400);
            }
            respond($applied);
        }
        $preview = KraSkillHub::preview($payload, $catalog);
        if (!($preview['ok'] ?? false)) {
            respond($preview, 400);
        }
        respond($preview);
    }

    if ($action === 'audit') {
        $target = $_GET['target'] ?? $projectRoot;
        $real = realpath($target);
        if ($real === false || !str_starts_with(strtolower($real), strtolower($projectRoot))) {
            respond([
                'ok' => false,
                'error' => 'Target path must be inside project root: ' . $projectRoot,
            ], 400);
        }
        respond([
            'ok' => true,
            'audit' => KraAudit::run($real),
        ]);
    }

    $available = 'status, agents, save-agent, hired-agents, log-chat, chat-history, '
        . 'chat-agent, tasks, propose, model-propose, router-health, router-models, '
        . 'approve, reject, undo, presence, meeting-record, skills, skill-read, skill-hub, '
        . 'skill-toggle, providers, audit, templates.';
    respond([
        'ok' => false,
        'error' => 'Unknown action: ' . $action . '. Available: ' . $available,
    ], 404);
} catch (Throwable $e) {
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
