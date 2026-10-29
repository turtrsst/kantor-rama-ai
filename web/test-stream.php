<?php
// Test NDJSON stream
header('Content-Type: application/x-ndjson; charset=utf-8');
header('Cache-Control: no-cache');
while (ob_get_level() > 0) ob_end_flush();
ob_implicit_flush(true);

for ($i = 1; $i <= 3; $i++) {
    echo json_encode(['step' => $i, 'time' => microtime(true)]) . "\n";
    flush();
    usleep(500000); // 500ms
}
