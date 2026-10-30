<?php
declare(strict_types=1);

// Phase 1 runtime verifier. Direct checks only: no HTTP self-call
// (PHP built-in server is single-threaded and would deadlock).
// Run on server: C:\xampp\php\php.exe tools\verify-phase1-runtime.php

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraVaultSettings.php';
require_once __DIR__ . '/../api/lib/KraVaultSync.php';
require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';

function check(bool $condition, string $label): void
{
    if (!$condition) {
        echo "[FAIL] {$label}\n";
        exit(1);
    }
    echo "[PASS] {$label}\n";
}

$db = KraDb::connect();
check($db instanceof PDO, 'MySQL online.');

$memoryRoot = KraVaultSync::getVaultDir();
check(is_dir($memoryRoot), "Memory vault exists ({$memoryRoot}).");
check(is_writable($memoryRoot), 'Memory vault writable.');

$config = ProviderConfig::load();
check(($config['configured'] ?? false) === true, 'Provider config loaded.');
check(($config['defaultProvider'] ?? '') !== '', 'Default provider set (' . ($config['defaultProvider'] ?? '') . ').');
check(isset($config['providers']['simulator']), 'Simulator fallback configured.');

$simulator = KraRouterGateway::health('simulator');
check(($simulator['online'] ?? false) === true, 'Simulator health online.');

// Informational: provider reachability (not a failure if offline).
foreach (['9router', 'ollama'] as $name) {
    $h = KraRouterGateway::health($name);
    $state = ($h['online'] ?? false) ? 'ONLINE' : 'OFFLINE';
    echo "[INFO] provider {$name}: {$state}" . (isset($h['error']) && $h['error'] ? " ({$h['error']})" : '') . "\n";
    $encoded = (string) json_encode($h);
    check(!preg_match('/sk-[A-Za-z0-9]/', $encoded), "No key-like value in {$name} health output.");
}

echo "PHASE 1 RUNTIME VERIFICATION PASSED\n";
