<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';
require_once __DIR__ . '/../api/lib/KraAudit.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraVaultSync.php';
require_once __DIR__ . '/../api/lib/KraAgentChat.php';

function checkMaya(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

$target = 'tools/verify-phase7-maya.php';
$before = (string) file_get_contents(__DIR__ . '/verify-phase7-maya.php');
$result = KraAgentChat::dispatch([
    'channel' => 'maya',
    'message' => 'Edit file ' . $target . ' untuk menambahkan komentar dokumentasi aman',
]);
$proposal = $result['proposal'] ?? null;
checkMaya(($result['provider'] ?? '') === '9router', 'Maya uses live 9Router.');
checkMaya(is_array($proposal), 'Maya returns an approval proposal.');
checkMaya(($proposal['targetFile'] ?? '') === $target, 'Maya preserves the actual target path.');
checkMaya(($proposal['proposedContent'] ?? '') !== $before, 'Proposal differs from the read-only source context.');
checkMaya(str_contains((string) ($result['message'] ?? ''), 'verify-phase7-maya'),
    'Maya response references the actual target context.');

$task = KraTaskEngine::propose(
    'maya',
    'modify',
    'Phase 7 Maya approval test',
    $target,
    (string) $proposal['proposedContent'],
    'Read-only context to Approval Gate test.'
);
$afterProposal = (string) file_get_contents(__DIR__ . '/verify-phase7-maya.php');
checkMaya($afterProposal === $before, 'Proposal staging does not write before approval.');
$approved = KraTaskEngine::approve($task['id'], 'Phase 7 Test');
$afterApproval = (string) file_get_contents(__DIR__ . '/verify-phase7-maya.php');
checkMaya(($approved['status'] ?? '') === 'EXECUTED', 'Approved Maya task executes successfully.');
checkMaya($afterApproval === (string) $proposal['proposedContent'],
    'KraExecutionRunner applies content only after approval.');

file_put_contents(__DIR__ . '/verify-phase7-maya.php', $before, LOCK_EX);
echo "PHASE 7 MAYA VERIFICATION PASSED\n";
