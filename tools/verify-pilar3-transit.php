<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';

function checkPilar3(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "[FAIL] {$msg}\n");
        exit(1);
    }
    echo "[PASS] {$msg}\n";
}

$pdo = KraDb::connect();
checkPilar3($pdo instanceof PDO, 'Database connected for Pilar 3 verification.');

// 1. Verify table columns exist
$stmt = $pdo->query("SHOW COLUMNS FROM kra_agent_presence LIKE 'floor_id'");
checkPilar3($stmt->rowCount() > 0, 'Column floor_id exists in kra_agent_presence.');

$stmt2 = $pdo->query("SHOW COLUMNS FROM kra_agent_presence LIKE 'in_transit'");
checkPilar3($stmt2->rowCount() > 0, 'Column in_transit exists in kra_agent_presence.');

// 2. Persist presence with floorId = 2 and inTransit = 1
KraDb::savePresence([
    'agentId' => 'creator',
    'state' => 'in_transit',
    'activity' => 'in elevator transit to FL 2',
    'x' => 12.5,
    'y' => 7.2,
    'floorId' => 2,
    'inTransit' => true,
    'bubbleText' => 'Taking lift to FL 02...',
    'bubbleKind' => 'system',
]);

$presenceList = KraDb::getPresence();
$creatorPresence = null;
foreach ($presenceList as $p) {
    if ($p['agent_id'] === 'creator') {
        $creatorPresence = $p;
        break;
    }
}

checkPilar3($creatorPresence !== null, 'Creator presence retrieved from database.');
checkPilar3((int) $creatorPresence['floor_id'] === 2, 'Creator floor_id persisted as 2.');
checkPilar3((int) $creatorPresence['in_transit'] === 1, 'Creator in_transit persisted as 1.');
checkPilar3($creatorPresence['state'] === 'in_transit', 'Creator state is in_transit.');

// 3. Complete transit: creator arrives on Floor 2
KraDb::savePresence([
    'agentId' => 'creator',
    'state' => 'idle',
    'activity' => 'standing by on Floor 2',
    'x' => 18.5,
    'y' => 3.5,
    'floorId' => 2,
    'inTransit' => false,
    'bubbleText' => null,
    'bubbleKind' => null,
]);

$presenceListAfter = KraDb::getPresence();
foreach ($presenceListAfter as $p) {
    if ($p['agent_id'] === 'creator') {
        checkPilar3((int) $p['in_transit'] === 0, 'Creator in_transit cleared upon arrival.');
        checkPilar3((int) $p['floor_id'] === 2, 'Creator remains on Floor 2.');
        break;
    }
}

// Reset creator to Floor 1 for test cleanup
KraDb::savePresence([
    'agentId' => 'creator',
    'state' => 'idle',
    'activity' => 'standing by',
    'x' => 3.2,
    'y' => 12.2,
    'floorId' => 1,
    'inTransit' => false,
]);

echo "\n[SUCCESS] Pilar 3 State Management & Elevator Transit backend verified.\n";
