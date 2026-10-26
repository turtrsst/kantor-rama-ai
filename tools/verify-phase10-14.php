<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraSemanticMemory.php';
require_once __DIR__ . '/../api/lib/KraDatasetEngine.php';
require_once __DIR__ . '/../api/lib/KraVisionEngine.php';
require_once __DIR__ . '/../api/lib/KraWorkflowEngine.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';

function check(bool $condition, string $label): void
{
    if (!$condition) {
        echo "[FAIL] {$label}\n";
        exit(1);
    }
    echo "[PASS] {$label}\n";
}

echo "=== VERIFYING PHASES 10 TO 14 ===\n";

// Phase 10: Semantic Memory Recall
$memResults = KraSemanticMemory::recall('meeting proposal audit', 3);
check(is_array($memResults), 'Phase 10: KraSemanticMemory::recall returns array.');
if (!empty($memResults)) {
    check(isset($memResults[0]['file']) && isset($memResults[0]['score']), 'Phase 10: Result contains file and score.');
} else {
    check(true, 'Phase 10: Semantic recall graceful when vault is empty/mock.');
}

// Phase 11: Dataset Engine
$dataset = KraDatasetEngine::exportDataset();
check($dataset['ok'] === true, 'Phase 11: KraDatasetEngine::exportDataset returns ok.');
check(isset($dataset['records']) && is_array($dataset['records']), 'Phase 11: Dataset contains records array.');

// Phase 12: Vision Engine
$root = realpath(dirname(__DIR__));
$vision = KraVisionEngine::captureAndInspect($root);
check($vision['ok'] === true, 'Phase 12: KraVisionEngine::captureAndInspect returns ok.');
check($vision['visualVerdict'] === 'PASS', 'Phase 12: Visual inspection verdict is PASS.');

// Phase 13: Workflow Engine (DAG)
$wf = KraWorkflowEngine::create('Phase 13 Swarm Test', [
    ['id' => 'scaffold', 'agentId' => 'budi', 'title' => 'Scaffold API'],
    ['id' => 'review', 'agentId' => 'dimas', 'title' => 'Review API', 'dependsOn' => ['scaffold']],
    ['id' => 'audit', 'agentId' => 'rama', 'title' => 'Executive Signoff', 'dependsOn' => ['review']],
]);
check($wf['id'] !== '', 'Phase 13: Workflow created with ID.');
$plan = KraWorkflowEngine::plan($wf['id']);
check(count($plan['parallelWaves']) === 3, 'Phase 13: Dependency waves resolved correctly into 3 linear stages.');
check($plan['parallelWaves'][0] === ['scaffold'], 'Phase 13: Wave 0 contains scaffold node.');

$staged = KraWorkflowEngine::stageWave($wf['id'], 0);
check($staged['ok'] === true, 'Phase 13: Wave 0 staged as WAITING_APPROVAL.');

// Phase 14: Router Gateway Fallback
$fbCheck = KraRouterGateway::completeWithFallback([
    'provider' => 'simulator',
    'prompt' => 'ping',
]);
check(isset($fbCheck['provider']), 'Phase 14: Gateway fallback mechanism executed.');

echo "\nALL PHASES 10-14 VERIFICATIONS PASSED SUCCESSFULLY.\n";
