<?php
declare(strict_types=1);

final class KraTaskEngine
{
    private static function getStoragePath(): string
    {
        $dir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.temp';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        return $dir . DIRECTORY_SEPARATOR . 'tasks.json';
    }

    public static function loadTasks(): array
    {
        if (class_exists('KraDb')) {
            $dbTasks = KraDb::getTasks();
            if ($dbTasks !== []) {
                return array_column($dbTasks, null, 'id');
            }
        }
        $path = self::getStoragePath();
        if (!is_file($path)) return [];
        $data = json_decode((string) file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    private static function saveTasks(array $tasks): void
    {
        $path = self::getStoragePath();
        file_put_contents(
            $path,
            json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    public static function propose(
        string $agentId,
        string $actionType,
        string $title,
        string $targetFile,
        string $proposedContent,
        string $summary,
        ?string $projectRoot = null
    ): array {
        $tasks = self::loadTasks();
        $id = 'KRA-' . (count($tasks) + 101);

        $task = [
            'id' => $id,
            'agentId' => $agentId,
            'actionType' => $actionType,
            'title' => $title,
            'targetFile' => $targetFile,
            'proposedContent' => $proposedContent,
            'summary' => $summary,
            'projectRoot' => $projectRoot !== null && trim($projectRoot) !== '' ? rtrim($projectRoot, '\\/') : null,
            'status' => 'WAITING_APPROVAL',
            'createdAt' => gmdate('c'),
            'executedAt' => null,
            'approvedBy' => null,
        ];

        $tasks[$id] = $task;
        self::saveTasks($tasks);
        if (class_exists('KraDb')) KraDb::saveTask($task);
        return $task;
    }

    public static function approve(string $taskId, string $user = 'User'): array
    {
        $tasks = self::loadTasks();
        if (!isset($tasks[$taskId])) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }

        $task = &$tasks[$taskId];
        if ($task['status'] !== 'WAITING_APPROVAL') {
            throw new RuntimeException('Task is not in WAITING_APPROVAL state.');
        }

        $projectRoot = realpath(dirname(__DIR__, 2));
        if ($projectRoot === false) {
            throw new RuntimeException('Project root is unavailable.');
        }

        // A task may target a separate application tree. That tree is only
        // accepted when it sits outside KRA, and it must exist before writing.
        $explicitRoot = trim((string) ($task['projectRoot'] ?? ''));
        if ($explicitRoot !== '') {
            if (!class_exists('KraProjectPath')) {
                require_once __DIR__ . '/KraProjectPath.php';
            }
            $pathCheck = KraProjectPath::validate($explicitRoot);
            if (!($pathCheck['ok'] ?? false)) {
                throw new RuntimeException(
                    'Project path rejected: ' . implode(' ', $pathCheck['reasons'])
                );
            }
            $resolvedRoot = $pathCheck['path'];
            if (!is_dir($resolvedRoot) && !@mkdir($resolvedRoot, 0777, true) && !is_dir($resolvedRoot)) {
                throw new RuntimeException('Unable to create project folder: ' . $resolvedRoot);
            }
            $real = realpath($resolvedRoot);
            if ($real === false) {
                throw new RuntimeException('Project folder is not accessible: ' . $resolvedRoot);
            }
            $projectRoot = $real;
        }

        $task['status'] = 'EXECUTING';
        self::saveTasks($tasks);
        if (class_exists('KraDb')) KraDb::saveTask($task);

        try {
            $result = KraExecutionRunner::execute($task, $projectRoot);
        } catch (Throwable $error) {
            $task['status'] = 'FAILED';
            $task['rejectionReason'] = $error->getMessage();
            $task['executedAt'] = gmdate('c');
            self::saveTasks($tasks);
            if (class_exists('KraDb')) KraDb::saveTask($task);
            throw $error;
        }

        $task['status'] = 'EXECUTED';
        $task['execution'] = $result;
        $task['executedAt'] = gmdate('c');
        $task['approvedBy'] = $user;

        self::saveTasks($tasks);
        if (class_exists('KraDb')) KraDb::saveTask($task);
        if (class_exists('KraVaultSync')) {
            try {
                KraVaultSync::recordMeeting(
                    'Executed Proposal: ' . ($task['title'] ?? $taskId),
                    ['Rama (Executive Boss)', $task['agentId'] ?? 'Creator'],
                    [
                        ['sender' => 'Rama', 'text' => 'Proposal ' . $taskId . ' has been approved and successfully executed.', 'kind' => 'speech'],
                        ['sender' => 'Jarvis', 'text' => 'Target file ' . ($task['targetFile'] ?? '') . ' updated on disk.', 'kind' => 'action'],
                    ],
                    'APPROVED',
                    ['Verify execution results in workspace', 'Log milestone in master dashboard']
                );
            } catch (Throwable $e) {
                // Non-fatal vault sync catch
            }
        }
        return $task;
    }

    public static function reject(string $taskId, string $reason = 'Rejected by user'): array
    {
        $tasks = self::loadTasks();
        if (!isset($tasks[$taskId])) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }

        $task = &$tasks[$taskId];
        $task['status'] = 'REJECTED';
        $task['rejectionReason'] = $reason;
        $task['executedAt'] = gmdate('c');

        self::saveTasks($tasks);
        if (class_exists('KraDb')) KraDb::saveTask($task);
        return $task;
    }

    public static function undo(string $taskId): array
    {
        $tasks = self::loadTasks();
        if (!isset($tasks[$taskId])) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }
        $task = &$tasks[$taskId];
        if (($task['status'] ?? '') !== 'EXECUTED') {
            throw new RuntimeException('Only EXECUTED tasks can be undone.');
        }
        $execution = (array) ($task['execution'] ?? []);
        $backupPath = (string) ($execution['backupPath'] ?? '');
        $targetPath = (string) ($execution['targetPath'] ?? '');
        if ($backupPath !== '' && is_file($backupPath)) {
            if (!@copy($backupPath, $targetPath)) {
                throw new RuntimeException('Unable to restore backup.');
            }
        } elseif (($task['actionType'] ?? '') === 'create' && is_file($targetPath)) {
            @unlink($targetPath);
        } else {
            throw new RuntimeException('No backup available for task ' . $taskId);
        }
        $task['status'] = 'UNDONE';
        $task['executedAt'] = gmdate('c');
        self::saveTasks($tasks);
        if (class_exists('KraDb')) KraDb::saveTask($task);
        return $task;
    }
}
