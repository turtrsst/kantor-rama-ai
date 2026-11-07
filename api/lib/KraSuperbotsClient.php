<?php
declare(strict_types=1);

require_once __DIR__ . '/KraIntegrationSettings.php';

/**
 * KraSuperbotsClient — jembatan HTTP KRA -> Superbots Agent (AutoGen 6-bot).
 *
 * Layanan Python lokal (`python virtual_office_superbots.py --serve`), default
 * http://127.0.0.1:8100. Kontrak endpoint mengikuti studio/api.py:
 *
 *   GET  /health                                  cek hidup + kapabilitas
 *   GET  /status                                  antrean & status pipeline
 *   GET  /jobs/{id}                               detail job
 *   POST /kra/schedule/1-start-script             ideasi naskah (Vito→Clara)
 *   GET  /kra/schedule/2-check-gate               gate A-Roll siap render
 *   POST /kra/schedule/3-produce-and-upload       render Raka → QC Damon → Sora
 *   GET  /kra/memory/episodes                     katalog episode
 *   POST /kra/memory/sync-views                   sinkron views YouTube
 *   POST /kra/schedule/sync-views                 cron mingguan n100n
 *   POST /kra/schedule/weekly-report              rekap mingguan Telegram
 *   POST /kra/schedule/publish-shorts             upload Shorts
 *   POST /kra/n100n-trigger                       trigger tunggal dua fase
 *
 * Tidak memakai Composer; curl bila ada, kalau tidak PHP streams (pola
 * KraN100nClient). Tanpa API key: layanan hanya mengikat 127.0.0.1.
 */
final class KraSuperbotsClient
{
    public static function baseUrl(): string
    {
        return rtrim(KraIntegrationSettings::superbots()['baseUrl'], '/');
    }

    public static function isConfigured(): bool
    {
        return self::baseUrl() !== '';
    }

    /** Ringkasan dashboard; tidak pernah melempar exception. */
    public static function status(): array
    {
        $info = [
            'configured' => self::isConfigured(),
            'baseUrl' => KraIntegrationSettings::publicSuperbotsBaseUrl(),
            'ok' => false,
        ];
        if (!self::isConfigured()) {
            $info['error'] = 'Superbots Agent base URL belum diatur di server KRA.';
            return $info;
        }
        try {
            $health = self::health();
            $pipeline = self::pipelineStatus();
            $info['ok'] = true;
            $info['health'] = $health;
            $info['pipeline'] = $pipeline;
        } catch (Throwable $e) {
            $info['error'] = $e->getMessage();
        }
        return $info;
    }

    public static function health(): array
    {
        return self::request('GET', '/health', null, 5);
    }

    public static function pipelineStatus(): array
    {
        return self::request('GET', '/status', null, 10);
    }

    public static function job(string $jobId): array
    {
        $jobId = trim($jobId);
        if (!preg_match('/^[A-Za-z0-9_.-]{1,64}$/', $jobId)) {
            throw new InvalidArgumentException('Job ID Superbots tidak valid.');
        }
        return self::request('GET', '/jobs/' . rawurlencode($jobId), null, 15);
    }

    public static function startScript(string $topicHint = '', bool $requireCreatorAroll = true): array
    {
        return self::request('POST', '/kra/schedule/1-start-script', [
            'topic_hint' => $topicHint,
            'require_creator_aroll' => $requireCreatorAroll,
        ], 20);
    }

    public static function gate(string $expectedFile = 'a_roll_raw.mp4'): array
    {
        return self::request('GET', '/kra/schedule/2-check-gate?expected_file=' . rawurlencode($expectedFile), null, 10);
    }

    public static function produceAndUpload(string $rawVideoFilename = 'a_roll_raw.mp4'): array
    {
        return self::request('POST', '/kra/schedule/3-produce-and-upload?raw_video_filename=' . rawurlencode($rawVideoFilename), null, 20);
    }

    public static function episodes(int $limit = 15): array
    {
        $limit = max(1, min(100, $limit));
        return self::request('GET', '/kra/memory/episodes?limit=' . $limit, null, 15);
    }

    public static function syncViews(int $limit = 50): array
    {
        $limit = max(1, min(50, $limit));
        return self::request('POST', '/kra/schedule/sync-views?limit=' . $limit, null, 30);
    }

    public static function weeklyReport(bool $send = true, int $top = 5): array
    {
        $top = max(1, min(20, $top));
        return self::request('POST', '/kra/schedule/weekly-report?send=' . ($send ? '1' : '0') . '&top=' . $top, null, 60);
    }

    public static function publishShorts(string $title = '', string $privacy = 'unlisted', bool $force = false): array
    {
        $query = http_build_query(['title' => $title, 'privacy' => $privacy, 'force' => $force ? 'true' : 'false']);
        return self::request('POST', '/kra/schedule/publish-shorts?' . $query, null, 120);
    }

    /** Trigger tunggal; phase IDEATION_SCRIPT atau PRODUCE_AND_UPLOAD. */
    public static function trigger(string $phase, string $topicOrPrompt = '', string $rawVideoFilename = 'a_roll_raw.mp4', string $remotionComposition = ''): array
    {
        $phase = strtoupper(trim($phase));
        if (!in_array($phase, ['IDEATION_SCRIPT', 'PRODUCE_AND_UPLOAD'], true)) {
            throw new InvalidArgumentException('Fase Superbots harus IDEATION_SCRIPT atau PRODUCE_AND_UPLOAD.');
        }
        return self::request('POST', '/kra/n100n-trigger', [
            'phase' => $phase,
            'topic_or_prompt' => $topicOrPrompt,
            'raw_video_filename' => $rawVideoFilename,
            'remotion_composition' => $remotionComposition,
        ], 20);
    }

    private static function request(string $method, string $path, ?array $body = null, int $timeoutSeconds = 30, ?int $retry = null): array
    {
        if (!self::isConfigured()) {
            throw new RuntimeException('KRA_SUPERBOTS_BASE_URL belum diatur pada server KRA.');
        }
        $retry = $retry ?? (strtoupper($method) === 'GET' ? 1 : 0);
        $baseUrl = self::baseUrl();
        $parts = parse_url($baseUrl);
        if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            throw new RuntimeException('Superbots base URL harus URL HTTP/HTTPS tanpa kredensial tersemat.');
        }
        $url = $baseUrl . $path;
        $payload = $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers = ['Content-Type: application/json', 'Accept: application/json'];

        $lastError = null;
        for ($attempt = 0; $attempt <= $retry; $attempt++) {
            [$status, $raw] = self::http($method, $url, $headers, $payload, $timeoutSeconds);
            $data = json_decode($raw, true);
            if ($status >= 200 && $status < 300) {
                return is_array($data) ? $data : ['ok' => true, 'raw' => $raw];
            }
            $message = is_array($data) && isset($data['error'])
                ? (string) $data['error']
                : (is_array($data) && isset($data['detail']) ? (is_string($data['detail']) ? $data['detail'] : json_encode($data['detail'])) : substr($raw, 0, 300));
            $lastError = new RuntimeException('Superbots membalas HTTP ' . $status . ': ' . $message);
            if ($status < 500 && $status !== 429) break;
            if ($attempt < $retry) usleep(250000 * ($attempt + 1));
        }
        throw $lastError ?? new RuntimeException('Permintaan ke Superbots gagal tanpa keterangan.');
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
                if ($raw === false) throw new RuntimeException('Koneksi ke Superbots gagal atau timeout.');
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
        if ($raw === false) throw new RuntimeException('Koneksi ke Superbots gagal atau timeout.');
        $status = 200;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string) $line, $match) === 1) $status = (int) $match[1];
        }
        return [$status, (string) $raw];
    }
}
