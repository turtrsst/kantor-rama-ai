<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraAgentRegistry.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';

echo 'Testing Agent Registry...' . PHP_EOL;
$agents = KraAgentRegistry::all();
echo 'Registered agents count: ' . count($agents) . PHP_EOL;
foreach ($agents as $id => $agent) {
    echo '  - ' . $agent['name'] . ' (' . $agent['role'] . '): ' . $agent['desk'] . PHP_EOL;
}

echo PHP_EOL . 'Testing Propose-then-Approve Task Engine...' . PHP_EOL;
$task = KraTaskEngine::propose(
    'creator',
    'create',
    'Scaffold demo component',
    'modules/demo.txt',
    "// Created by KRA Creator Agent\nhello world\n",
    'Initial test module'
);
echo 'Created Task: ' . $task['id'] . ' [Status: ' . $task['status'] . ']' . PHP_EOL;

echo 'Approving task...' . PHP_EOL;
$approved = KraTaskEngine::approve($task['id'], 'Rama/User');
echo 'Approved Task: ' . $approved['id'] . ' [Status: ' . $approved['status'] . ']' . PHP_EOL;

$targetFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'modules' . DIRECTORY_SEPARATOR . 'demo.txt';
if (file_exists($targetFile)) {
    echo 'Target file successfully created: ' . $targetFile . PHP_EOL;
    unlink($targetFile);
    rmdir(dirname($targetFile));
    echo 'Cleanup completed.' . PHP_EOL;
}
