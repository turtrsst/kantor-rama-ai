<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraGitHubBridge.php';

echo "Testing KraGitHubBridge..." . PHP_EOL;

if (!class_exists('KraGitHubBridge')) {
    echo "FAIL: KraGitHubBridge class not found." . PHP_EOL;
    exit(1);
}

// Check listRuns
echo "Testing listRuns..." . PHP_EOL;
$runs = KraGitHubBridge::listRuns('ci.yml');
if (is_array($runs)) {
    echo "OK: listRuns returned array (count: " . count($runs) . ")" . PHP_EOL;
} else {
    echo "FAIL: listRuns failed." . PHP_EOL;
    exit(1);
}

echo "All basic tests passed." . PHP_EOL;
