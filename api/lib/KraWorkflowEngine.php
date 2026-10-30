<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTaskEngine.php';

final class KraWorkflowEngine
{
    private static function storagePath(): string
    {
        $dir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.temp';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        return $dir . DIRECTORY_SEPARATOR . 'workflows.json';
    }

    public static function loadWorkflows(): array
    {
        $path = self::storagePath();
        if (!is_file($path)) {
            return [];
        }
        $data = json_decode((string) file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    private static function saveWorkflows(array $workflows): void
    {
        file_put_contents(
            self::storagePath(),
            json_encode($workflows, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    public static function create(string $title, array $nodes): array
    {
        $title = trim($title);
        if ($title === '') {
            throw new InvalidArgumentException('Workflow title is required.');
        }
        if (count($nodes) === 0) {
            throw new InvalidArgumentException('Workflow requires at least one node.');
        }

        $normalized = [];
        foreach ($nodes as $index => $node) {
            $id = trim((string) ($node['id'] ?? ('node-' . ($index + 1))));
            $agentId = trim((string) ($node['agentId'] ?? 'budi'));
            $nodeTitle = trim((string) ($node['title'] ?? ('Step ' . ($index + 1))));
            if ($id === '' || $agentId === '' || $nodeTitle === '') {
                throw new InvalidArgumentException('Every workflow node needs id, agentId and title.');
            }
            if (isset($normalized[$id])) {
                throw new InvalidArgumentException('Duplicate workflow node id: ' . $id);
            }
            $targetFile = trim((string) ($node['targetFile'] ?? ''));
            $proposedContent = (string) ($node['proposedContent'] ?? '');
            $summary = trim((string) ($node['summary'] ?? ''));
            if (strlen($proposedContent) > 100000) {
                throw new InvalidArgumentException('Workflow node content exceeds 100 KB.');
            }
            if ($targetFile !== '' && (str_starts_with($targetFile, '/') || preg_match('/^[A-Za-z]:[\\\\\\/]/', $targetFile)
                || preg_match('~(^|[\\\\/])\\.\\.([\\\\/]|$)~', $targetFile))) {
                throw new InvalidArgumentException('Workflow target must be a safe relative path without parent traversal.');
            }
            $normalized[$id] = [
                'id' => $id,
                'agentId' => $agentId,
                'title' => $nodeTitle,
                'targetFile' => $targetFile,
                'proposedContent' => $proposedContent,
                'summary' => $summary,
                'dependsOn' => array_values(array_map('strval', (array) ($node['dependsOn'] ?? []))),
                'status' => 'PENDING',
                'taskId' => null,
            ];
        }

        self::assertAcyclic($normalized);

        $workflows = self::loadWorkflows();
        $id = 'WF-' . (count($workflows) + 101);
        $workflows[$id] = [
            'id' => $id,
            'title' => $title,
            'nodes' => $normalized,
            'status' => 'DRAFT',
            'createdAt' => gmdate('c'),
        ];
        self::saveWorkflows($workflows);
        return $workflows[$id];
    }

    private static function assertAcyclic(array $nodes): void
    {
        $state = [];
        $visit = function (string $id) use (&$visit, &$state, $nodes): void {
            if (!isset($nodes[$id])) {
                throw new InvalidArgumentException('Unknown dependency node: ' . $id);
            }
            if (($state[$id] ?? '') === 'visiting') {
                throw new InvalidArgumentException('Workflow cycle detected at node: ' . $id);
            }
            if (($state[$id] ?? '') === 'done') {
                return;
            }
            $state[$id] = 'visiting';
            foreach ($nodes[$id]['dependsOn'] as $dep) {
                $visit($dep);
            }
            $state[$id] = 'done';
        };

        foreach (array_keys($nodes) as $id) {
            $visit((string) $id);
        }
    }

    public static function listWorkflows(): array
    {
        $workflows = self::loadWorkflows();
        $tasks = KraTaskEngine::loadTasks();
        foreach ($workflows as &$workflow) {
            $states = [];
            $nodes = $workflow['nodes'] ?? [];
            foreach ($nodes as &$node) {
                $taskId = $node['taskId'] ?? null;
                if ($taskId !== null && isset($tasks[$taskId]['status'])) {
                    $node['status'] = (string) $tasks[$taskId]['status'];
                }
                $states[] = $node['status'] ?? 'PENDING';
            }
            unset($node);
            $workflow['nodes'] = $nodes;
            if ($states !== [] && count(array_filter($states, static fn(string $status): bool => $status === 'EXECUTED')) === count($states)) {
                $workflow['status'] = 'COMPLETE';
            } elseif (in_array('WAITING_APPROVAL', $states, true)) {
                $workflow['status'] = 'WAITING_APPROVAL';
            } elseif (in_array('FAILED', $states, true)) {
                $workflow['status'] = 'FAILED';
            } else {
                $workflow['status'] = 'DRAFT';
            }
        }
        unset($workflow);
        return array_values($workflows);
    }

    public static function plan(string $workflowId): array
    {
        $workflows = self::loadWorkflows();
        if (!isset($workflows[$workflowId])) {
            throw new InvalidArgumentException('Workflow not found: ' . $workflowId);
        }
        $workflow = $workflows[$workflowId];
        $waves = [];
        $remaining = $workflow['nodes'];
        $resolved = [];

        while (count($remaining) > 0) {
            $wave = [];
            foreach ($remaining as $id => $node) {
                $ready = true;
                foreach ($node['dependsOn'] as $dep) {
                    if (!in_array($dep, $resolved, true)) {
                        $ready = false;
                        break;
                    }
                }
                if ($ready) {
                    $wave[] = $id;
                }
            }
            if (count($wave) === 0) {
                throw new RuntimeException('Workflow cannot be resolved; dependency deadlock.');
            }
            $waves[] = $wave;
            foreach ($wave as $id) {
                $resolved[] = $id;
                unset($remaining[$id]);
            }
        }

        return [
            'ok' => true,
            'workflowId' => $workflowId,
            'title' => $workflow['title'],
            'parallelWaves' => $waves,
            'totalNodes' => count($workflow['nodes']),
        ];
    }

    public static function stageWave(string $workflowId, int $waveIndex = 0): array
    {
        $plan = self::plan($workflowId);
        $wave = $plan['parallelWaves'][$waveIndex] ?? [];
        if (count($wave) === 0) {
            throw new InvalidArgumentException('Wave index out of range.');
        }

        $workflows = self::loadWorkflows();
        $allTasks = KraTaskEngine::loadTasks();
        foreach ($wave as $nodeId) {
            $node = $workflows[$workflowId]['nodes'][$nodeId];
            foreach ($node['dependsOn'] as $dependencyId) {
                $dependency = $workflows[$workflowId]['nodes'][$dependencyId];
                $dependencyTaskId = $dependency['taskId'] ?? null;
                $dependencyStatus = $dependencyTaskId !== null
                    ? ($allTasks[$dependencyTaskId]['status'] ?? '') : '';
                if ($dependencyStatus !== 'EXECUTED') {
                    throw new RuntimeException(
                        'Dependency "' . $dependency['title'] . '" must be approved and executed before this stage.'
                    );
                }
            }
        }

        $staged = [];
        foreach ($wave as $nodeId) {
            $node = $workflows[$workflowId]['nodes'][$nodeId];
            $existingTaskId = $node['taskId'];
            $existingTaskStatus = $existingTaskId !== null
                ? (string) ($allTasks[$existingTaskId]['status'] ?? '') : '';
            if ($existingTaskId !== null && in_array($existingTaskStatus, ['WAITING_APPROVAL', 'EXECUTING', 'EXECUTED'], true)) {
                $staged[] = ['node' => $nodeId, 'taskId' => $existingTaskId, 'reused' => true];
                continue;
            }
            // A rejected/failed/undone task may be re-queued as a fresh proposal;
            // the old decision remains visible in Task Board history.
            $task = KraTaskEngine::propose(
                $node['agentId'],
                'create',
                $plan['title'] . ' — ' . $node['title'],
                $node['targetFile'] !== '' ? $node['targetFile'] : 'docs/workflow-' . $nodeId . '.md',
                $node['proposedContent'] !== ''
                    ? $node['proposedContent']
                    : "# {$node['title']}\n\nStaged by workflow {$workflowId}.\n",
                $node['summary'] !== '' ? $node['summary'] : 'Workflow node awaiting human approval.',
                null,
                [
                    'scope' => 'creator',
                    'workflowId' => $workflowId,
                    'workflowTitle' => $plan['title'],
                    'workflowNodeId' => $nodeId,
                ]
            );
            $workflows[$workflowId]['nodes'][$nodeId]['taskId'] = $task['id'];
            $workflows[$workflowId]['nodes'][$nodeId]['status'] = 'WAITING_APPROVAL';
            $staged[] = ['node' => $nodeId, 'taskId' => $task['id'], 'reused' => false];
        }
        $workflows[$workflowId]['status'] = 'WAITING_APPROVAL';
        self::saveWorkflows($workflows);

        return [
            'ok' => true,
            'workflowId' => $workflowId,
            'waveIndex' => $waveIndex,
            'staged' => $staged,
            'safety' => 'All nodes remain WAITING_APPROVAL until human approval.',
        ];
    }
}
