<?php
declare(strict_types=1);

/**
 * KRA WhatsApp relay bridge.
 *
 * Posts outbound messages to an operator-supplied relay endpoint (WAHA,
 * Baileys, or any HTTP gateway that accepts {to, text}). When no endpoint is
 * configured or it does not answer, the result says so — it never reports a
 * delivery that did not happen.
 */
final class KraWhatsAppRelay
{
    private const CONFIG_FILE = __DIR__ . '/../../.temp/whatsapp_relay.json';
    private const TIMEOUT = 10;

    public static function loadConfig(): array
    {
        if (is_file(self::CONFIG_FILE)) {
            $data = json_decode((string) file_get_contents(self::CONFIG_FILE), true);
            if (is_array($data)) {
                return $data + self::defaults();
            }
        }
        return self::defaults();
    }

    private static function defaults(): array
    {
        return [
            'enabled' => false,
            'gateway' => '',
            'endpoint' => '',
            'apiKey' => '',
            'targetChat' => '',
            'autoRelayDiff' => false,
            'autoRelayAudit' => false,
        ];
    }

    public static function saveConfig(array $config): bool
    {
        $allowed = ['enabled', 'gateway', 'endpoint', 'apiKey', 'targetChat', 'autoRelayDiff', 'autoRelayAudit'];
        $clean = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $config)) {
                $clean[$key] = $config[$key];
            }
        }
        $dir = dirname(self::CONFIG_FILE);
        if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
            return false;
        }
        return file_put_contents(
            self::CONFIG_FILE,
            json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        ) !== false;
    }

    public static function status(): array
    {
        $cfg = self::loadConfig();
        $endpoint = trim((string) ($cfg['endpoint'] ?? ''));
        return [
            'ok' => true,
            'mode' => $endpoint !== '' ? 'configured' : 'unavailable',
            'enabled' => !empty($cfg['enabled']),
            'gateway' => (string) ($cfg['gateway'] ?? ''),
            'endpoint' => $endpoint,
            'hasApiKey' => trim((string) ($cfg['apiKey'] ?? '')) !== '',
            'targetChat' => (string) ($cfg['targetChat'] ?? ''),
            'notice' => $endpoint === ''
                ? 'Relay WhatsApp belum dikonfigurasi. Isi endpoint gateway (WAHA/Baileys) lebih dulu.'
                : 'Relay dikonfigurasi. Pengiriman akan dilaporkan apa adanya.',
        ];
    }

    public static function send(string $message, string $targetChat = ''): array
    {
        $cfg = self::loadConfig();
        if (empty($cfg['enabled'])) {
            return ['ok' => false, 'mode' => 'disabled', 'error' => 'Relay WhatsApp dinonaktifkan pada konfigurasi.'];
        }
        $endpoint = trim((string) ($cfg['endpoint'] ?? ''));
        if ($endpoint === '' || !preg_match('#^https?://#i', $endpoint)) {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Endpoint relay WhatsApp belum valid.'];
        }
        $target = trim($targetChat) !== '' ? trim($targetChat) : trim((string) ($cfg['targetChat'] ?? ''));
        if ($target === '') {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Nomor/chat tujuan belum diisi.'];
        }
        $message = trim($message);
        if ($message === '') {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Pesan kosong.'];
        }

        $body = json_encode(['to' => $target, 'text' => $message], JSON_UNESCAPED_SLASHES);
        $headers = ['Content-Type: application/json'];
        $apiKey = trim((string) ($cfg['apiKey'] ?? ''));
        if ($apiKey !== '') {
            $headers[] = 'X-Api-Key: ' . $apiKey;
        }

        $raw = null;
        $status = 0;
        if (function_exists('curl_init')) {
            $ch = curl_init($endpoint);
            if ($ch !== false) {
                curl_setopt_array($ch, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => $body,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => self::TIMEOUT,
                ]);
                $raw = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
            }
        } else {
            $ctx = stream_context_create(['http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $body,
                'timeout' => self::TIMEOUT,
                'ignore_errors' => true,
            ]]);
            $raw = @file_get_contents($endpoint, false, $ctx);
            if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
                $status = (int) $m[1];
            }
        }

        if ($status < 200 || $status >= 300) {
            $snippet = (string) $raw;
            $snippet = function_exists('mb_substr') ? mb_substr($snippet, 0, 300) : substr($snippet, 0, 300);
            return [
                'ok' => false,
                'mode' => 'error',
                'status' => $status,
                'error' => 'Relay menolak pengiriman (HTTP ' . $status . '): ' . $snippet,
            ];
        }

        $decoded = json_decode((string) $raw, true);
        return [
            'ok' => true,
            'mode' => 'live',
            'status' => $status,
            'target' => $target,
            'response' => is_array($decoded) ? $decoded : (string) $raw,
            'sentAt' => date('c'),
        ];
    }
}
