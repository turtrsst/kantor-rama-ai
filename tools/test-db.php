<?php
declare(strict_types=1);

$host = getenv('KRA_DB_HOST') ?: '127.0.0.1';
$user = getenv('KRA_DB_USER') ?: 'root';
$pass = getenv('KRA_DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host={$host};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo 'MySQL connected. Version: ' . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . PHP_EOL;
    $dbs = $pdo->query('SHOW DATABASES')->fetchAll(PDO::FETCH_COLUMN);
    echo 'Databases: ' . implode(', ', $dbs) . PHP_EOL;
} catch (Throwable $e) {
    echo 'MySQL connection failed: ' . $e->getMessage() . PHP_EOL;
}
