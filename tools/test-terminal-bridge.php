<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraTerminalBridge.php';

function terminalCheck(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$label}\n");
}

$root = dirname(__DIR__);
$version = KraTerminalBridge::run('php --version', $root);
$hostExecutableUnavailable = ($version['ok'] ?? false) !== true
    && (int) ($version['exitCode'] ?? 0) === 127
    && preg_match('/php: not found|cannot find.*php/i', (string) ($version['output'] ?? '')) === 1;
if ($hostExecutableUnavailable) {
    fwrite(STDOUT, "[SKIP] Allowlisted process launch: PHP executable is not installed in this test runtime.\n");
} else {
    terminalCheck(($version['ok'] ?? false) === true, 'Allowlisted PHP version command runs without a shell.');
    terminalCheck(str_contains((string) ($version['output'] ?? ''), 'PHP'), 'Command output is returned.');
}

foreach ([
    'php --version; whoami',
    'php --version && whoami',
    'php --version | cat',
    'php -r "echo 1;"',
    '/bin/sh -c id',
    'powershell -EncodedCommand ZQBjAGgAbwA=',
] as $unsafe) {
    $result = KraTerminalBridge::run($unsafe, $root);
    terminalCheck(($result['ok'] ?? true) === false && (int) ($result['exitCode'] ?? 0) === 126,
        'Unsafe shell form rejected: ' . $unsafe);
}

echo "TERMINAL BRIDGE HARDENING TEST PASSED\n";
