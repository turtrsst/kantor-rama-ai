<?php
declare(strict_types=1);

// Phase 15 Verifier: Task Router & Low-Cost Execution
// Run on server: C:\xampp\php\php.exe tools\verify-phase15-router.php

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';
require_once __DIR__ . '/../api/lib/KraAgentChat.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';
require_once __DIR__ . '/../api/ProviderConfig.php';

// Load KraTaskRouter if it exists
$routerFile = __DIR__ . '/../api/lib/KraTaskRouter.php';
if (is_file($routerFile)) {
    require_once $routerFile;
}

function check(bool $condition, string $label): void
{
    if (!$condition) {
        echo "[FAIL] {$label}\n";
        exit(1);
    }
    echo "[PASS] {$label}\n";
}

echo "=== PHASE 15: TASK ROUTER & LOW-COST EXECUTION VERIFICATION ===\n";

// ── 1. KraTaskRouter class exists ──
check(class_exists('KraTaskRouter'), 'KraTaskRouter class exists.');
check(method_exists('KraTaskRouter', 'route'), 'KraTaskRouter::route() method exists.');

// ── 2. Native mode: Dimas audit ──
$r1 = KraTaskRouter::route('dimas', 'audit keamanan');
check($r1['mode'] === 'native', 'Dimas "audit keamanan" -> mode=native.');
check(isset($r1['skills']) && is_array($r1['skills']), 'Route result has skills array.');
check(isset($r1['estTokens']) && is_int($r1['estTokens']), 'Route result has estTokens (int).');
check(isset($r1['reason']) && is_string($r1['reason']), 'Route result has reason (string).');

// ── 3. Native mode: Siti status ──
$r2 = KraTaskRouter::route('siti', 'status database');
check($r2['mode'] === 'native', 'Siti "status database" -> mode=native.');

// ── 4. Single mode: greeting ──
$r3 = KraTaskRouter::route('rama', 'Halo Rama');
check($r3['mode'] === 'single', 'Rama "Halo Rama" -> mode=single.');

// ── 5. React mode: multi-step ──
$r4 = KraTaskRouter::route('maya', 'audit lalu perbaiki file test.php');
check($r4['mode'] === 'react', 'Maya "audit lalu perbaiki file test.php" -> mode=react.');

// ── 6. React mode: long message ──
$longMsg = str_repeat('Tolong bantu saya dengan masalah ini. ', 15);
$r5 = KraTaskRouter::route('budi', $longMsg);
check($r5['mode'] === 'react', 'Long message (>400 chars) -> mode=react.');

// ── 7. Skill count <= 2, no antislop duplicate ──
foreach ([$r1, $r2, $r3, $r4, $r5] as $i => $r) {
    $skills = $r['skills'];
    check(count($skills) <= 2, "Route result #{$i}: skill count <= 2 (got " . count($skills) . ").");
    $antislop = array_filter($skills, fn($s) => $s === 'antislop');
    check(count($antislop) === 0, "Route result #{$i}: no 'antislop' in extra skills (core, always implicit).");
}

// ── 8. estTokens: native < single ──
check($r1['estTokens'] < $r3['estTokens'], 'Native estTokens < single estTokens.');

// ── 9. Budget present for react ──
check(isset($r4['budget']) && is_array($r4['budget']), 'React route has budget array.');
check(isset($r4['budget']['maxTurns']), 'React budget has maxTurns.');

// ── 10. Tight budget for short react ──
$r6 = KraTaskRouter::route('maya', 'fix lalu test');
check($r6['mode'] === 'react', '"fix lalu test" -> mode=react.');
if ($r6['mode'] === 'react') {
    check($r6['budget']['maxTurns'] <= 3, 'Short react gets tight budget maxTurns<=3.');
    check($r6['budget']['maxToolCalls'] <= 6, 'Short react gets tight budget maxToolCalls<=6.');
}

// ── 11. Empty message validation ──
$caught = false;
try {
    KraTaskRouter::route('rama', '   ');
} catch (InvalidArgumentException) {
    $caught = true;
}
check($caught, 'Empty message throws InvalidArgumentException.');

// ── 12. Backup on modify ──
$projectRoot = realpath(__DIR__ . '/..') ?: getcwd();
$backupDir = $projectRoot . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'backups';
$testTarget = '.temp' . DIRECTORY_SEPARATOR . 'backup-test-target.txt';
$testTargetFull = $projectRoot . DIRECTORY_SEPARATOR . $testTarget;
@mkdir(dirname($testTargetFull), 0777, true);
file_put_contents($testTargetFull, 'original-content-' . time());

$task = [
    'actionType' => 'modify',
    'targetFile' => $testTarget,
    'proposedContent' => 'modified-content',
];
$execResult = KraExecutionRunner::execute($task, $projectRoot);
check(isset($execResult['backupPath']), 'ExecutionRunner returns backupPath on modify.');
if (isset($execResult['backupPath'])) {
    check(is_file($execResult['backupPath']), 'Backup file exists on disk.');
    $backupContent = file_get_contents($execResult['backupPath']);
    check(str_starts_with($backupContent, 'original-content-'), 'Backup contains original content.');
    @unlink($execResult['backupPath']);
}
@unlink($testTargetFull);

// ── 13. No key/bearer leak in route results ──
$allJson = (string) json_encode([$r1, $r2, $r3, $r4, $r5, $r6]);
check(!preg_match('/sk-[A-Za-z0-9]/', $allJson), 'No API key patterns in route results.');
check(!str_contains(strtolower($allJson), 'bearer '), 'No Bearer tokens in route results.');

// ── 14. Chat dispatch includes routing metadata ──
$chatRes = KraAgentChat::dispatch([
    'channel' => 'rama',
    'message' => 'Halo Rama, apa kabar?',
]);
check(isset($chatRes['routing']), 'Chat dispatch response has routing block.');
if (isset($chatRes['routing'])) {
    check(isset($chatRes['routing']['mode']), 'Routing block has mode.');
    check(isset($chatRes['routing']['estTokens']), 'Routing block has estTokens.');
}

echo "PHASE 15 TASK ROUTER & LOW-COST EXECUTION VERIFICATION PASSED\n";
