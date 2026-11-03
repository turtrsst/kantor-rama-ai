<?php
declare(strict_types=1);

require_once __DIR__ . '/KraIntegrationSettings.php';

/**
 * KraGitHubChangerClient — jembatan HTTP KRA (PHP) -> GitHub Changer (Node :4173).
 *
 * Mirip KraN100nClient: tanpa Composer, curl bila ada, fallback PHP streams.
 * Yang dipanggil BUKAN API dashboard (butuh sesi OAuth browser), melainkan
 * endpoint mesin-ke-mesin `/api/kra/*` yang dijaga `x-api-key`
 * (`KRA_GHC_API_KEY` pada service GitHub Changer).
 *
 * Konfigurasi: Creator/Settings → GitHub Changer, atau environment
 * KRA_GITHUB_CHANGER_URL + KRA_GITHUB_CHANGER_API_KEY. Environment menang.
 * Kunci tidak pernah dikirim ke browser.
 */
final class KraGitHubChangerClient
{
    public static function baseUrl(): string
    {
        return rtrim(KraIntegrationSettings::githubChanger()['baseUrl'], '/');
    }

    public static function token(): string
    {
        return KraIntegrationSettings::githubChanger()['apiKey'];
    }

    public static function isConfigured(): bool
    {
        return self::token() !== '';
    }

    public static function publicBaseUrl(): string
    {
        return KraIntegrationSettings::publicGitHubChangerBaseUrl();
    }

    /** Ringkasan untuk panel KRA: tidak pernah melempar exception. */
    public static function status(): array
    {
        $info = [
            'configured' => self::isConfigured(),
            'baseUrl' => self::publicBaseUrl(),
            'eventSecretConfigured' => KraIntegrationSettings::githubChangerEventSecret() !== '',
            'lastEvent' => KraIntegrationSettings::githubChangerEvent(),
            'ok' => false,
        ];
        if (!self::isConfigured()) {
            $info['error'] = 'GitHub Changer service key is not configured in KRA server settings or environment variables.';
            return $info;
        }
        try {
            $response = self::request('GET', '/api/kra/status', null, 6);
            $info['ok'] = (bool) ($response['ok'] ?? false);
            $info['githubChanger'] = self::sanitize($response);
        } catch (Throwable $e) {
            $info['error'] = $e->getMessage();
        }
        return $info;
    }

    public static function repos(): array
    {
        return self::sanitize(self::request('GET', '/api/kra/repos', null, 15));
    }

    public static function activity(int $limit = 10): array
    {
        $limit = max(1, min(50, $limit));
        return self::sanitize(self::request('GET', '/api/kra/activity?limit=' . $limit, null, 10));
    }

    /** Jalankan sinkronisasi Git (fetch/pull/push) sesuai konfigurasi app. */
    public static function sync(): array
    {
        return self::sanitize(self::request('POST', '/api/kra/sync', [], 120));
    }

    /**
     * defense-in-depth: endpoint /api/kra/* memang sudah menyaring datanya,
     * tetap buang kunci rahasia bila suatu hari payload upstream berubah.
     */
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
        if (!self::isConfigured()) {
            throw new RuntimeException('KRA_GITHUB_CHANGER_API_KEY belum diisi pada server KRA.');
        }
        $baseUrl = self::baseUrl();
        $parts = parse_url($baseUrl);
        if (!is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            throw new RuntimeException('GitHub Changer base URL must be a valid HTTP or HTTPS service URL without embedded credentials.');
        }
        $url = $baseUrl . $path;
        $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'x-api-key: ' . self::token(),
        ];
        // Hanya pembacaan idempoten yang diulang. Mengulang POST /sync bisa
        // menjalankan `git pull` dua kali.
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
            $lastError = new RuntimeException('GitHub Changer membalas HTTP ' . $status . ': ' . $message);
            if ($status < 500 && $status !== 429) break;
            if ($attempt < $retry) usleep(250000 * ($attempt + 1));
        }
        throw $lastError ?? new RuntimeException('Permintaan ke GitHub Changer gagal tanpa keterangan.');
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
                if ($raw === false) throw new RuntimeException('GitHub Changer connection failed or timed out.');
                return [$status, (string) $raw];
            }
        }

        // Cadangan tanpa ekstensi curl (pola KraN100nClient).
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
        if ($raw === false) throw new RuntimeException('GitHub Changer connection failed or timed out.');
        $status = 200;
        foreach ((array) ($http_response_header ?? []) as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string) $line, $match) === 1) $status = (int) $match[1];
        }
        return [$status, (string) $raw];
    }
}
