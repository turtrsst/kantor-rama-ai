<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';

echo 'Testing KraDb connection & migration...' . PHP_EOL;
$pdo = KraDb::connect();
if ($pdo) {
    echo 'KraDb connected successfully to MySQL.' . PHP_EOL;
    $tables = $pdo->query('SHOW TABLES FROM kra_db')->fetchAll(PDO::FETCH_COLUMN);
    echo 'Tables in kra_db: ' . implode(', ', $tables) . PHP_EOL;
} else {
    echo 'KraDb could not connect to MySQL.' . PHP_EOL;
}
