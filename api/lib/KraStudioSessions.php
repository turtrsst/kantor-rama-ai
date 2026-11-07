<?php
declare(strict_types=1);

/**
 * KRA Studio session mirror.
 *
 * Chat sessions live in the browser's localStorage (fast, offline-friendly).
 * This adds an optional per-user server copy so "recent sessions" survive a
 * device switch. One JSON file per user under .temp/studio_sessions.
 *
 * Deliberately not in the DB: sessions are scratch data, and this keeps the
 * feature shippable without a migration.
 */
final class KraStudioSessions
{
    private const DIR = __DIR__ . '/../../.temp/studio_sessions';
    private const MAX_SESSIONS = 100;
    private const MAX_BYTES = 512 * 1024;

    private static function path(string $userId): string
    {
        $safe = preg_replace('/[^A-Za-z0-9_.-]/', '_', $userId) ?: 'anonymous';
        return self::DIR . DIRECTORY_SEPARATOR . $safe . '.json';
    }

    public static function load(string $userId): array
    {
        $path = self::path($userId);
        if (!is_file($path)) {
            return ['ok' => true, 'sessions' => [], 'active' => ''];
        }
        $data = json_decode((string) file_get_contents($path), true);
        if (!is_array($data)) {
            return ['ok' => true, 'sessions' => [], 'active' => ''];
        }
        return [
            'ok' => true,
            'sessions' => is_array($data['sessions'] ?? null) ? $data['sessions'] : [],
            'active' => (string) ($data['active'] ?? ''),
            'updatedAt' => (string) ($data['updatedAt'] ?? ''),
        ];
    }

    public static function save(string $userId, array $sessions, string $active = ''): array
    {
        $clean = [];
        foreach ($sessions as $session) {
            if (!is_array($session)) continue;
            $id = trim((string) ($session['id'] ?? ''));
            if ($id === '') continue;
            $title = (string) ($session['title'] ?? 'Sesi');
            if (function_exists('mb_substr')) {
                $title = mb_substr($title, 0, 200);
            } else {
                $title = substr($title, 0, 200);
            }
            $clean[] = [
                'id' => $id,
                'title' => $title,
                'time' => (string) ($session['time'] ?? ''),
                'model' => (string) ($session['model'] ?? ''),
                'mode' => (string) ($session['mode'] ?? ''),
                'messages' => is_array($session['messages'] ?? null) ? $session['messages'] : [],
            ];
            if (count($clean) >= self::MAX_SESSIONS) break;
        }

        $payload = json_encode([
            'sessions' => $clean,
            'active' => $active,
            'updatedAt' => date('c'),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($payload === false) {
            return ['ok' => false, 'error' => 'Session payload tidak dapat di-encode.'];
        }
        if (strlen($payload) > self::MAX_BYTES) {
            return ['ok' => false, 'error' => 'Session payload melebihi ' . (self::MAX_BYTES / 1024) . ' KB.'];
        }

        if (!is_dir(self::DIR) && !@mkdir(self::DIR, 0777, true) && !is_dir(self::DIR)) {
            return ['ok' => false, 'error' => 'Folder session mirror tidak dapat dibuat.'];
        }
        if (@file_put_contents(self::path($userId), $payload) === false) {
            return ['ok' => false, 'error' => 'Session mirror gagal ditulis.'];
        }
        return ['ok' => true, 'count' => count($clean), 'updatedAt' => date('c')];
    }
}
