<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';
require_once __DIR__ . '/../api/lib/KraAudit.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraVaultSync.php';
require_once __DIR__ . '/../api/lib/KraTerminalBridge.php';
require_once __DIR__ . '/../api/lib/KraReActEngine.php';

function check8(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

$catalog = KraReActEngine::getToolCatalog();
check8(count($catalog) >= 6, 'Tool catalog provides at least 6 autonomous capabilities.');
$names = array_column($catalog, 'name');
check8(in_array('read_file', $names, true), 'Catalog provides read_file.');
check8(in_array('run_audit', $names, true), 'Catalog provides run_audit.');
check8(in_array('stage_proposal', $names, true), 'Catalog provides stage_proposal.');

$readTest = KraReActEngine::executeTool('read_file', ['path' => 'api/config.json']);
check8($readTest['ok'] === true, 'read_file tool executes successfully on project root.');
check8(str_contains((string) ($readTest['content'] ?? ''), 'defaultProvider'),
    'read_file returns verified file content.');

$traversalTest = KraReActEngine::executeTool('read_file', ['path' => '../../windows/win.ini']);
check8($traversalTest['ok'] === false, 'read_file halts directory traversal attempt.');

$auditTest = KraReActEngine::executeTool('run_audit', []);
check8($auditTest['ok'] === true, 'run_audit tool returns verified audit scan.');
check8(in_array($auditTest['verdict'] ?? '', ['APPROVED', 'NEEDS REVISION'], true),
    'run_audit reports official verdict.');

$telemetryTest = KraReActEngine::executeTool('get_telemetry', []);
check8($telemetryTest['ok'] === true, 'get_telemetry tool reports system state.');
check8(isset($telemetryTest['database']), 'get_telemetry includes MySQL database connectivity.');

$stageTest = KraReActEngine::executeTool('stage_proposal', [
    'agentId' => 'budi',
    'actionType' => 'create',
    'title' => 'Phase 8 Stage Verification',
    'targetFile' => 'proposals/react-test.txt',
    'proposedContent' => "// Created by Autonomous ReAct Engine\n",
    'summary' => 'Autonomous ReAct proposal stage test',
]);
check8($stageTest['ok'] === true, 'stage_proposal creates task without direct file write.');
check8(($stageTest['task']['status'] ?? '') === 'WAITING_APPROVAL',
    'Staged proposal is correctly gated in WAITING_APPROVAL state.');

echo "PHASE 8 VERIFICATION PASSED\n";
