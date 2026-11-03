<?php
declare(strict_types=1);

require_once __DIR__ . '/KraIntegrationSettings.php';

/**
 * KraRnaRouterClient — jembatan HTTP KRA (PHP) -> RNA Router (Next.js :3000).
 *
 * RNA Router adalah gateway OpenRouter-compatible milik project ini:
 *   GET  /api/health
 *   GET  /api/v1/models
 *   POST /api/v1/chat/completions
 *
 * Tanpa Composer, curl bila ada, fallback PHP streams. Kunci `x-api-key`
 * bersifat opsional (gateway menerima request tanpa key) dan tidak pernah
 * dikirim ke browser. Konfigurasi lewat Creator/Settings → RNA Router atau
 * environment KRA_RNA_ROUTER_URL / KRA_RNA_ROUTER_API_KEY /
 * KRA_RNA_ROUTER_MODEL; environment menang.
 */
final class KraRnaRouterClient
{
    public static function baseUrl(): string
    {
        return rtrim(KraIntegrationSettings::rnaRouter()['baseUrl'], '/');
    }

    public static function token(): string
    {
        return KraIntegrationSettings::rnaRouter()['apiKey'];
    }

    public static function model(): string
    {
        return KraIntegrationSettings::rnaRouter()['model'];
    }

    public static function publicBaseUrl(): string
    {
        return KraIntegrationSettings::publicRnaRouterBaseUrl();
    }

    /** Ringkasan untuk panel KRA: tidak pernah melempar exception. */
    public static function status(): array
    {
        $info = [
            'configured' => true,
            'baseUrl' => self::publicBaseUrl(),
            'eventSecretConfigured' => KraIntegrationSettings::rnaRouterEventSecret() !== '',
            'lastEvent' => KraIntegrationSettings::rnaRouterEvent(),
            'ok' => false,
            'healthy' => false,
        ];
        try {
            $health = self::request('GET', '/api/health', null, 6);
            $info['ok'] = true;
            $info['healthy'] = strtolower((string) ($health['status'] ?? '')) === 'ok';
            $info['version'] = (string) ($health['version'] ?? '');
            $info['features'] = is_array($health['features'] ?? null) ? array_slice(array_map('strval', $health['features']), 0, 12) : [];
        } catch (Throwable $e) {
            $info['error'] = $e->getMessage();
        }
        return $info;
    }

    /** @return array{0:array,1:int} [daftar model, jumlah] */
    public static function models(): array
    {
        $response = self::request('GET', '/api/v1/models', null, 10);
        $raw = $response['data'] ?? $response;
        $items = is_array($raw) ? $raw : [];
        $models = [];
        foreach (array_slice($items, 0, 100) as $item) {
            if (!is_array($item)) continue;
            $models[] = [
                'id' => substr((string) ($item['id'] ?? $item['model'] ?? ''), 0, 120),
                'provider' => substr((string) ($item['provider'] ?? ''), 0, 60),
            ];
        }
        return [$models, count($models)];
    }

    /** Satu permintaan chat (dipakai tombol TEST CHAT, bukan chat agen KRA). */
    public static function chat(string $message, string $model = ''): array
    {
        $message = trim($message);
        if ($message === '' || strlen($message) > 4000) {
            throw new InvalidArgumentException('Pesan uji RNA Router harus 1–4000 karakter.');
        }
        $model = trim($model) !== '' ? trim($model) : self::model();
        if (!preg_match('/^[A-Za-z0-9._:\/-]{1,120}$/', $model)) {
            throw new InvalidArgumentException('Model RNA Router tidak valid.');
        }
        $response = self::request('POST', '/api/v1/chat/completions', [
            'model' => $model,
            'messages' => [['role' => 'user', 'content' => $message]],
            'temperature' => 0.2,
            'max_tokens' => 256,
        ], 90);
        $reply = $response['choices'][0]['message']['content'] ?? $response['data']['choices'][0]['message']['content'] ?? '';
        return [
            'ok' => true,
            'model' => $model,
            'reply' => substr((string) $reply, 0, 4000),
            'raw' => self::sanitize($response),
        ];
    }

    private static function sanitize(mixed $value, int $depth = 0): mixed
    {
        if ($depth > 6) return null;
        if (is_array($value)) {
            $clean = [];
            $count = 0;
            foreach ($value as $key => $item) {
                if ($count >= 60) break;
                if (is_string($key) && preg_match('/(?:^|_)(?:secret|token|password|api_?key|authorization|cookie)$|(?:Secret|Token|Password|ApiKey)$/i', $key)) continue;
                $clean[$key] = self::sanitize($item, $depth + 1);
                $count++;
            }
            return $clean;
        }
        if (is_string($value)) return substr($value, 0, 2000);
        if (is_int($value) || is_float($value) || is_bool($value) || $value === null) return $value;
        return null;
    }

    private static function request(string $method, string $path, ?array $body = null, int $timeoutSeconds = 30): array
    {
        $baseUrl = self::baseUrl();
        $parts = parse_url($baseUrl);
        if (!is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            throw new RuntimeException('RNA Router base URL must be a valid HTTP or HTTPS service URL without embedded credentials.');
        }
        $url = $baseUrl . $path;
        $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers = ['Accept: application/json'];
        if ($payload !== null) $headers[] = 'Content-Type: application/json';
        if (self::token() !== '') $headers[] = 'x-api-key: ' . self::token();
        // Hanya pembacaan idempoten yang diulang; POST chat tidak boleh dobel.
        $retry = strtoupper($method) === 'GET' ? 1 : 0;
        $lastError = null;
        for ($attempt = 0; $attempt <= $retry; $attempt++) {
            [$status, $raw] = self::http($method, $url, $headers, $payload, $timeoutSeconds);
            $data = json_decode($raw, true);
            if ($status >= 200 && $status < 300) {
                return is_array($data) ? $data : ['ok' => true, 'raw' => substr($raw, 0, 500)];
            }
            $message = is_array($data) && isset($data['error'])
                ? (string) $data['error']
                : substr($raw, 0, 300);
            $lastError = new RuntimeException('RNA Router membalas HTTP ' . $status . ': ' . $message);
            if ($status < 500 && $status !== 429) break;
            if ($attempt < $retry) usleep(250000 * ($attempt + 1));
        }
        throw $lastError ?? new RuntimeException('Permintaan ke RNA Router gagal tanpa keterangan.');
    }

    /** @return array{0:int,1:string} [status, body mentah] */
    private static function http(string $method, string $url, array $headers, ?string $payload, int $timeoutSeconds): array
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                $options = [
                    CURLOPT_CUSTOMREQUEST => $method,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_TIMEOUT => max(1, $timeoutSeconds),
                    CURLOPT_CONNECTTIMEOUT => min(6, max(1, $timeoutSeconds)),
                    CURLOPT_FOLLOWLOCATION => false,
                    CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                ];
                if ($payload !== null) $options[CURLOPT_POSTFIELDS] = $payload;
                curl_setopt_array($ch, $options);
                $raw = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);
                if ($raw === false) throw new RuntimeException('RNA Router connection failed or timed out.');
                return [$status, (string) $raw];
            }
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $payload ?? '',
                'timeout' => max(1, $timeoutSeconds),
                'ignore_errors' => true,
                'follow_location' => 0,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $raw = @file_get_contents($url, false, $context);
        if ($raw === false) throw new RuntimeException('RNA Router connection failed or timed out.');
        $status = 200;
        foreach ((array) ($http_response_header ?? []) as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string) $line, $match) === 1) $status = (int) $match[1];
        }
        return [$status, (string) $raw];
    }
}
