<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraExecutionRunner.php';
require_once __DIR__ . '/../api/lib/KraWorkflowEngine.php';
require_once __DIR__ . '/../api/lib/KraCreatorWorkflowFactory.php';

function creatorCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException('[FAIL] ' . $message);
    fwrite(STDOUT, '[PASS] ' . $message . PHP_EOL);
}

$root = dirname(__DIR__);
$tempDir = $root . DIRECTORY_SEPARATOR . '.temp';
if (!is_dir($tempDir)) @mkdir($tempDir, 0777, true);
$workflowStorage = $tempDir . DIRECTORY_SEPARATOR . 'workflows.json';
$taskStorage = $tempDir . DIRECTORY_SEPARATOR . 'tasks.json';
$originalWorkflowStorage = is_file($workflowStorage) ? file_get_contents($workflowStorage) : null;
$originalTaskStorage = is_file($taskStorage) ? file_get_contents($taskStorage) : null;
$title = 'Creator integration test ' . bin2hex(random_bytes(3));
$relativeDir = 'docs/content-creator/' . strtolower(str_replace(' ', '-', $title));
$absoluteDir = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDir);

try {
    $nodes = KraCreatorWorkflowFactory::starterNodes($title);
    creatorCheck(count($nodes) === 5, 'Starter flow has five reviewable local task stages.');
    creatorCheck(str_contains($nodes[4]['proposedContent'], 'PRIVATE / UNLISTED / PUBLIC'), 'Final approval scaffold requires explicit visibility choice.');

    $workflow = KraWorkflowEngine::create($title, $nodes);
    $plan = KraWorkflowEngine::plan($workflow['id']);
    creatorCheck(count($plan['parallelWaves']) === 5, 'Starter stages are sequenced in dependency order.');

    $first = KraWorkflowEngine::stageWave($workflow['id'], 0);
    $firstTaskId = $first['staged'][0]['taskId'];
    $queuedTask = KraTaskEngine::loadTasks()[$firstTaskId] ?? [];
    creatorCheck(($queuedTask['status'] ?? '') === 'WAITING_APPROVAL', 'Staging creates a Task Board proposal that waits for approval.');
    creatorCheck(($queuedTask['context']['scope'] ?? '') === 'creator'
        && ($queuedTask['context']['workflowId'] ?? '') === $workflow['id'], 'Creator tasks carry an explicit Creator Studio context for board separation.');
    KraTaskEngine::reject($firstTaskId, 'Test rejection');
    $retry = KraWorkflowEngine::stageWave($workflow['id'], 0);
    $firstTaskId = $retry['staged'][0]['taskId'];
    creatorCheck($firstTaskId !== $first['staged'][0]['taskId'], 'Rejected work can be re-queued as a fresh approval proposal.');

    $blocked = false;
    try { KraWorkflowEngine::stageWave($workflow['id'], 1); }
    catch (RuntimeException $error) { $blocked = str_contains($error->getMessage(), 'must be approved and executed'); }
    creatorCheck($blocked, 'A dependent stage cannot be queued before the prior approval executes.');

    $firstApproved = KraTaskEngine::approve($firstTaskId, 'creator-workflow-test');
    $firstTarget = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $firstApproved['targetFile']);
    creatorCheck(($firstApproved['status'] ?? '') === 'EXECUTED' && is_file($firstTarget), 'Explicit Task Board approval executes the staged file write.');
    creatorCheck(str_contains((string) file_get_contents($firstTarget), 'no research was performed automatically'), 'Written scaffold is transparent that research is not automated.');

    for ($wave = 1; $wave < count($plan['parallelWaves']); $wave++) {
        $staged = KraWorkflowEngine::stageWave($workflow['id'], $wave);
        $taskId = $staged['staged'][0]['taskId'];
        $approved = KraTaskEngine::approve($taskId, 'creator-workflow-test');
        creatorCheck(($approved['status'] ?? '') === 'EXECUTED', 'Stage ' . ($wave + 1) . ' continues after explicit approval.');
    }

    $listed = KraWorkflowEngine::listWorkflows();
    $saved = null;
    foreach ($listed as $entry) if (($entry['id'] ?? '') === $workflow['id']) $saved = $entry;
    creatorCheck(($saved['status'] ?? '') === 'COMPLETE', 'Workflow status reports complete only after all staged approvals execute.');

    $badTargetRejected = false;
    try {
        KraWorkflowEngine::create('Unsafe path test', [[
            'id' => 'unsafe', 'agentId' => 'budi', 'title' => 'Unsafe', 'targetFile' => '../outside.txt',
        ]]);
    } catch (InvalidArgumentException) { $badTargetRejected = true; }
    creatorCheck($badTargetRejected, 'Workflow creation rejects parent-path traversal targets.');

    $cycleRejected = false;
    try {
        KraWorkflowEngine::create('Cycle test', [
            ['id' => 'a', 'agentId' => 'budi', 'title' => 'A', 'dependsOn' => ['b']],
            ['id' => 'b', 'agentId' => 'rama', 'title' => 'B', 'dependsOn' => ['a']],
        ]);
    } catch (InvalidArgumentException) { $cycleRejected = true; }
    creatorCheck($cycleRejected, 'Workflow creation rejects dependency cycles.');
} finally {
    if (is_dir($absoluteDir)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($absoluteDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $entry) $entry->isDir() ? @rmdir($entry->getPathname()) : @unlink($entry->getPathname());
        @rmdir($absoluteDir);
        $parent = dirname($absoluteDir);
        if (is_dir($parent) && count(scandir($parent) ?: []) <= 2) @rmdir($parent);
    }
    if (is_string($originalWorkflowStorage)) file_put_contents($workflowStorage, $originalWorkflowStorage, LOCK_EX);
    elseif (is_file($workflowStorage)) @unlink($workflowStorage);
    if (is_string($originalTaskStorage)) file_put_contents($taskStorage, $originalTaskStorage, LOCK_EX);
    elseif (is_file($taskStorage)) @unlink($taskStorage);
}

echo "CREATOR WORKFLOW INTEGRATION TEST PASSED\n";
