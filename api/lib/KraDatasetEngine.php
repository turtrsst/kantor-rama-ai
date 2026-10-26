<?php
declare(strict_types=1);

require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraVaultSync.php';
require_once __DIR__ . '/KraTaskEngine.php';
require_once __DIR__ . '/KraSkillHub.php';

final class KraDatasetEngine
{
    public static function exportDataset(): array
    {
        $records = [];

        // 1. Export vault reports
        $vaultDir = KraVaultSync::getVaultDir();
        if ($vaultDir !== '' && is_dir($vaultDir)) {
            $reportsDir = $vaultDir . DIRECTORY_SEPARATOR . 'reports';
            if (is_dir($reportsDir)) {
                $files = glob($reportsDir . DIRECTORY_SEPARATOR . '*.md') ?: [];
                foreach ($files as $file) {
                    $content = @file_get_contents($file);
                    if ($content !== false && $content !== '') {
                        $records[] = [
                            'source' => 'vault_report',
                            'filename' => basename($file),
                            'text' => self::sanitize($content),
                        ];
                    }
                }
            }
        }

        // 2. Export chat history
        $chatHistory = [];
        $db = class_exists('KraDb') ? KraDb::connect() : null;
        if ($db) {
            try {
                $stmt = $db->query("SELECT `channel`, `sender`, `message`, `kind` FROM `kra_chat_history` ORDER BY `id` DESC LIMIT 200");
                $chatHistory = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (Throwable $e) {
                // Ignore DB error
            }
        }
        foreach ($chatHistory as $ch) {
            $records[] = [
                'source' => 'chat_history',
                'channel' => $ch['channel'] ?? 'team',
                'sender' => $ch['sender'] ?? 'unknown',
                'text' => self::sanitize((string) ($ch['message'] ?? '')),
            ];
        }

        // 3. Export tasks / proposals
        $tasks = KraTaskEngine::loadTasks();
        foreach ($tasks as $task) {
            if (($task['status'] ?? '') === 'EXECUTED') {
                $records[] = [
                    'source' => 'executed_proposal',
                    'title' => $task['title'] ?? 'Task',
                    'targetFile' => $task['targetFile'] ?? '',
                    'summary' => $task['summary'] ?? '',
                    'content' => self::sanitize((string) ($task['proposedContent'] ?? '')),
                ];
            }
        }

        return [
            'ok' => true,
            'count' => count($records),
            'records' => $records,
            'exportedAt' => gmdate('c'),
        ];
    }

    private static function sanitize(string $text): string
    {
        // Redact potential secrets or API keys
        $clean = preg_replace('/(sk-[a-zA-Z0-9]{20,}|bearer\s+[a-zA-Z0-9_\-\.]+)/i', '[REDACTED]', $text);
        return trim(preg_replace('/\s+/', ' ', (string) $clean));
    }
}
