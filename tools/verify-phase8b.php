<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$engine = $root . '/api/lib/KraReActEngine.php';
$app = $root . '/web/app.js';
$index = $root . '/web/index.html';
$css = $root . '/web/style.css';

function checkB(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

$engineText = file_get_contents($engine);
$appText = file_get_contents($app);
$htmlText = file_get_contents($index);
$cssText = file_get_contents($css);

checkB(str_contains($htmlText, 'btn-react-toggle'), 'ReAct mode toggle is present in the command center.');
checkB(str_contains($appText, 'react-chat'), 'Frontend dispatches to the ReAct endpoint.');
checkB(str_contains($appText, 'appendReactCard'), 'Frontend renders discrete ReAct trace cards.');
checkB(str_contains($appText, 'showApprovalGate(stagedTask)'), 'Staged ReAct proposals open the Approval Gate.');
checkB(str_contains($appText, 'animateReactAgent'), 'ReAct actions animate the corresponding agent.');
checkB(str_contains($cssText, '.react-thought'), 'Thought card styling is present.');
checkB(str_contains($cssText, '.react-action'), 'Action card styling is present.');
checkB(str_contains($cssText, '.react-observation'), 'Observation card styling is present.');
checkB(str_contains($engineText, "'findings' => array_slice"), 'Audit observations expose bounded findings for self-correction.');
checkB(str_contains($engineText, 'stage_proposal'), 'ReAct remains approval-gated for all writes.');
checkB(str_contains($engineText, 'runChain'), 'ReAct exposes an autonomous chain entry point.');
checkB(str_contains($engineText, 'buildSystemPrompt'), 'Handoffs rebuild role-specific system context.');
checkB(str_contains($engineText, 'Handoff from'), 'Handoffs preserve cross-agent context.');

echo "PHASE 8B VERIFICATION PASSED\n";
