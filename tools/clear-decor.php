<?php
require __DIR__ . '/../api/lib/KraDb.php';
$pdo = KraDb::connect();
if ($pdo) {
    $pdo->exec("DELETE FROM kra_decorations WHERE floor = 1");
    echo "Cleared floor 1 decorations\n";
}
