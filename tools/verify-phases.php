<?php
declare(strict_types=1);

/**
 * End-to-End Test Suite for Phase 1 (Model Dispatcher) & Phase 2 (MySQL Persistence)
 * Verifies live HTTP endpoints, MySQL tables, Safety Gate, and cleanup.
 */

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';
require_once __DIR__ . '/../api/lib/KraModelDispatcher.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';

function assertTest(bool $condition, string $message): void
{
    if (!$condition) {
        echo "  [FAIL] {$message}\n";
        exit(1);
    }
    echo "  [PASS] {$message}\n";
}

function httpPost(string $url, array $payload): array
{
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $json,
            'timeout' => 45,
            'ignore_errors' => true,
        ],
    ]);
    $raw = file_get_contents($url, false, $ctx);
    if ($raw === false) {
        throw new RuntimeException("Failed to POST to {$url}");
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("Invalid JSON from {$url}: {$raw}");
    }
    return $decoded;
}

function httpGet(string $url): array
{
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ]);
    $raw = file_get_contents($url, false, $ctx);
    if ($raw === false) {
        throw new RuntimeException("Failed to GET from {$url}");
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("Invalid JSON from {$url}: {$raw}");
    }
    return $decoded;
}

$baseUrl = rtrim((string) (getenv('KRA_API_BASE') ?: 'http://100.76.172.67:8088/api/index.php'), '/');

echo "=== PHASE 1: AI MODEL DISPATCHER VERIFICATION ===\n";

// 1.1 Provider config loads
$config = ProviderConfig::load();
assertTest($config['configured'] === true, 'ProviderConfig loads successfully.');
assertTest(!empty($config['providers']), 'Configured providers list is not empty.');

// 1.2 Direct dispatcher call
$direct = KraModelDispatcher::propose([
    'prompt' => 'Create a status reporting widget',
    'system' => 'You are Budi, lead creator agent',
]);
assertTest(!empty($direct['content']), 'KraModelDispatcher::propose returns generated content.');
$matchesDefault = $direct['provider'] === $config['defaultProvider']
    || ($direct['fallbackFrom'] ?? '') === $config['defaultProvider'];
assertTest($matchesDefault, 'Dispatcher uses default provider.');

// 1.3 Live HTTP endpoint model-propose
$httpRes = httpPost($baseUrl . '?action=model-propose', [
    'prompt' => 'Create a user profile component',
    'system' => 'You are Maya, refactor agent',
]);
assertTest($httpRes['ok'] === true, 'HTTP POST action=model-propose returns ok=true.');
assertTest(!empty($httpRes['result']['content']), 'HTTP model-propose payload has content.');

echo "\n=== PHASE 2: MYSQL PERSISTENCE & LIFECYCLE VERIFICATION ===\n";

// 2.1 Database connection
$pdo = KraDb::connect();
assertTest($pdo instanceof PDO, 'MySQL connection established to kra_db.');

// 2.2 Agent persistence
$testAgentId = 'agent-phase2-test-' . time();
$agentPayload = [
    'id' => $testAgentId,
    'name' => 'KRA_TEST_BOT',
    'role' => 'Automated QA Engineer',
    'templateId' => 'qa-and-test-engineer',
    'x' => 15.2,
    'y' => 14.6,
    'homeX' => 15.2,
    'homeY' => 14.6,
    'status' => 'verifying',
    'palette' => [
        'skin' => '#F2C79B',
        'hair' => '#241A12',
        'primary' => '#4ECDC4',
        'accent' => '#FFF8E7',
    ],
    'intro' => 'Test bot active.',
];

$saveAgentRes = httpPost($baseUrl . '?action=save-agent', $agentPayload);
assertTest($saveAgentRes['ok'] === true, 'HTTP POST action=save-agent returned ok=true.');

$dbAgentCount = (int) $pdo->query(
    "SELECT COUNT(*) FROM kra_agents WHERE id = " . $pdo->quote($testAgentId)
)->fetchColumn();
assertTest($dbAgentCount === 1, 'Agent successfully persisted in MySQL kra_agents table.');

$hiredRes = httpGet($baseUrl . '?action=hired-agents');
assertTest($hiredRes['ok'] === true, 'HTTP GET action=hired-agents returned ok=true.');
$foundInApi = false;
foreach ($hiredRes['agents'] as $ag) {
    if ($ag['id'] === $testAgentId) {
        $foundInApi = true;
        break;
    }
}
assertTest($foundInApi === true, 'Saved agent is hydrated in API hired-agents list.');

// 2.3 Task Propose & Approval Flow
$testFilePath = 'proposals/verify-phase12-test.txt';
$proposeRes = httpPost($baseUrl . '?action=propose', [
    'agentId' => 'creator',
    'actionType' => 'create',
    'title' => 'Phase 1 & 2 Verification File',
    'targetFile' => $testFilePath,
    'proposedContent' => "// Verification Timestamp: " . date('Y-m-d H:i:s') . "\n",
    'summary' => 'Automated test task for MySQL persistence',
]);
assertTest($proposeRes['ok'] === true, 'HTTP POST action=propose creates task.');
$taskId = (string) $proposeRes['task']['id'];
assertTest(!empty($taskId), "Task ID generated: {$taskId}");

$dbTask = $pdo->query(
    "SELECT * FROM kra_tasks WHERE id = " . $pdo->quote($taskId)
)->fetch(PDO::FETCH_ASSOC);
assertTest($dbTask !== false, 'Task recorded in MySQL kra_tasks table.');
assertTest($dbTask['status'] === 'WAITING_APPROVAL', 'Initial task status is WAITING_APPROVAL.');

// Approve Task
$approveRes = httpPost($baseUrl . '?action=approve', ['taskId' => $taskId]);
assertTest($approveRes['ok'] === true, 'HTTP POST action=approve succeeds.');

$dbTaskAfter = $pdo->query(
    "SELECT * FROM kra_tasks WHERE id = " . $pdo->quote($taskId)
)->fetch(PDO::FETCH_ASSOC);
assertTest($dbTaskAfter['status'] === 'EXECUTED', 'Task status in MySQL updated to EXECUTED.');
assertTest(
    $dbTaskAfter['execution_provider'] === 'local-filesystem',
    'Task execution_provider recorded in MySQL.'
);

$diskFile = dirname(__DIR__) . DIRECTORY_SEPARATOR
    . str_replace('/', DIRECTORY_SEPARATOR, $testFilePath);
assertTest(is_file($diskFile), 'Proposed file successfully created on disk upon approval.');

// 2.4 Task Rejection Flow
$proposeRejectRes = httpPost($baseUrl . '?action=propose', [
    'agentId' => 'modifier',
    'actionType' => 'create',
    'title' => 'Should Be Rejected File',
    'targetFile' => 'proposals/should-not-exist.txt',
    'proposedContent' => 'This should never be written.',
    'summary' => 'Reject test',
]);
$rejectTaskId = (string) $proposeRejectRes['task']['id'];
$rejectRes = httpPost($baseUrl . '?action=reject', ['taskId' => $rejectTaskId]);
assertTest($rejectRes['ok'] === true, 'HTTP POST action=reject succeeds.');

$dbRejectTask = $pdo->query(
    "SELECT * FROM kra_tasks WHERE id = " . $pdo->quote($rejectTaskId)
)->fetch(PDO::FETCH_ASSOC);
assertTest($dbRejectTask['status'] === 'REJECTED', 'Task status in MySQL updated to REJECTED.');

$rejectDiskFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'proposals' . DIRECTORY_SEPARATOR . 'should-not-exist.txt';
assertTest(!file_exists($rejectDiskFile), 'Rejected file was NOT written to disk (Safety Gate intact).');

// 2.5 Chat logging
$chatMsg = 'Verification test ping ' . time();
$chatRes = httpPost($baseUrl . '?action=log-chat', [
    'sender' => 'Tester',
    'message' => $chatMsg,
    'channel' => 'test-audit',
]);
assertTest($chatRes['ok'] === true, 'HTTP POST action=log-chat returned ok=true.');

$chatDbCount = (int) $pdo->query(
    "SELECT COUNT(*) FROM kra_chat_history WHERE message = " . $pdo->quote($chatMsg)
)->fetchColumn();
assertTest($chatDbCount === 1, 'Chat message persisted in MySQL kra_chat_history.');

echo "\n=== PHASE 3: EXECUTION PLANE & SAFETY GATE VERIFICATION ===\n";

// 3.1 Runner direct test
$runnerRes = KraExecutionRunner::execute([
    'targetFile' => 'proposals/runner-direct.txt',
    'actionType' => 'create',
    'proposedContent' => 'DIRECT_RUNNER_CONTENT',
], dirname(__DIR__));
assertTest($runnerRes['provider'] === 'local-filesystem', 'Direct runner provider is local-filesystem.');
$runnerDiskFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'proposals' . DIRECTORY_SEPARATOR . 'runner-direct.txt';
assertTest(is_file($runnerDiskFile), 'Runner directly wrote the targeted file safely.');
unlink($runnerDiskFile);

// 3.2 Path traversal attack blocked by safety gate
$traversalFailed = false;
try {
    KraExecutionRunner::execute([
        'targetFile' => '../../escaped-file.txt',
        'actionType' => 'create',
        'proposedContent' => 'MALICIOUS_PAYLOAD',
    ], dirname(__DIR__));
} catch (Throwable $e) {
    $traversalFailed = true;
}
assertTest($traversalFailed === true, 'Safety gate successfully halted path traversal attempt.');

// 2.6 Cleanup test records & files
if (is_file($diskFile)) {
    unlink($diskFile);
}
$pdo->exec("DELETE FROM kra_agents WHERE id = " . $pdo->quote($testAgentId));
$pdo->exec("DELETE FROM kra_tasks WHERE id IN (" . $pdo->quote($taskId) . ", " . $pdo->quote($rejectTaskId) . ")");
$pdo->exec("DELETE FROM kra_chat_history WHERE message = " . $pdo->quote($chatMsg));

echo "\n=== ALL PHASE 1, PHASE 2 & PHASE 3 VERIFICATIONS PASSED SUCCESSFULLY ===\n";
