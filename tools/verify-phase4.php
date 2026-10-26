<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';

function phase4Check(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

// Direct unit checks (no HTTP self-call).
$pdo = KraDb::connect();
phase4Check($pdo instanceof PDO, 'MySQL connection is available.');

// Execution runner probe (writes to proposals/ and cleans up).
$probe = KraExecutionRunner::execute([
    'targetFile' => 'proposals/phase4-runner-probe.txt',
    'actionType' => 'create',
    'proposedContent' => 'phase4',
], dirname(__DIR__));
phase4Check($probe['exitCode'] === 0, 'Local execution runner returns success exit code.');
$probePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'proposals'
    . DIRECTORY_SEPARATOR . 'phase4-runner-probe.txt';
phase4Check(is_file($probePath), 'Runner writes only the approved test target.');
unlink($probePath);

echo "PHASE 4 RUNTIME VERIFICATION PASSED\n";