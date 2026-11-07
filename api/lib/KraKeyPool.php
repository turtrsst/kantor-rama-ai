<?php
declare(strict_types=1);

/**
 * Rotasi multi-key untuk provider native (Gemini / Anthropic).
 *
 * Sumber key, berurutan: `apiKeys` (array atau "k1,k2"), `apiKey`, lalu nilai
 * environment `apiKeyEnv`. Semua bentuk boleh berisi daftar dipisah koma,
 * spasi, atau baris baru, jadi daftar bisa ditaruh di config.json maupun env.
 *
 * Key yang gagal karena kuota/rate-limit atau tidak valid diparkir sebentar
 * dalam state file privat (hanya menyimpan hash SHA-256, bukan key). Request
 * berikutnya melewati key yang sedang parkir, jadi satu key habis kuota tidak
 * mematikan seluruh provider. Error lain (model tidak ada, 5xx) TIDAK memarkir
 * key karena bukan salah key — request langsung gagal seperti sebelumnya.
 */
final class KraKeyPool
{
    private const RATE_LIMIT_COOLDOWN = 60;
    private const AUTH_COOLDOWN = 86400;
    private const ERROR_COOLDOWN = 300;

    /** @return string[] daftar key unik sesuai urutan konfigurasi */
    public static function keys(array $provider): array
    {
        $raw = [];
        $list = $provider['apiKeys'] ?? null;
        if (is_array($list)) {
            foreach ($list as $item) $raw[] = (string) $item;
        } elseif (is_string($list)) {
            $raw[] = $list;
        }
        $raw[] = (string) ($provider['apiKey'] ?? '');
        $envName = trim((string) ($provider['apiKeyEnv'] ?? ''));
        if ($envName !== '') $raw[] = (string) getenv($envName);

        $keys = [];
        foreach ($raw as $chunk) {
            foreach (preg_split('/[\s,]+/', $chunk) ?: [] as $key) {
                $key = trim($key);
                if ($key !== '' && !in_array($key, $keys, true)) $keys[] = $key;
            }
        }
        return $keys;
    }

    /** Urutan rotasi: key siap pakai dulu, yang parkir paling akhir. */
    public static function available(array $provider): array
    {
        $keys = self::keys($provider);
        if (count($keys) < 2) return $keys;

        $state = self::state();
        $now = time();
        $ready = [];
        $cooling = [];
        foreach ($keys as $key) {
            $until = (int) ($state['cooldowns'][self::id($key)] ?? 0);
            if ($until <= $now) $ready[] = $key;
            else $cooling[$key] = $until;
        }
        if ($ready === []) {
            asort($cooling);
            $ready = array_keys($cooling);
        }

        $cursor = (int) ($state['cursor'] ?? 0) % max(1, count($ready));
        $ordered = array_merge(array_slice($ready, $cursor), array_slice($ready, 0, $cursor));
        $state['cursor'] = $cursor + 1;
        self::save($state);
        return $ordered;
    }

    /** Layak dicoba dengan key lain? Hanya error yang benar-benar soal key. */
    public static function shouldRotate(Throwable|string $error): bool
    {
        $message = $error instanceof Throwable ? $error->getMessage() : $error;
        return preg_match(
            '/\b(401|403|429)\b|quota|rate limit|RESOURCE_EXHAUSTED|API key not valid|PERMISSION_DENIED|API_KEY_INVALID/i',
            $message
        ) === 1;
    }

    /** Parkir key yang gagal. Key yang sukses dipanggil lewat reward(). */
    public static function penalize(string $key, Throwable|string $error): void
    {
        $message = $error instanceof Throwable ? $error->getMessage() : $error;
        if (preg_match('/\b429\b|quota|rate limit|RESOURCE_EXHAUSTED/i', $message)) {
            $seconds = self::RATE_LIMIT_COOLDOWN;
        } elseif (preg_match('/\b(401|403)\b|API key not valid|PERMISSION_DENIED|API_KEY_INVALID/i', $message)) {
            $seconds = self::AUTH_COOLDOWN;
        } else {
            $seconds = self::ERROR_COOLDOWN;
        }
        $state = self::state();
        $state['cooldowns'][self::id($key)] = time() + $seconds;
        self::save($state);
    }

    public static function reward(string $key): void
    {
        $state = self::state();
        if (!isset($state['cooldowns'][self::id($key)])) return;
        unset($state['cooldowns'][self::id($key)]);
        self::save($state);
    }

    /** Ringkasan untuk diagnostik/UI; tidak pernah memuat key asli. */
    public static function status(array $provider): array
    {
        $state = self::state();
        $now = time();
        $keys = [];
        foreach (self::keys($provider) as $index => $key) {
            $until = (int) ($state['cooldowns'][self::id($key)] ?? 0);
            $keys[] = [
                'slot' => $index + 1,
                'hint' => substr($key, 0, 8) . '…',
                'coolingDown' => $until > $now,
                'retryInSeconds' => $until > $now ? $until - $now : 0,
            ];
        }
        return ['count' => count($keys), 'keys' => $keys];
    }

    private static function id(string $key): string
    {
        return substr(hash('sha256', $key), 0, 32);
    }

    private static function statePath(): string
    {
        $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR . 'kra-keypool-' . substr(hash('sha256', $projectRoot), 0, 16) . '.json';
    }

    private static function state(): array
    {
        $path = self::statePath();
        if (!is_file($path)) return ['cursor' => 0, 'cooldowns' => []];
        $decoded = json_decode((string) @file_get_contents($path), true);
        if (!is_array($decoded)) return ['cursor' => 0, 'cooldowns' => []];
        return [
            'cursor' => (int) ($decoded['cursor'] ?? 0),
            'cooldowns' => is_array($decoded['cooldowns'] ?? null) ? $decoded['cooldowns'] : [],
        ];
    }

    private static function save(array $state): void
    {
        $path = self::statePath();
        $json = json_encode($state, JSON_UNESCAPED_SLASHES);
        if ($json === false) return;
        if (DIRECTORY_SEPARATOR !== '\\') @chmod($path, 0600);
        @file_put_contents($path, $json, LOCK_EX);
    }
}
