<?php
declare(strict_types=1);

// Phase 2 Verifier: LLM Chat Integration and Fallback
// Runs directly on server: C:\xampp\php\php.exe tools\verify-phase2-chat.php

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';
require_once __DIR__ . '/../api/lib/KraAgentChat.php';
require_once __DIR__ . '/../api/ProviderConfig.php';

function check(bool $condition, string $label): void
{
    if (!$condition) {
        echo "[FAIL] {$label}\n";
        exit(1);
    }
    echo "[PASS] {$label}\n";
}

echo "=== PHASE 2: LLM CHAT INTEGRATION VERIFICATION ===\n";

// 1. Database ready
$db = KraDb::connect();
check($db instanceof PDO, 'Database connection online.');

// 2. Gateway simulator fallback directly
$sim = KraRouterGateway::completeWithFallback([
    'provider' => 'simulator',
    'prompt' => 'ping',
]);
check(($sim['content'] ?? '') === 'SIMULATOR_OK', 'Gateway simulator responds SIMULATOR_OK.');

// 3. Single agent dispatch (Rama) produces full metadata
$res = KraAgentChat::dispatch([
    'channel' => 'rama',
    'message' => 'Halo Rama, jelaskan peranmu singkat saja.',
]);

check(($res['ok'] ?? false) === true, 'Dispatch returns ok=true.');
check(!empty($res['message']), 'Officer message is not empty.');
check(isset($res['provider']), 'Metadata field "provider" present.');
check(isset($res['model']), 'Metadata field "model" present.');
check(array_key_exists('fallbackUsed', $res), 'Metadata field "fallbackUsed" present.');
check(is_bool($res['fallbackUsed']), 'Field "fallbackUsed" is boolean.');
check(array_key_exists('attempts', $res), 'Metadata field "attempts" present.');
check(is_array($res['attempts']), 'Field "attempts" is array.');

// 4. No credential leaks in output
$encoded = (string) json_encode($res);
check(!preg_match('/sk-[A-Za-z0-9]/', $encoded), 'Response contains no API key patterns.');
check(!str_contains(strtolower($encoded), 'bearer '), 'Response contains no Bearer tokens.');

// 5. Attempts list must not disclose raw error trace
foreach ($res['attempts'] as $att) {
    if (is_array($att) && isset($att[1])) {
        check(in_array($att[1], ['online', 'offline'], true), "Attempt status is normalized ({$att[1]}).");
    }
}

// 6. Empty message validation
$caught = false;
try {
    KraAgentChat::dispatch(['channel' => 'rama', 'message' => '   ']);
} catch (InvalidArgumentException) {
    $caught = true;
}
check($caught, 'Empty message rejected with InvalidArgumentException.');

// 7. Team broadcast stays fast and does not error
$teamRes = KraAgentChat::dispatch([
    'channel' => 'team',
    'message' => 'Halo semua perwira',
]);
check(($teamRes['ok'] ?? false) === true, 'Team broadcast succeeds.');
check(count($teamRes['replies'] ?? []) >= 5, 'All 5 core officers respond in team channel.');

echo "PHASE 2 CHAT INTEGRATION VERIFICATION PASSED\n";
