<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraReActEngine.php';

function checkSub2(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

fwrite(STDOUT, "AUTONOMY BUDGET & HANDOFF PACKET VERIFICATION\n");
fwrite(STDOUT, str_repeat('=', 64) . "\n");

// 1. Verify budget constraints in runLoop (manual trace)
// Mock run that hits budget
$result = KraReActEngine::runLoop('budi', 'read everything', 1);
checkSub2(isset($result['budget']), 'Result includes budget usage.');
checkSub2($result['budget']['toolCalls'] >= 0, 'Budget contains toolCalls.');

// 2. Verify Handoff Packet structure
$packet = KraReActEngine::handoffPacket(
    'budi', 
    'dimas', 
    'objective', 
    ['thought' => 'thought', 'answer' => 'answer'], 
    [], 
    [
        'maxTurns' => 6,
        'maxToolCalls' => 12,
        'maxReads' => 8,
        'maxReadBytes' => 32000,
        'maxHandoffs' => 3,
        'toolCalls' => 2,
        'reads' => 1,
        'readBytes' => 100,
        'handoffs' => 1,
    ]
);

checkSub2($packet['from'] === 'budi', 'Handoff packet has from.');
checkSub2($packet['to'] === 'dimas', 'Handoff packet has to.');
checkSub2(isset($packet['remainingBudget']), 'Handoff packet has remainingBudget.');
checkSub2($packet['remainingBudget']['toolCalls'] === 10, 'Remaining budget calculated correctly.');

fwrite(STDOUT, str_repeat('=', 64) . "\n");
fwrite(STDOUT, "ALL AUTONOMY BUDGET & HANDOFF PACKET CHECKS PASSED\n");
