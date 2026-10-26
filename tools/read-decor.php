<?php
require __DIR__ . '/../api/lib/KraDb.php';
$pdo = KraDb::connect();
if (!$pdo) { echo "no db\n"; exit; }
echo json_encode($pdo->query('SELECT * FROM kra_decorations')->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT), "\n";
