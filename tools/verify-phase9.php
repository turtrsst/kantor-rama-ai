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

function check9(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

// 1. Role Personas
$personas = ['rama', 'budi', 'maya', 'dimas', 'siti'];
foreach ($personas as $p) {
    $persona = KraReActEngine::getAgentPersona($p);
    check9(!empty($persona), "Persona defined for {$p}.");
    check9(str_contains(strtolower($persona), $p), "Persona text matches agent designation {$p}.");
}

// 2. System Prompt Builder
$catalogJson = json_encode(KraReActEngine::getToolCatalog());
$budiPrompt = KraReActEngine::buildSystemPrompt('budi', $catalogJson);
check9(str_contains($budiPrompt, 'Budi'), 'Budi system prompt contains Budi role identity.');
check9(str_contains($budiPrompt, 'ReAct Protocol'), 'System prompt contains ReAct Protocol.');
check9(str_contains($budiPrompt, 'Self-correction rule'), 'System prompt contains self-correction instructions.');
check9(str_contains($budiPrompt, 'Handoff rule'), 'System prompt contains handoff instructions.');

// 3. Staged Proposal Execution Boundary
$stageTest = KraReActEngine::executeTool('stage_proposal', [
    'agentId' => 'budi',
    'actionType' => 'create',
    'title' => 'Phase 9 Autonomous Chain Artifact',
    'targetFile' => 'proposals/phase9-chain.txt',
    'proposedContent' => "// Autonomous Chaining Verified\n",
    'summary' => 'Chained proposal artifact',
]);
check9($stageTest['ok'] === true, 'stage_proposal tool creates proposal task.');
check9(($stageTest['task']['status'] ?? '') === 'WAITING_APPROVAL', 'Proposal remains in WAITING_APPROVAL state.');

// 4. Verify runChain entrypoint exists and is callable
check9(method_exists('KraReActEngine', 'runChain'), 'runChain entry point is implemented.');
check9(method_exists('KraReActEngine', 'runLoop'), 'runLoop method is implemented.');

// 5. Verify App.js integration for Phase 9
$appJs = file_get_contents(__DIR__ . '/../web/app.js');
check9(str_contains($appJs, 'chainHandoff: true'), 'web/app.js requests chained handoff in ReAct mode.');
check9(str_contains($appJs, 'showApprovalGate(stagedTask)'), 'web/app.js opens approval gate for staged proposals.');

echo "PHASE 9 VERIFICATION PASSED\n";
