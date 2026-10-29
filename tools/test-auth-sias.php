<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraAuth.php';

function check(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    echo "[PASS] {$label}\n";
}

$method = new ReflectionMethod(KraAuth::class, 'siasConnect');
$method->setAccessible(true);
/** @var ?PDO $sias */
$sias = $method->invoke(null);
check($sias instanceof PDO, 'SIAS database connection opens.');
check($sias->query('SELECT DATABASE()')->fetchColumn() === 'sias2025', 'SIAS connection targets active sias2025 database.');

$result = KraAuth::register([]);
check(($result['error'] ?? '') === 'Registrasi KRA sementara tidak tersedia. Gunakan registrasi SIAS resmi.', 'KRA registration stays disabled until SIAS approval stores password hashes safely.');

echo "SIAS AUTH CONFIGURATION TEST PASSED\n";
