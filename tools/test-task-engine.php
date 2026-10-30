<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraAgentRegistry.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';

function taskCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('[FAIL] ' . $message);
    }
    fwrite(STDOUT, '[PASS] ' . $message . PHP_EOL);
}

$root = dirname(__DIR__);
$storage = $root . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'tasks.json';
$storageExisted = is_file($storage);
$originalStorage = $storageExisted ? file_get_contents($storage) : null;
$targetRelative = '.temp' . DIRECTORY_SEPARATOR . 'task-engine-test-' . bin2hex(random_bytes(6)) . '.txt';
$targetPath = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $targetRelative);

try {
    $agents = KraAgentRegistry::all();
    taskCheck(isset($agents['creator']), 'Creator agent is registered.');

    $task = KraTaskEngine::propose(
        'creator',
        'create',
        'Task engine smoke test',
        $targetRelative,
        "// Created by KRA Creator Agent\nhello world\n",
        'Temporary file for the approval/execute test'
    );
    taskCheck(($task['status'] ?? '') === 'WAITING_APPROVAL', 'New proposal waits for approval.');
    taskCheck(($task['context']['scope'] ?? '') === 'office', 'Unscoped task defaults to the Virtual Office board.');

    $approved = KraTaskEngine::approve($task['id'], 'Rama/User');
    taskCheck(($approved['status'] ?? '') === 'EXECUTED', 'Approved task reaches EXECUTED.');
    taskCheck(is_file($targetPath), 'Approved task writes its target file.');
    taskCheck(
        file_get_contents($targetPath) === $task['proposedContent'],
        'Written output exactly matches the approved proposal.'
    );
    taskCheck((int) ($approved['execution']['exitCode'] ?? -1) === 0, 'Runner reports exit code zero.');
} finally {
    if (is_file($targetPath)) @unlink($targetPath);
    if ($storageExisted && is_string($originalStorage)) {
        file_put_contents($storage, $originalStorage, LOCK_EX);
    } elseif (is_file($storage)) {
        @unlink($storage);
    }
}

echo "TASK APPROVAL AND EXECUTION TEST PASSED\n";
