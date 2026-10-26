<?php
require_once __DIR__ . '/../api/lib/KraDb.php';
$pdo = KraDb::connect();
echo $pdo instanceof PDO ? "DB_OK\n" : "DB_FAIL\n";
$mem = getenv('KRA_MEMORY_ROOT') ?: 'C:\vault\KRA';
echo is_dir($mem) ? "MEM_OK\n" : "MEM_FAIL\n";
echo is_writable($mem) ? "MEM_WRITABLE\n" : "MEM_NOT_WRITABLE\n";