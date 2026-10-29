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
        if ($realDir === false || $realRoot === false
            || !str_starts_with(strtolower($realDir), strtolower($realRoot))) {
            throw new RuntimeException('Safety gate: target escapes the project root.');
        }

        $action = (string) ($task['actionType'] ?? '');
        if (!in_array($action, ['create', 'modify'], true)) {
            throw new RuntimeException('Unsupported execution action: ' . $action);
        }

        // Backup existing file before modify
        $backupPath = null;
        if ($action === 'modify' && is_file($targetPath)) {
            $backupDir = $projectRoot . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'backups';
            if (!is_dir($backupDir)) {
                @mkdir($backupDir, 0777, true);
            }
            $backupPath = $backupDir . DIRECTORY_SEPARATOR
                . basename($targetPath) . '.' . date('YmdHis') . '.bak';
            if (!@copy($targetPath, $backupPath)) {
                $backupPath = null; // Non-fatal; log but continue
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
