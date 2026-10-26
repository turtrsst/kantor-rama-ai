<?php
declare(strict_types=1);
require __DIR__ . '/../api/lib/KraAudit.php';

$result = KraAudit::run(dirname(__DIR__));
echo 'VERDICT: ' . $result['verdict'] . PHP_EOL;
echo 'FILES: ' . $result['summary']['files']
    . '  FINDINGS: ' . $result['summary']['findings']
    . '  SECRETS: ' . $result['summary']['possibleSecrets'] . PHP_EOL;
echo str_repeat('-', 60) . PHP_EOL;
foreach ($result['findings'] as $finding) {
    $loc = $finding['file'] . ($finding['line'] > 0 ? ':' . $finding['line'] : '');
    echo '[' . $finding['severity'] . '] ' . $loc . ' - ' . $finding['message'] . PHP_EOL;
}
if (!$result['findings']) {
    echo '(no findings)' . PHP_EOL;
}
