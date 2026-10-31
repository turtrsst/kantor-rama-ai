<?php
declare(strict_types=1);

require_once __DIR__ . '/KraIntegrationSettings.php';

/**
 * KraN100nClient — jembatan HTTP KRA -> n100n (engine automasi lokal n8n-like).
 *
 * Konfigurasi lewat Creator Integration Settings (disimpan privat di server)
 * atau environment: KRA_N100N_BASE_URL / KRA_N100N_API_KEY. Alias KRA_N100N_URL
 * dan KRA_N100N_TOKEN tetap didukung; environment mengalahkan nilai tersimpan.
 *
 * Contoh:
 *   $status = KraN100nClient::status();                        // cek hidup
 *   $exec   = KraN100nClient::runAsync(1, [['schedule' => gmdate('c')]]);
 *   $hasil  = KraN100nClient::waitExecution((int) $exec['execution_id'], 600);
 *
 * Tidak memakai Composer; curl bila ada, kalau tidak ada jatuh ke PHP streams
 * (pola yang sama dengan KraModelDispatcher).
 */
final class KraN100nClient
{
    public static function baseUrl(): string
    {
        // BASE_URL is the documented setting; URL remains as a legacy alias.
        $settings = KraIntegrationSettings::n100n();
        return rtrim($settings['baseUrl'], '/');
    }

    public static function token(): string
    {
        // API_KEY is the documented server-side N100N REST key; TOKEN remains
        // supported for existing XAMPP deployments. Neither value is public.
        return KraIntegrationSettings::n100n()['apiKey'];
    }

    public static function isConfigured(): bool
    {
        return self::token() !== '';
    }

    /** Ringkasan untuk dashboard: tidak pernah melempar exception. */
    public static function status(): array
    {
        $info = [
            'configured' => self::isConfigured(),
            'baseUrl' => KraIntegrationSettings::publicN100nBaseUrl(),
            'ok' => false,
        ];
        if (!self::isConfigured()) {
            $info['error'] = 'N100N REST API key is not configured in KRA server settings or environment variables.';
            return $info;
        }
        try {
            $health = self::health();
            $info['ok'] = (bool) ($health['ok'] ?? false);
            $info['health'] = $health;
        } catch (Throwable $e) {
            $info['error'] = $e->getMessage();
        }
        return $info;
    }

    public static function health(): array
    {
        return self::request('GET', '/api/health', null, 5);
    }

    public static function workflows(): array
    {
        return self::request('GET', '/api/workflows');
    }

    public static function workflow(int $id): array
    {
        return self::request('GET', '/api/workflows/' . $id);
    }

    /** Jalankan workflow dan tunggu sampai selesai (pakai untuk workflow pendek). */
    public static function run(int $id, array $items = [[]], int $timeoutSeconds = 120): array
    {
        return self::request('POST', '/api/workflows/' . $id . '/run', ['items' => $items], $timeoutSeconds);
    }

    /** Jalankan di latar belakang; cocok untuk alur yang berisi node wait panjang. */
    public static function runAsync(int $id, array $items = [[]]): array
    {
        return self::request('POST', '/api/workflows/' . $id . '/run?async=1', ['items' => $items], 15);
    }

    public static function execution(int $id, int $timeoutSeconds = 30): array
    {
        return self::request('GET', '/api/executions/' . $id, null, $timeoutSeconds);
    }

    /** Poll sampai status bukan "running" lagi (atau timeout). */
    public static function waitExecution(int $id, int $timeoutSeconds = 300, int $intervalMs = 1500): array
    {
        $deadline = time() + max(1, $timeoutSeconds);
        $last = [];
        while (time() < $deadline) {
            $last = self::execution($id);
            if (($last['status'] ?? 'running') !== 'running') {
                return $last;
            }
            usleep(max(200, $intervalMs) * 1000);
        }
        $last['timeout'] = true;
        return $last;
    }

    /** Panggil webhook n100n (workflow trigger webhook yang aktif). */
    public static function webhook(string $path, array $payload = [], bool $wait = false, ?string $webhookToken = null): array
    {
        $query = [];
        if ($wait) {
            $query[] = 'wait=1';
        }
        if ($webhookToken !== null && $webhookToken !== '') {
            $query[] = 'token=' . rawurlencode($webhookToken);
        }
        $suffix = $query === [] ? '' : '?' . implode('&', $query);
        return self::request('POST', '/webhook/' . ltrim($path, '/') . $suffix, $payload);
    }

    private static function request(string $method, string $path, ?array $body = null, int $timeoutSeconds = 30, ?int $retry = null): array
    {
        if (!self::isConfigured()) {
            throw new RuntimeException('KRA_N100N_API_KEY belum diisi pada server KRA.');
        }
        // Only idempotent reads are retried. Retrying a run/webhook POST after a
        // lost response could start the same external workflow twice.
        $retry = $retry ?? (strtoupper($method) === 'GET' ? 1 : 0);
        $baseUrl = self::baseUrl();
        $parts = parse_url($baseUrl);
        if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            throw new RuntimeException('N100N base URL must be a valid HTTP or HTTPS service URL without embedded credentials.');
        }
        $url = $baseUrl . $path;
        $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'x-api-key: ' . self::token(),
        ];

        $lastError = null;
        for ($attempt = 0; $attempt <= $retry; $attempt++) {
            [$status, $raw] = self::http($method, $url, $headers, $payload, $timeoutSeconds);
            $data = json_decode($raw, true);
            if ($status >= 200 && $status < 300) {
                return is_array($data) ? $data : ['ok' => true, 'raw' => $raw];
            }
            $message = is_array($data) && isset($data['error'])
                ? (string) $data['error']
                : substr($raw, 0, 300);
            $lastError = new RuntimeException('n100n membalas HTTP ' . $status . ': ' . $message);
            if ($status < 500 && $status !== 429) {
                break;
            }
            if ($attempt < $retry) {
                usleep(250000 * ($attempt + 1));
            }
        }
        throw $lastError ?? new RuntimeException('Permintaan ke n100n gagal tanpa keterangan.');
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
                if ($payload !== null) {
                    $options[CURLOPT_POSTFIELDS] = $payload;
                }
                curl_setopt_array($ch, $options);
                $raw = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);
                if ($raw === false) {
                    throw new RuntimeException('N100N connection failed or timed out.');
                }
                return [$status, (string) $raw];
            }
        }

        // Cadangan tanpa ekstensi curl (pola KraModelDispatcher).
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
        if ($raw === false) {
            // Stream wrapper errors may include the full URL, including webhook tokens.
            throw new RuntimeException('N100N connection failed or timed out.');
        }
        $status = 200;
        $responseHeaders = $http_response_header ?? [];
        foreach ($responseHeaders as $lines) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string) $lines, $match) === 1) {
                $status = (int) $match[1];
            }
        }
        return [$status, (string) $raw];
    }
}
