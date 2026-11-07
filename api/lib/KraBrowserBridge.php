<?php
declare(strict_types=1);

/**
 * KRA Headless Browser Controller Bridge.
 *
 * Drives a real Chromium/Edge instance over the DevTools Protocol when a
 * browser binary is present and was launched with --remote-debugging-port.
 * When no CDP endpoint answers, every action returns an explicit
 * `mode: 'unavailable'` result instead of pretending the action succeeded.
 */
final class KraBrowserBridge
{
    private const SNAPSHOT_DIR = __DIR__ . '/../../.temp/browser_snapshots';
    private const DEFAULT_CDP_PORT = 9222;
    private const DEFAULT_URL = 'http://127.0.0.1:8080/index.html';
    private const CDP_TIMEOUT = 4;

    public static function browserBinary(): string
    {
        $candidates = [
            getenv('KRA_BROWSER_BINARY') ?: '',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ];
        foreach ($candidates as $candidate) {
            if ($candidate !== '' && is_file($candidate)) {
                return $candidate;
            }
        }
        return '';
    }

    private static function cdpPort(): int
    {
        $port = (int) (getenv('KRA_BROWSER_CDP_PORT') ?: self::DEFAULT_CDP_PORT);
        return $port > 0 ? $port : self::DEFAULT_CDP_PORT;
    }

    /** Probe the DevTools HTTP endpoint; returns the target list or null when offline. */
    private static function cdpTargets(): ?array
    {
        $url = 'http://127.0.0.1:' . self::cdpPort() . '/json/list';
        $raw = self::httpGet($url);
        if ($raw === null) {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private static function httpGet(string $url): ?string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, self::CDP_TIMEOUT);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
                $raw = curl_exec($ch);
                curl_close($ch);
                return is_string($raw) && $raw !== '' ? $raw : null;
            }
        }
        $ctx = stream_context_create(['http' => ['timeout' => self::CDP_TIMEOUT, 'ignore_errors' => true]]);
        $raw = @file_get_contents($url, false, $ctx);
        return is_string($raw) && $raw !== '' ? $raw : null;
    }

    public static function status(): array
    {
        $binary = self::browserBinary();
        $targets = self::cdpTargets();
        $live = $targets !== null;
        $pageUrl = '';
        foreach ($targets ?? [] as $target) {
            if (($target['type'] ?? '') === 'page' && !empty($target['url'])) {
                $pageUrl = (string) $target['url'];
                break;
            }
        }

        return [
            'ok' => true,
            'mode' => $live ? 'live' : 'unavailable',
            'installed' => $binary !== '',
            'binary' => $binary !== '' ? $binary : 'none',
            'cdpPort' => self::cdpPort(),
            'cdpConnected' => $live,
            'activeSession' => $live,
            'lastUrl' => $pageUrl !== '' ? $pageUrl : self::DEFAULT_URL,
            'notice' => $live
                ? 'Chromium DevTools aktif pada port ' . self::cdpPort() . '.'
                : ($binary !== ''
                    ? 'Browser terpasang, tapi belum ada sesi DevTools. Jalankan: msedge --remote-debugging-port=' . self::cdpPort() . ' --headless=new'
                    : 'Tidak ada browser Chromium/Edge terdeteksi di server KRA.'),
        ];
    }

    public static function executeAction(string $action, array $params = []): array
    {
        $url = trim((string) ($params['url'] ?? '')) ?: self::DEFAULT_URL;
        $selector = (string) ($params['selector'] ?? '');

        $status = self::status();
        if (($status['mode'] ?? '') !== 'live') {
            // No fake success: the caller must know the browser is not attached.
            return [
                'ok' => false,
                'mode' => 'unavailable',
                'action' => $action,
                'error' => (string) $status['notice'],
                'hint' => 'Start a Chromium instance with --remote-debugging-port=' . self::cdpPort() . ' on the KRA server, then retry.',
            ];
        }

        switch ($action) {
            case 'goto':
                return self::runCdp('Page.navigate', ['url' => $url], [
                    'action' => 'goto',
                    'url' => $url,
                    'mode' => 'live',
                ]);

            case 'click':
                if ($selector === '') {
                    return ['ok' => false, 'action' => 'click', 'error' => 'CSS selector wajib diisi.'];
                }
                return self::runCdp('Runtime.evaluate', [
                    'expression' => 'document.querySelector(' . json_encode($selector) . ')?.click(), !!document.querySelector(' . json_encode($selector) . ')',
                    'returnByValue' => true,
                ], ['action' => 'click', 'selector' => $selector, 'mode' => 'live'], 'result.result.value');

            case 'type':
                $text = (string) ($params['text'] ?? '');
                if ($selector === '') {
                    return ['ok' => false, 'action' => 'type', 'error' => 'CSS selector wajib diisi.'];
                }
                return self::runCdp('Runtime.evaluate', [
                    'expression' => '(e=>{if(!e)return false;e.value=' . json_encode($text) . ';e.dispatchEvent(new Event("input",{bubbles:true}));return true})(document.querySelector(' . json_encode($selector) . '))',
                    'returnByValue' => true,
                ], ['action' => 'type', 'selector' => $selector, 'textLength' => strlen($text), 'mode' => 'live'], 'result.result.value');

            case 'evaluate':
                $script = trim((string) ($params['script'] ?? ''));
                if ($script === '') {
                    return ['ok' => false, 'action' => 'evaluate', 'error' => 'Script wajib diisi.'];
                }
                return self::runCdp('Runtime.evaluate', [
                    'expression' => $script,
                    'returnByValue' => true,
                ], ['action' => 'evaluate', 'mode' => 'live'], 'result.result.value');

            case 'screenshot':
                return self::captureScreenshot();

            default:
                return ['ok' => false, 'error' => 'Unknown browser action: ' . $action];
        }
    }

    private static function runCdp(string $method, array $cdpParams, array $envelope, string $resultPath = ''): array
    {
        try {
            $client = new KraCdpClient('127.0.0.1', self::cdpPort());
            foreach ([$method] as $call) {
                $response = $client->call($call, $cdpParams);
            }
            $out = $envelope + ['ok' => true, 'raw' => $response];
            if ($resultPath !== '') {
                $value = $response;
                foreach (explode('.', $resultPath) as $segment) {
                    $value = is_array($value) ? ($value[$segment] ?? null) : null;
                }
                $out['value'] = $value;
            }
            return $out;
        } catch (Throwable $e) {
            return ['ok' => false, 'action' => $envelope['action'] ?? $method, 'error' => 'CDP: ' . $e->getMessage()];
        }
    }

    private static function captureScreenshot(): array
    {
        try {
            $client = new KraCdpClient('127.0.0.1', self::cdpPort());
            $shot = $client->call('Page.captureScreenshot', ['format' => 'png']);
            $data = (string) ($shot['result']['data'] ?? '');
            if ($data === '') {
                return ['ok' => false, 'action' => 'screenshot', 'error' => 'Browser tidak mengembalikan data gambar.'];
            }
            if (!is_dir(self::SNAPSHOT_DIR) && !@mkdir(self::SNAPSHOT_DIR, 0777, true) && !is_dir(self::SNAPSHOT_DIR)) {
                return ['ok' => false, 'action' => 'screenshot', 'error' => 'Folder snapshot tidak dapat dibuat.'];
            }
            $name = 'shot_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.png';
            $path = self::SNAPSHOT_DIR . DIRECTORY_SEPARATOR . $name;
            if (@file_put_contents($path, base64_decode($data, true) ?: '') === false) {
                return ['ok' => false, 'action' => 'screenshot', 'error' => 'Snapshot gagal ditulis ke disk.'];
            }
            return [
                'ok' => true,
                'action' => 'screenshot',
                'mode' => 'live',
                'snapshot' => $name,
                // Inline data URL: snapshots live outside web/, so no static URL exists.
                'dataUrl' => 'data:image/png;base64,' . $data,
                'snapshotPath' => $path,
                'bytes' => (int) @filesize($path),
                'capturedAt' => date('Y-m-d H:i:s'),
            ];
        } catch (Throwable $e) {
            return ['ok' => false, 'action' => 'screenshot', 'error' => 'CDP: ' . $e->getMessage()];
        }
    }
}

/** Minimal Chrome DevTools Protocol client (HTTP handshake + WebSocket frames). */
final class KraCdpClient
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(private string $host, private int $port)
    {
        $targets = $this->listTargets();
        $wsUrl = '';
        foreach ($targets as $target) {
            if (($target['type'] ?? '') === 'page' && !empty($target['webSocketDebuggerUrl'])) {
                $wsUrl = (string) $target['webSocketDebuggerUrl'];
                break;
            }
        }
        if ($wsUrl === '' && $targets !== []) {
            $wsUrl = (string) ($targets[0]['webSocketDebuggerUrl'] ?? '');
        }
        if ($wsUrl === '') {
            throw new RuntimeException('Tidak ada target DevTools aktif.');
        }
        $this->connect($wsUrl);
    }

    private function listTargets(): array
    {
        $ctx = stream_context_create(['http' => ['timeout' => 4, 'ignore_errors' => true]]);
        $raw = @file_get_contents('http://' . $this->host . ':' . $this->port . '/json/list', false, $ctx);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    private function connect(string $wsUrl): void
    {
        $parts = parse_url($wsUrl);
        $host = (string) ($parts['host'] ?? $this->host);
        $port = (int) ($parts['port'] ?? $this->port);
        $path = (string) ($parts['path'] ?? '/');
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';

        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client('tcp://' . $host . ':' . $port, $errno, $errstr, 4);
        if ($socket === false) {
            throw new RuntimeException('WebSocket connect gagal: ' . $errstr);
        }
        stream_set_timeout($socket, 8);

        $key = base64_encode(random_bytes(16));
        $handshake = "GET {$path}{$query} HTTP/1.1\r\n"
            . "Host: {$host}:{$port}\r\n"
            . "Upgrade: websocket\r\n"
            . "Connection: Upgrade\r\n"
            . "Sec-WebSocket-Key: {$key}\r\n"
            . "Sec-WebSocket-Version: 13\r\n\r\n";
        fwrite($socket, $handshake);

        $response = '';
        while (!str_contains($response, "\r\n\r\n")) {
            $chunk = fread($socket, 1024);
            if ($chunk === false || $chunk === '') {
                break;
            }
            $response .= $chunk;
        }
        if (!str_contains($response, '101')) {
            fclose($socket);
            throw new RuntimeException('Handshake WebSocket ditolak.');
        }
        $this->socket = $socket;
    }

    public function call(string $method, array $params = []): array
    {
        if (!is_resource($this->socket)) {
            throw new RuntimeException('Socket DevTools tidak aktif.');
        }
        $id = random_int(1, 900000);
        $this->sendFrame(json_encode(['id' => $id, 'method' => $method, 'params' => (object) $params], JSON_UNESCAPED_SLASHES));

        $deadline = microtime(true) + 8;
        while (microtime(true) < $deadline) {
            $frame = $this->readFrame();
            if ($frame === null) {
                continue;
            }
            $decoded = json_decode($frame, true);
            if (!is_array($decoded)) {
                continue;
            }
            if ((int) ($decoded['id'] ?? 0) === $id) {
                if (isset($decoded['error'])) {
                    throw new RuntimeException((string) ($decoded['error']['message'] ?? 'CDP error'));
                }
                return ['result' => $decoded['result'] ?? []];
            }
        }
        throw new RuntimeException('Timeout menunggu respons CDP.');
    }

    private function sendFrame(string $payload): void
    {
        $length = strlen($payload);
        $header = chr(0x81);
        if ($length < 126) {
            $header .= chr(0x80 | $length);
        } elseif ($length < 65536) {
            $header .= chr(0x80 | 126) . pack('n', $length);
        } else {
            $header .= chr(0x80 | 127) . pack('J', $length);
        }
        $mask = random_bytes(4);
        $masked = '';
        for ($i = 0; $i < $length; $i += 1) {
            $masked .= $payload[$i] ^ $mask[$i % 4];
        }
        fwrite($this->socket, $header . $mask . $masked);
    }

    private function readFrame(): ?string
    {
        $head = fread($this->socket, 2);
        if ($head === false || strlen($head) < 2) {
            return null;
        }
        $opcode = ord($head[0]) & 0x0F;
        $len = ord($head[1]) & 0x7F;
        if ($len === 126) {
            $ext = fread($this->socket, 2);
            $len = unpack('n', (string) $ext)[1];
        } elseif ($len === 127) {
            $ext = fread($this->socket, 8);
            $len = unpack('J', (string) $ext)[1];
        }
        $payload = '';
        $remaining = $len;
        while ($remaining > 0) {
            $chunk = fread($this->socket, min(8192, $remaining));
            if ($chunk === false || $chunk === '') {
                break;
            }
            $payload .= $chunk;
            $remaining -= strlen($chunk);
        }
        if ($opcode === 0x8) {
            return null;
        }
        return $payload;
    }
}
