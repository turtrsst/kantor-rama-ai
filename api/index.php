<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');

require_once __DIR__ . '/lib/KraAudit.php';
require_once __DIR__ . '/lib/KraAgentRegistry.php';
require_once __DIR__ . '/lib/KraDb.php';
require_once __DIR__ . '/lib/KraProjectPath.php';
require_once __DIR__ . '/lib/KraTaskEngine.php';
require_once __DIR__ . '/lib/KraWorkspaceBrowser.php';
require_once __DIR__ . '/lib/KraTemplateRegistry.php';
require_once __DIR__ . '/lib/KraSkillLock.php';
require_once __DIR__ . '/lib/KraSkillHub.php';
require_once __DIR__ . '/lib/KraSkillEngine.php';
require_once __DIR__ . '/lib/KraModelDispatcher.php';
require_once __DIR__ . '/lib/KraRouterGateway.php';
require_once __DIR__ . '/lib/KraAgentChat.php';
require_once __DIR__ . '/lib/KraExecutionRunner.php';
require_once __DIR__ . '/lib/KraVaultSettings.php';
require_once __DIR__ . '/lib/KraVaultSync.php';
require_once __DIR__ . '/lib/KraTerminalBridge.php';
require_once __DIR__ . '/lib/KraAuth.php';
require_once __DIR__ . '/lib/KraReActEngine.php';
require_once __DIR__ . '/lib/KraSemanticMemory.php';
require_once __DIR__ . '/lib/KraDatasetEngine.php';
require_once __DIR__ . '/lib/KraVisionEngine.php';
require_once __DIR__ . '/lib/KraWorkflowEngine.php';
require_once __DIR__ . '/lib/KraCreatorWorkflowFactory.php';
require_once __DIR__ . '/lib/KraIntegrationSettings.php';
require_once __DIR__ . '/lib/KraYouTubeOAuth.php';
require_once __DIR__ . '/lib/KraN100nClient.php';
require_once __DIR__ . '/lib/KraGitHubBridge.php';
require_once __DIR__ . '/lib/KraWebSearchBridge.php';
require_once __DIR__ . '/lib/KraRemotionBridge.php';
require_once __DIR__ . '/lib/KraFlowBridge.php';
require_once __DIR__ . '/ProviderConfig.php';

function getProjectRoot(): string
{
    $root = realpath(__DIR__ . '/..');
    return $root !== false ? $root : getcwd();
}

function getMemoryRoot(): string
{
    return KraVaultSync::getVaultDir();
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function requireSupervisorRole(?array $user): void
{
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    if (!preg_match('/(^|[^a-z])(admin|administrator|supervisor|boss|owner)([^a-z]|$)/', $role)) {
        respond(['ok' => false, 'error' => 'Supervisor or administrator role required.'], 403);
    }
}

$action = $_GET['action'] ?? 'status';

try {
    $projectRoot = getProjectRoot();
    $memoryRoot = getMemoryRoot();
    // No built-in or predictable pairing credentials are created here.
    // Accounts and bearer sessions come only from the configured SIAS identity source.

    // Queue/flow endpoints are machine-to-machine. The Creator Studio N100N
    // controls use a KRA bearer session; the N100N service key stays in PHP.
    $currentUser = null;
    $aksiFlowMesin = ['flow-kategori', 'flow-tugas', 'flow-selesai', 'flow-status'];
    $aksiN100nStudio = ['n100n-status', 'n100n-workflows', 'n100n-run', 'n100n-execution'];
    $publicActions = ['status', 'login', 'register', 'auth-status', 'youtube-oauth-callback'];
    if (in_array($action, $aksiFlowMesin, true)) {
        $kunciMesin = trim((string) (getenv('KRA_FLOW_API_KEY') ?: getenv('KRA_API_KEY') ?: ''));
        $kunciKirim = trim((string) ($_SERVER['HTTP_X_API_KEY'] ?? ''));
        if ($kunciMesin === '' || !hash_equals($kunciMesin, $kunciKirim)) {
            respond(['ok' => false, 'error' => 'x-api-key tidak cocok.'], 401);
        }
        $currentUser = [
            'id' => 'n100n-bridge',
            'username' => 'n100n',
            'display_name' => 'n100n bridge',
            'role' => 'supervisor',
        ];
    } elseif (in_array($action, $aksiN100nStudio, true)) {
        $kunciMesin = trim((string) (getenv('KRA_FLOW_API_KEY') ?: getenv('KRA_API_KEY') ?: ''));
        $kunciKirim = trim((string) ($_SERVER['HTTP_X_API_KEY'] ?? ''));
        if ($kunciMesin !== '' && $kunciKirim !== '' && hash_equals($kunciMesin, $kunciKirim)) {
            // Preserve trusted machine access without exposing this key to browsers.
            $currentUser = [
                'id' => 'n100n-bridge',
                'username' => 'n100n',
                'display_name' => 'n100n bridge',
                'role' => 'supervisor',
            ];
        } else {
            $currentUser = KraAuth::requireUser();
        }
    } elseif (!in_array($action, $publicActions, true)) {
        $currentUser = KraAuth::requireUser();
    }

    if ($action === 'youtube-oauth-callback') {
        KraYouTubeOAuth::callback();
    }

    if ($action === 'youtube-config') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status()]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-config requires GET or POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        try {
            KraIntegrationSettings::saveYoutubeCredentials(
                (string) ($payload['client_id'] ?? ''),
                array_key_exists('client_secret', $payload) ? (string) $payload['client_secret'] : null,
                (string) ($payload['redirect_uri'] ?? ''),
            );
            respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status(), 'message' => 'Google OAuth settings saved securely on the KRA server.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        }
    }

    if ($action === 'youtube-oauth-start') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-oauth-start requires POST.'], 405);
        try {
            respond(['ok' => true, 'authorization_url' => KraYouTubeOAuth::authorizationUrl((int) ($currentUser['id'] ?? 0))]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        }
    }

    if ($action === 'youtube-status') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') respond(['ok' => false, 'error' => 'youtube-status requires GET.'], 405);
        respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status()]);
    }

    if ($action === 'youtube-disconnect') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-disconnect requires POST.'], 405);
        KraYouTubeOAuth::disconnect();
        respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status(), 'message' => 'YouTube channel disconnected and the stored Google token was revoked when the provider was reachable.']);
    }

    if ($action === 'n100n-config') {
        requireSupervisorRole($currentUser);
        if (($currentUser['id'] ?? '') === 'n100n-bridge') respond(['ok' => false, 'error' => 'Use an authenticated KRA administrator session to change integration settings.'], 403);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $settings = KraIntegrationSettings::n100n();
            respond(['ok' => true, 'n100n' => [
                'baseUrl' => KraIntegrationSettings::publicN100nBaseUrl(),
                'configured' => $settings['apiKey'] !== '',
                'environmentManaged' => (string) getenv('KRA_N100N_BASE_URL') !== '' || (string) getenv('KRA_N100N_URL') !== '' || (string) getenv('KRA_N100N_API_KEY') !== '' || (string) getenv('KRA_N100N_TOKEN') !== '',
            ]]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'n100n-config requires GET or POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        try {
            KraIntegrationSettings::saveN100n((string) ($payload['base_url'] ?? ''), array_key_exists('api_key', $payload) ? (string) $payload['api_key'] : null, !empty($payload['clear_key']));
            $settings = KraIntegrationSettings::n100n();
            respond(['ok' => true, 'n100n' => ['baseUrl' => KraIntegrationSettings::publicN100nBaseUrl(), 'configured' => $settings['apiKey'] !== ''], 'message' => 'N100N settings saved securely on the KRA server.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    if ($action === 'status') {
        respond([
            'ok' => true,
            'service' => 'KRA Local Bridge',
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
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'save-agent requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (empty($payload['id']) || empty($payload['name']) || empty($payload['role'])) {
            respond(['ok' => false, 'error' => 'Agent id, name, and role are required.'], 400);
        }
        if (!KraDb::saveAgent($payload)) {
            respond(['ok' => false, 'saved' => false, 'error' => 'The server database is unavailable; the agent profile was not saved.'], 503);
        }
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
        $provider = (string) ($payload['provider'] ?? '');
        $model = (string) ($payload['model'] ?? '');
        $channel = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($payload['channel'] ?? 'react')) ?: 'react';
        if ($message === '') {
            respond(['ok' => false, 'error' => 'Message is required.'], 400);
        }
        $streamReact = ($_GET['stream'] ?? '') === '1';
        $emitReact = null;
        if ($streamReact) {
            @set_time_limit(0);
            while (ob_get_level() > 0) ob_end_clean();
            @ini_set('zlib.output_compression', '0');
            header('Content-Type: application/x-ndjson; charset=utf-8');
            header('Cache-Control: no-cache, no-transform');
            header('X-Accel-Buffering: no');
            $emitReact = static function (array $event): void {
                echo json_encode($event, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
                if (function_exists('ob_flush')) @ob_flush();
                flush();
            };
        }
        KraDb::logChat('User', $message, $channel);
        try {
            $reactResult = KraReActEngine::runLoop(
                $agent, $message, $maxTurns, $chainHandoff, $provider, $model,
                $streamReact ? static function (array $progress) use ($emitReact): void {
                    $emitReact(['type' => 'progress', 'progress' => $progress]);
                } : null
            );
            $creatorNames = ['creator_research' => 'Nara', 'creator_writer' => 'Aruna', 'creator_producer' => 'Dito', 'creator_reviewer' => 'Lintang'];
            $sender = $creatorNames[$agent] ?? match (strtolower($agent)) {
                'rama' => 'Rama', 'maya', 'modifier' => 'Maya', 'dimas', 'auditor' => 'Dimas', 'siti', 'ops' => 'Siti', default => 'Budi'
            };
            KraDb::logChat($sender, (string) ($reactResult['finalAnswer'] ?? ''), $channel);
            if (isset($reactResult['trace']) && is_array($reactResult['trace'])) {
                foreach ($reactResult['trace'] as &$step) {
                    unset($step['thought']);
                    if (isset($step['action'])) {
                        unset($step['input']);
                        $observation = is_array($step['observation'] ?? null) ? $step['observation'] : [];
                        $summary = !empty($observation['ok']) ? 'Action completed; result reviewed.' : 'Action did not complete; the agent adjusted its plan.';
                        if (!empty($observation['task']) && is_array($observation['task'])) {
                            $step['observation'] = ['ok' => true, 'summary' => 'Proposal staged and waiting for approval.', 'task' => $observation['task']];
                        } else {
                            $step['observation'] = ['ok' => (bool) ($observation['ok'] ?? false), 'summary' => $summary];
                        }
                    } else {
                        $step['progress'] = 'Final response prepared.';
                    }
                }
                unset($step);
            }
            if ($streamReact) {
                $emitReact(['type' => 'done', 'ok' => true, 'result' => $reactResult]);
                exit;
            }
            respond($reactResult);
        } catch (Throwable $e) {
            if ($streamReact) {
                $emitReact(['type' => 'error', 'ok' => false, 'error' => $e instanceof InvalidArgumentException ? $e->getMessage() : 'ReAct request failed. Check provider status and server logs.']);
                exit;
            }
            throw $e;
        }
    }

    if ($action === 'chat-agent') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'chat-agent requires POST.'], 405);
        }
        $rawChatBody = (string) file_get_contents('php://input');
        if (strlen($rawChatBody) > 8 * 1024 * 1024) {
            respond(['ok' => false, 'error' => 'Chat attachments exceed the 8 MB request limit.'], 413);
        }
        $payload = json_decode($rawChatBody, true) ?: [];
        if (($_GET['stream'] ?? '') === '1') {
            @set_time_limit(0);
            while (ob_get_level() > 0) ob_end_clean();
            @ini_set('zlib.output_compression', '0');
            header('Content-Type: application/x-ndjson; charset=utf-8');
            header('Cache-Control: no-cache, no-transform');
            header('X-Accel-Buffering: no');
            $emit = static function (array $event): void {
                echo json_encode($event, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
                if (function_exists('ob_flush')) @ob_flush();
                flush();
            };
            try {
                $result = KraAgentChat::dispatch(
                    $payload,
                    static function (array $reply, int $index, int $total) use ($emit): void {
                        $emit(['type' => 'reply', 'reply' => $reply, 'index' => $index, 'total' => $total]);
                    },
                    static function (array $progress) use ($emit): void {
                        $emit(['type' => 'progress', 'progress' => $progress]);
                    }
                );
                $emit(['type' => 'done', 'ok' => true, 'channel' => $result['channel'], 'provider' => $result['provider'], 'elapsedMs' => $result['elapsedMs'] ?? null]);
            } catch (Throwable $e) {
                $message = $e instanceof InvalidArgumentException
                    ? $e->getMessage()
                    : 'Chat could not start. Check the selected live provider and server logs.';
                $emit(['type' => 'error', 'ok' => false, 'error' => $message]);
            }
            exit;
        }
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

    if ($action === 'logout') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'logout requires POST.'], 405);
        }
        if (!KraAuth::logout()) {
            respond(['ok' => false, 'error' => 'Could not revoke the current session on the server.'], 503);
        }
        respond(['ok' => true, 'loggedOut' => true]);
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
        $memorySettings = KraVaultSettings::current();
        $runtimeRole = strtolower(trim((string) ($currentUser['role'] ?? '')));
        $canViewMemoryPath = preg_match('/(^|[^a-z])(admin|administrator|supervisor|boss|owner)([^a-z]|$)/', $runtimeRole) === 1;
        $memoryWritable = $memoryRoot !== '' && is_writable($memoryRoot);
        $providerConfig = ProviderConfig::load();
        $providerSummary = [];
        foreach (($providerConfig['providers'] ?? []) as $providerName => $provider) {
            $providerSummary[$providerName] = [
                'provider' => (string) $providerName,
                'configured' => (bool) ($provider['configured'] ?? false),
                'online' => null,
                'status' => 'not_checked',
            ];
        }
        respond([
            'ok' => true,
            'service' => 'KRA Local Bridge',
            'php' => PHP_VERSION,
            'projectRoot' => $projectRoot,
            'database' => KraDb::connect() instanceof PDO,
            'taskCount' => count(KraTaskEngine::loadTasks()),
            'executionStates' => ['WAITING_APPROVAL', 'EXECUTING', 'EXECUTED', 'FAILED', 'REJECTED'],
            'memoryRoot' => $canViewMemoryPath ? $memoryRoot : '',
            'memoryRootFromEnv' => $memorySettings['source'] === 'environment',
            'memoryRootSource' => $memorySettings['source'],
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
        $provider = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['provider'] ?? ''));
        respond(['ok' => true, 'health' => KraRouterGateway::health($provider)]);
    }

    if ($action === 'router-models') {
        $provider = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['provider'] ?? ''));
        respond(['ok' => true, 'catalog' => KraRouterGateway::models($provider)]);
    }

    if ($action === 'vault-settings') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'vault-settings requires GET.'], 405);
        }
        respond(['ok' => true] + KraVaultSettings::current());
    }

    if ($action === 'vault-browse') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'vault-browse requires GET.'], 405);
        }
        try {
            respond(['ok' => true] + KraVaultSettings::browse((string) ($_GET['path'] ?? '')));
        } catch (InvalidArgumentException $error) {
            respond(['ok' => false, 'error' => $error->getMessage()], 400);
        }
    }

    if ($action === 'vault-select') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'vault-select requires POST.'], 405);
        }
        $rawVaultBody = (string) file_get_contents('php://input');
        if (strlen($rawVaultBody) > 8192) respond(['ok' => false, 'error' => 'Vault setting request is too large.'], 413);
        $payload = json_decode($rawVaultBody, true);
        if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
            respond(['ok' => false, 'error' => 'Vault selection must be valid JSON.'], 400);
        }
        try {
            respond(['ok' => true] + KraVaultSettings::save((string) ($payload['path'] ?? '')));
        } catch (InvalidArgumentException $error) {
            respond(['ok' => false, 'error' => $error->getMessage()], 400);
        }
    }

    if ($action === 'vault-sync') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Vault sync requires POST.'], 405);
        }
        respond(KraVaultSync::sync($projectRoot));
    }

    if ($action === 'meeting-record') {
        requireSupervisorRole($currentUser);
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

    if ($action === 'workflow-list') {
        respond(['ok' => true, 'workflows' => KraWorkflowEngine::listWorkflows()]);
    }

    if ($action === 'workflow-create') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'workflow-create requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $title = (string) ($payload['title'] ?? 'Autonomous Swarm Plan');
        $nodes = !empty($payload['creatorStarter'])
            ? KraCreatorWorkflowFactory::starterNodes($title)
            : (array) ($payload['nodes'] ?? []);
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

    if ($action === 'n100n-status') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'n100n-status requires GET.'], 405);
        }
        $status = KraN100nClient::status();
        $connected = (bool) ($status['ok'] ?? false);
        respond([
            'ok' => true,
            'connected' => $connected,
            'configured' => (bool) ($status['configured'] ?? false),
            'message' => $connected
                ? 'KRA can reach the N100N service.'
                : (string) ($status['error'] ?? 'N100N is not reachable from the KRA server.'),
            'n100n' => $status,
            'antrean' => KraFlowBridge::ringkasan(),
        ]);
    }

    if ($action === 'n100n-workflows') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'n100n-workflows requires GET.'], 405);
        }
        try {
            $response = KraN100nClient::workflows();
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'N100N workflow list failed: ' . $e->getMessage()], 502);
        }
        $workflows = $response['workflows'] ?? $response['data'] ?? $response;
        if (!is_array($workflows)) $workflows = [];
        $workflows = array_values(array_filter($workflows, 'is_array'));
        respond(['ok' => true, 'workflows' => $workflows]);
    }

    if ($action === 'n100n-run') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'n100n-run requires POST.'], 405);
        }
        $rawN100nBody = (string) file_get_contents('php://input');
        if (strlen($rawN100nBody) > 1024 * 1024) {
            respond(['ok' => false, 'error' => 'N100N workflow input exceeds the 1 MB request limit.'], 413);
        }
        $payload = json_decode($rawN100nBody, true);
        if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
            respond(['ok' => false, 'error' => 'N100N workflow input must be valid JSON.'], 400);
        }
        $workflowId = filter_var($payload['workflow_id'] ?? null, FILTER_VALIDATE_INT);
        if ($workflowId === false || $workflowId === null || $workflowId < 1) {
            respond(['ok' => false, 'error' => 'Choose a valid N100N workflow ID.'], 400);
        }
        if (!isset($payload['items']) || !is_array($payload['items']) || !array_is_list($payload['items'])) {
            respond(['ok' => false, 'error' => 'N100N workflow items must be a JSON array.'], 400);
        }
        try {
            $result = KraN100nClient::runAsync((int) $workflowId, $payload['items']);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'N100N workflow start failed: ' . $e->getMessage()], 502);
        }
        $nestedResult = is_array($result['data'] ?? null) ? $result['data'] : [];
        $execution = $result['execution'] ?? $nestedResult['execution'] ?? null;
        $executionId = $result['execution_id'] ?? $result['executionId']
            ?? $nestedResult['execution_id'] ?? $nestedResult['executionId']
            ?? (is_array($execution) ? ($execution['id'] ?? '') : '');
        if (!is_scalar($executionId) || trim((string) $executionId) === '') {
            respond(['ok' => false, 'error' => 'N100N did not return an execution ID.'], 502);
        }
        respond([
            'ok' => true,
            'executionId' => (string) $executionId,
            'status' => 'running',
            'result' => $result,
        ]);
    }

    if ($action === 'n100n-execution') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'n100n-execution requires GET.'], 405);
        }
        $executionId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if ($executionId === false || $executionId === null || $executionId < 1) {
            respond(['ok' => false, 'error' => 'A valid N100N execution ID is required.'], 400);
        }
        try {
            respond(['ok' => true, 'execution' => KraN100nClient::execution((int) $executionId)]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'N100N execution lookup failed: ' . $e->getMessage()], 502);
        }
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

    if (in_array($action, ['workspace-files', 'workspace-read', 'task-preview'], true)) {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'Workspace preview is read-only and accepts GET only.'], 405);
        }
        try {
            if ($action === 'workspace-files') {
                $root = (string) ($_GET['root'] ?? '');
                $path = (string) ($_GET['path'] ?? '');
                respond(['ok' => true] + KraWorkspaceBrowser::listDirectory($root, $path));
            }
            if ($action === 'workspace-read') {
                $root = (string) ($_GET['root'] ?? '');
                $path = (string) ($_GET['path'] ?? '');
                respond(['ok' => true] + KraWorkspaceBrowser::readFile($root, $path));
            }
            respond(KraWorkspaceBrowser::previewTask((string) ($_GET['taskId'] ?? '')));
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (Throwable) {
            respond(['ok' => false, 'error' => 'Workspace preview could not be loaded.'], 500);
        }
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
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Terminal execution requires POST.'], 405);
        }
        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
            respond(['ok' => false, 'error' => 'Terminal execution is available only from the local machine.'], 403);
        }
        $raw = (string) file_get_contents('php://input');
        if (strlen($raw) > 8192) respond(['ok' => false, 'error' => 'Command request is too large.'], 413);
        $payload = json_decode($raw, true) ?: [];
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

        $creatorBuiltins = ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer'];
        $creatorHire = false;
        if (!in_array((string) $agent, $creatorBuiltins, true)) {
            foreach (KraDb::getHiredAgents() as $hiredAgent) {
                if (($hiredAgent['id'] ?? '') === $agent && strtolower((string) ($hiredAgent['workspace']['mode'] ?? '')) === 'creator') {
                    $creatorHire = true;
                    break;
                }
            }
        }
        $scope = in_array((string) $agent, $creatorBuiltins, true) || $creatorHire ? 'creator' : 'office';
        $task = KraTaskEngine::propose($agent, $type, $title, $target, $content, $summary, $taskProjectRoot, ['scope' => $scope]);
        respond(['ok' => true, 'task' => $task]);
    }

    if ($action === 'approve' || $action === 'reject') {
        requireSupervisorRole($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Approval decisions require POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $taskId = (string) ($payload['taskId'] ?? '');
        if ($taskId === '') {
            respond(['ok' => false, 'error' => 'Missing taskId parameter.'], 400);
        }
        if ($action === 'approve') {
            $approver = (string) ($currentUser['username'] ?? $currentUser['id'] ?? 'supervisor');
            $isStream = (($_GET['stream'] ?? '') === '1') || !empty($payload['stream']);
            if ($isStream) {
                @ini_set('zlib.output_compression', '0');
                if (function_exists('apache_setenv')) {
                    @apache_setenv('no-gzip', '1');
                }
                header('Content-Type: application/x-ndjson; charset=utf-8');
                header('Cache-Control: no-cache, no-transform');
                header('X-Accel-Buffering: no');
                header('Connection: keep-alive');
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
                ob_implicit_flush(true);

                $emit = static function (array $data): void {
                    echo json_encode($data, JSON_UNESCAPED_SLASHES) . "\n";
                    flush();
                };

                try {
                    $task = KraTaskEngine::approve($taskId, $approver, static function (array $event) use ($emit): void {
                        $emit($event);
                    });
                    $emit(['type' => 'done', 'ok' => true, 'task' => $task]);
                } catch (Throwable $e) {
                    $emit(['type' => 'error', 'ok' => false, 'error' => $e->getMessage()]);
                }
                exit;
            }
            $task = KraTaskEngine::approve($taskId, $approver);
        } else {
            $task = KraTaskEngine::reject($taskId, 'Rejected by user');
        }
        respond(['ok' => true, 'task' => $task]);
    }

    if ($action === 'undo') {
        requireSupervisorRole($currentUser);
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
        respond(['ok' => true, 'config' => ProviderConfig::publicSummary()]);
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
            requireSupervisorRole($currentUser);
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
        $rootPrefix = rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $insideRoot = $real !== false && (
            strtolower($real) === strtolower($projectRoot)
            || str_starts_with(strtolower(rtrim($real, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR), strtolower($rootPrefix))
        );
        if (!$insideRoot) {
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

    // ---------------- integrasi n100n (antrean tugas, generik) ----------------
    if ($action === 'flow-kategori') {
        respond([
            'ok' => true,
            'kategori' => KraFlowBridge::kategori(),
            'diambil' => gmdate('c'),
        ]);
    }

    if ($action === 'flow-tugas') {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // body dibaca lebih dulu walau nanti ditolak: menjaga koneksi keep-alive
            $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
            $hasil = KraFlowBridge::terimaTugas(is_array($payload) ? $payload : []);
            respond($hasil, ($hasil['ok'] ?? false) ? 202 : 400);
        }
        $status = isset($_GET['status']) ? (string) $_GET['status'] : null;
        $agen = isset($_GET['agen']) ? (string) $_GET['agen'] : null;
        $limit = (int) ($_GET['limit'] ?? 50);
        $items = KraFlowBridge::daftarTugas($status, $limit, $agen);
        respond([
            'ok' => true,
            'items' => $items,
            'jumlah' => count($items),
            'ringkasan' => KraFlowBridge::ringkasan(),
        ]);
    }

    if ($action === 'flow-selesai') {
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'flow-selesai requires POST.'], 405);
        }
        $hasil = KraFlowBridge::selesaikan(
            (string) ($payload['task_id'] ?? $_GET['task_id'] ?? ''),
            (string) ($payload['hasil'] ?? ''),
            ['mode' => (string) ($payload['mode'] ?? 'manual')]
        );
        respond($hasil, ($hasil['ok'] ?? false) ? 200 : 400);
    }

    if ($action === 'flow-status') {
        respond(['ok' => true, 'ringkasan' => KraFlowBridge::ringkasan()]);
    }

    $available = 'status, agents, save-agent, hired-agents, log-chat, chat-history, chat-agent, tasks, propose,'
        . 'model-propose, router-health, router-models, approve, reject, undo, presence, meeting-record,'
        . 'skills, skill-read, skill-hub, skill-toggle, providers, audit, templates, workflow-list,'
        . 'workflow-create, workflow-plan, workflow-stage, n100n-status, n100n-workflows, n100n-run,'
        . 'n100n-execution, n100n-config, youtube-config, youtube-status, youtube-oauth-start, youtube-oauth-callback, youtube-disconnect, vault-settings, vault-browse, vault-select, vault-sync, vault-recall,'
        . 'flow-kategori, flow-tugas, flow-selesai, flow-status, logout.';
    respond([
        'ok' => false,
        'error' => 'Unknown action: ' . $action . '. Available: ' . $available,
    ], 404);
} catch (Throwable $e) {
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
