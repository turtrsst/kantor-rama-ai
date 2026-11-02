<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

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

    /** Raw storage read. Public/task operations filter this by workspace. */
    private static function loadStorage(): array
    {
        if (class_exists('KraDb') && KraDb::connect() instanceof PDO) {
            $dbTasks = KraDb::getTasksForStorage();
            if ($dbTasks !== []) {
                return array_column($dbTasks, null, 'id');
            }
        }
        $path = self::getStoragePath();
        if (!is_file($path)) return [];
        $data = json_decode((string) file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    private static function normalizeTask(array $task): array
    {
        $workspaceId = trim((string) ($task['workspaceId'] ?? $task['workspace_id'] ?? ''));
        if (($workspaceId === '' || $workspaceId === KraTenantContext::LEGACY_WORKSPACE_ID)
            && KraTenantContext::hasWorkspace() && KraTenantContext::canSeeLegacy()) {
            $task['workspaceId'] = KraTenantContext::workspaceId();
            $task['ownerUserId'] = (string) ($task['ownerUserId'] ?? KraTenantContext::workspaceOwnerId()) ?: null;
        } else {
            $task['workspaceId'] = $workspaceId !== '' ? $workspaceId : KraTenantContext::LEGACY_WORKSPACE_ID;
        }
        $task['projectId'] = (string) ($task['projectId'] ?? '') ?: null;
        return $task;
    }

    public static function loadTasks(): array
    {
        $visible = [];
        foreach (self::loadStorage() as $id => $task) {
            if (!is_array($task)) continue;
            $task = self::normalizeTask($task);
            if (KraTenantContext::rowVisible($task)) $visible[(string) ($task['id'] ?? $id)] = $task;
        }
        return $visible;
    }

    private static function saveStorage(array $tasks): void
    {
        $path = self::getStoragePath();
        $json = json_encode($tasks, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) throw new RuntimeException('Task storage could not be encoded.');
        if (@file_put_contents($path, $json, LOCK_EX) === false) {
            throw new RuntimeException('Task storage could not be written.');
        }
    }

    private static function saveTasks(array $tasks): void
    {
        self::saveStorage($tasks);
    }

    private static function assertTaskAccessible(array $task, string $taskId): void
    {
        if (!KraTenantContext::rowVisible($task)) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }
    }

    private static function nextTaskId(array $tasks): string
    {
        $max = 100;
        foreach (array_keys($tasks) as $id) {
            if (preg_match('/^KRA-(\d+)$/', (string) $id, $m)) $max = max($max, (int) $m[1]);
        }
        return 'KRA-' . ($max + 1);
    }

    public static function propose(
        string $agentId,
        string $actionType,
        string $title,
        string $targetFile,
        string $proposedContent,
        string $summary,
        ?string $projectRoot = null,
        array $context = []
    ): array {
        $tasks = self::loadStorage();
        $id = self::nextTaskId($tasks);
        $scope = ($context['scope'] ?? '') === 'creator' ? 'creator' : 'office';
        $workspace = KraTenantContext::workspace();
        $workspaceId = KraTenantContext::workspaceId();
        $projectId = substr(trim((string) ($context['projectId'] ?? '')), 0, 80) ?: null;
        $resolvedProjectRoot = $projectRoot !== null && trim($projectRoot) !== '' ? rtrim($projectRoot, '\\/') : null;

        if ($resolvedProjectRoot === null && $projectId !== null && is_array($workspace) && class_exists('KraWorkspaces')) {
            $project = KraWorkspaces::projectById($workspace, $projectId);
            if ($project !== null) $resolvedProjectRoot = (string) $project['rootPath'];
            else $projectId = null;
        }
        if ($resolvedProjectRoot === null && is_array($workspace) && KraTenantContext::user() !== null) {
            $platformAdminOfficeLocal = KraTenantContext::isPlatformAdmin(KraTenantContext::user())
                && $scope !== 'creator' && !KraTenantContext::isHosted();
            if (!$platformAdminOfficeLocal) {
                if (!class_exists('KraProjectPath')) require_once __DIR__ . '/KraProjectPath.php';
                $resolvedProjectRoot = class_exists('KraWorkspaces')
                    ? KraWorkspaces::defaultProjectRoot($workspace)
                    : KraProjectPath::workspaceProjectsRoot($workspaceId) . DIRECTORY_SEPARATOR . 'workspace-files';
            }
        }

        $task = [
            'id' => $id,
            'ownerUserId' => KraTenantContext::workspaceOwnerId() !== '' ? KraTenantContext::workspaceOwnerId() : null,
            'workspaceId' => $workspaceId,
            'projectId' => $projectId,
            'agentId' => $agentId,
            'actionType' => $actionType,
            'title' => $title,
            'targetFile' => $targetFile,
            'proposedContent' => $proposedContent,
            'summary' => $summary,
            'projectRoot' => $resolvedProjectRoot,
            'context' => [
                'scope' => $scope,
                'workflowId' => substr(trim((string) ($context['workflowId'] ?? '')), 0, 80),
                'workflowTitle' => substr(trim((string) ($context['workflowTitle'] ?? '')), 0, 120),
                'workflowNodeId' => substr(trim((string) ($context['workflowNodeId'] ?? '')), 0, 80),
            ],
            'status' => 'WAITING_APPROVAL',
            'createdAt' => gmdate('c'),
            'executedAt' => null,
            'approvedBy' => null,
        ];

        $tasks[$id] = $task;
        self::saveStorage($tasks);
        if (class_exists('KraDb')) {
            KraDb::saveTask($task);
            KraDb::recordUsage('task_proposed', 1, ['scope' => $scope, 'agentId' => $agentId]);
        }
        // Best-effort workspace-owner notification (never blocks task creation).
        $mayNotify = !class_exists('KraEntitlements') || KraTenantContext::user() === null || KraEntitlements::hasFeature('telegram_notifications');
        if ($mayNotify && class_exists('KraTelegramBridge')) {
            KraTelegramBridge::notify('📋 Proposal baru ' . $id . ' dari ' . $agentId . ': "' . $title . '" menunggu approval. Buka /proposal untuk menyetujui dari Telegram, atau tinjau di Task Board KRA.');
        }
        return $task;
    }

    public static function approve(string $taskId, string $user = 'User', ?callable $onProgress = null): array
    {
        $tasks = self::loadStorage();
        if (!isset($tasks[$taskId]) || !is_array($tasks[$taskId])) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }
        $tasks[$taskId] = self::normalizeTask($tasks[$taskId]);
        self::assertTaskAccessible($tasks[$taskId], $taskId);

        $task = &$tasks[$taskId];
        if ($task['status'] !== 'WAITING_APPROVAL') {
            throw new RuntimeException('Task is not in WAITING_APPROVAL state.');
        }

        $projectRoot = realpath(dirname(__DIR__, 2));
        if ($projectRoot === false) {
            throw new RuntimeException('Project root is unavailable.');
        }

        if (!class_exists('KraProjectPath')) require_once __DIR__ . '/KraProjectPath.php';
        $explicitRoot = trim((string) ($task['projectRoot'] ?? ''));
        $taskWorkspaceId = (string) ($task['workspaceId'] ?? KraTenantContext::LEGACY_WORKSPACE_ID);
        if ($explicitRoot === '' && !empty($task['projectId']) && class_exists('KraWorkspaces')) {
            $workspace = KraTenantContext::workspace();
            if (is_array($workspace) && (string) ($workspace['id'] ?? '') === $taskWorkspaceId) {
                $project = KraWorkspaces::projectById($workspace, (string) $task['projectId']);
                if ($project !== null) $explicitRoot = (string) $project['rootPath'];
            }
        }
        if ($explicitRoot === '' && $taskWorkspaceId !== KraTenantContext::LEGACY_WORKSPACE_ID) {
            // New commercial workspaces never execute implicitly inside the KRA
            // installation. Creator/office files land in that workspace's own
            // default project area outside KRA.
            $workspace = KraTenantContext::workspace();
            if (is_array($workspace) && (string) ($workspace['id'] ?? '') === $taskWorkspaceId && class_exists('KraWorkspaces')) {
                $project = KraWorkspaces::ensureDefaultProject($workspace);
                $task['projectId'] = (string) $project['id'];
                $explicitRoot = (string) $project['rootPath'];
            } else {
                $explicitRoot = KraProjectPath::workspaceProjectsRoot($taskWorkspaceId, false) . DIRECTORY_SEPARATOR . 'workspace-files';
            }
            $task['projectRoot'] = $explicitRoot;
        }
        if ($explicitRoot !== '') {
            $pathCheck = KraProjectPath::validate(
                $explicitRoot,
                $taskWorkspaceId !== KraTenantContext::LEGACY_WORKSPACE_ID ? $taskWorkspaceId : null,
                KraTenantContext::canSeeLegacy() && $taskWorkspaceId === KraTenantContext::workspaceId()
            );
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
            $task['projectRoot'] = $real;
        }

        $task['status'] = 'EXECUTING';
        self::saveTasks($tasks);
        if (class_exists('KraDb')) KraDb::saveTask($task);

        try {
            $result = KraExecutionRunner::execute($task, $projectRoot, $onProgress);
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
        if (class_exists('KraMemoryCompiler')) {
            try { KraMemoryCompiler::compileTask($task); } catch (Throwable) {}
        }
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
        $tasks = self::loadStorage();
        if (!isset($tasks[$taskId]) || !is_array($tasks[$taskId])) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }
        $tasks[$taskId] = self::normalizeTask($tasks[$taskId]);
        self::assertTaskAccessible($tasks[$taskId], $taskId);

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
        $tasks = self::loadStorage();
        if (!isset($tasks[$taskId]) || !is_array($tasks[$taskId])) {
            throw new InvalidArgumentException('Task ' . $taskId . ' not found.');
        }
        $tasks[$taskId] = self::normalizeTask($tasks[$taskId]);
        self::assertTaskAccessible($tasks[$taskId], $taskId);
        $task = &$tasks[$taskId];
        if (($task['status'] ?? '') !== 'EXECUTED') {
            throw new RuntimeException('Only EXECUTED tasks can be undone.');
        }
        $execution = (array) ($task['execution'] ?? []);
        $backupPath = (string) ($execution['backupPath'] ?? '');
        $targetPath = (string) ($execution['targetPath'] ?? '');
        $expectedRoot = realpath((string) ($task['projectRoot'] ?? dirname(__DIR__, 2)));
        $targetDir = $targetPath !== '' ? realpath(dirname($targetPath)) : false;
        if ($expectedRoot === false || $targetDir === false || is_link($targetPath)) {
            throw new RuntimeException('Safety gate: undo target is missing, linked, or outside the approved project.');
        }
        $rootPrefix = rtrim($expectedRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $insideRoot = strtolower($targetDir) === strtolower($expectedRoot)
            || str_starts_with(strtolower(rtrim($targetDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR), strtolower($rootPrefix));
        if (!$insideRoot) throw new RuntimeException('Safety gate: undo target escapes the approved project.');
        if ($backupPath !== '' && is_file($backupPath)) {
            if (is_link($backupPath) || !str_starts_with(strtolower(realpath($backupPath) ?: ''), strtolower($rootPrefix))) {
                throw new RuntimeException('Safety gate: backup is outside the approved project.');
            }
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
