<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraVaultSync.php';
require_once __DIR__ . '/../api/lib/KraTerminalBridge.php';

function check6bc(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

$projectRoot = realpath(__DIR__ . '/..');
check6bc($projectRoot !== false, 'Project root resolves.');

$blocked = KraTerminalBridge::run('shutdown /s', $projectRoot ?: __DIR__);
check6bc($blocked['ok'] === false, 'Destructive shutdown command is blocked.');
check6bc(($blocked['exitCode'] ?? 0) === 126, 'Blocked command returns safety exit code.');

$vault = KraVaultSync::getVaultDir();
check6bc($vault !== '', 'Obsidian vault exists at the configured location.');
check6bc(class_exists('KraVaultSync'), 'Vault sync service loads.');

fwrite(STDOUT, "PHASE 6B/6C BASE VERIFICATION PASSED\n");
