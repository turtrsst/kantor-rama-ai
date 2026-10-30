<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraAuth.php';

function authCheck(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$label}\n");
}

// Former built-in pairing tokens must not authenticate or be re-seeded.
foreach (['kra_officer_rama', 'kra_officer_budi', 'kra_officer_maya', 'kra_officer_dimas', 'kra_officer_siti'] as $token) {
    authCheck(KraAuth::authenticate($token) === null, 'Legacy predictable pairing token rejected: ' . $token . '.');
}
foreach (KraAuth::getOfficerDirectory() as $officer) {
    authCheck(!array_key_exists('pairing_key', $officer), 'Officer directory contains no authentication secret.');
}

$db = KraDb::connect();
authCheck($db instanceof PDO, 'KRA database connection opens.');
$ownerA = 'audit_' . bin2hex(random_bytes(8));
$ownerB = 'audit_' . bin2hex(random_bytes(8));
$tileX = 9999;
$tileY = 9999;
try {
    KraDb::saveDecoration(91, $tileX, $tileY, 'trophy', $ownerA);
    KraDb::saveDecoration(91, $tileX, $tileY, 'bonsai', $ownerB);
    $a = KraDb::getDecorations(91, $ownerA);
    $b = KraDb::getDecorations(91, $ownerB);
    authCheck(count($a) === 1 && $a[0]['item_id'] === 'trophy', 'Owner A reads only its own decoration.');
    authCheck(count($b) === 1 && $b[0]['item_id'] === 'bonsai', 'Owner B reads only its own decoration.');
} finally {
    KraDb::clearDecorations(91, $ownerA);
    KraDb::clearDecorations(91, $ownerB);
}

echo "PILAR 1 AUTH & OWNER ISOLATION VERIFICATION PASSED\n";
