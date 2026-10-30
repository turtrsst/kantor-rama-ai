<?php
declare(strict_types=1);

final class KraExecutionRunner
{
    public static function execute(array $task, string $projectRoot, ?callable $onProgress = null): array
    {
        $report = static function (array $event) use ($onProgress): void {
            if ($onProgress !== null) $onProgress($event);
        };
        $relative = str_replace('\\', '/', ltrim((string) $task['targetFile'], '/\\'));
        $report(['type' => 'phase', 'name' => 'PREPARING', 'message' => 'Preparing approved change...']);
        $segments = explode('/', $relative);
        if (in_array('..', $segments, true) || str_contains($relative, ':')) {
            throw new RuntimeException('Safety gate: target escapes the project root.');
        }

        $targetPath = $projectRoot . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $relative);
        $targetDir = dirname($targetPath);
        $report(['type' => 'phase', 'name' => 'TARGET', 'path' => $relative]);
        if (!is_dir($targetDir) && !@mkdir($targetDir, 0777, true)) {
            throw new RuntimeException('Unable to create target directory.');
        }
        $realDir = realpath($targetDir);
        $realRoot = realpath($projectRoot);
        $rootPrefix = $realRoot !== false
            ? rtrim($realRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
            : '';
        $insideRoot = $realDir !== false && $realRoot !== false && (
            strtolower($realDir) === strtolower($realRoot)
            || str_starts_with(strtolower(rtrim($realDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR), strtolower($rootPrefix))
        );
        if (!$insideRoot) {
            throw new RuntimeException('Safety gate: target escapes the project root.');
        }
        // Never follow a symlink at the leaf: file_put_contents/copy would write
        // through it even if the containing directory is inside the project.
        if (is_link($targetPath)) {
            throw new RuntimeException('Safety gate: symlink targets are not writable.');
        }

        $action = (string) ($task['actionType'] ?? '');
        if (!in_array($action, ['create', 'modify'], true)) {
            throw new RuntimeException('Unsupported execution action: ' . $action);
        }

        // Backup existing file before modify
        $backupPath = null;
        if ($action === 'modify' && is_file($targetPath)) {
            $backupDir = $projectRoot . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'backups';
            if (!is_dir($backupDir) && !@mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
                throw new RuntimeException('Unable to create a safe backup directory.');
            }
            $realBackupDir = realpath($backupDir);
            if ($realBackupDir === false || !str_starts_with(
                strtolower(rtrim($realBackupDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR),
                strtolower($rootPrefix)
            )) {
                throw new RuntimeException('Safety gate: backup directory escapes the approved project.');
            }
            $backupPath = $realBackupDir . DIRECTORY_SEPARATOR
                . basename($targetPath) . '.' . date('YmdHis') . '.' . bin2hex(random_bytes(4)) . '.bak';
            if (!@copy($targetPath, $backupPath)) {
                throw new RuntimeException('Unable to back up the existing target; modification cancelled.');
            }
        }

        $content = (string) ($task['proposedContent'] ?? '');
        $lines = preg_split('/\\R/', $content) ?: [];
        foreach ($lines as $index => $line) {
            $report([
                'type' => 'line',
                'name' => 'LINE',
                'number' => $index + 1,
                'text' => $line,
            ]);
        }
        $report(['type' => 'phase', 'name' => 'WRITING', 'message' => 'Writing approved code to disk...']);
        if (file_put_contents($targetPath, $content, LOCK_EX) === false) {
            throw new RuntimeException('Unable to write approved target file.');
        }

        return [
            'provider'   => 'local-filesystem',
            'output'     => 'Approved proposal written by controlled local runner.',
            'exitCode'   => 0,
            'targetPath' => $targetPath,
            'backupPath' => $backupPath,
        ];
    }
}
