<?php
declare(strict_types=1);

/**
 * KraYouTubeUploader — mengirim video jadi dari disk server KRA ke channel
 * YouTube yang sudah diotorisasi (YouTube Data API v3, resumable upload).
 *
 * Hanya dipanggil dari action supervisor `youtube-upload` dengan konfirmasi
 * manusia eksplisit. File sumber harus berada di salah satu folder media
 * yang diizinkan (path relatif), supaya endpoint ini tidak bisa dipakai
 * membaca file sembarangan di server.
 */
final class KraYouTubeUploader
{
    private const CHUNK_BYTES = 8388608; // 8 MiB — kelipatan 256 KiB (262144) sesuai aturan upload resumable Google.
    private const VIDEO_MIME = [
        'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'mkv' => 'video/x-matroska',
        'webm' => 'video/webm', 'avi' => 'video/x-msvideo', 'm4v' => 'video/x-m4v',
        'mpg' => 'video/mpeg', 'mpeg' => 'video/mpeg', 'wmv' => 'video/x-ms-wmv',
        'flv' => 'video/x-flv', '3gp' => 'video/3gpp',
    ];
    private const IMAGE_MIME = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png'];

    private static function curlAvailable(): void
    {
        if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL is required for YouTube upload. Ask the hosting administrator to enable it.');
    }

    /** @return list<string> */
    private static function mediaRoots(): array
    {
        $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        $roots = [
            $projectRoot . DIRECTORY_SEPARATOR . '.temp',
            $projectRoot . DIRECTORY_SEPARATOR . 'files',
            $projectRoot . DIRECTORY_SEPARATOR . 'n100n' . DIRECTORY_SEPARATOR . 'files',
        ];
        $extra = trim((string) getenv('KRA_MEDIA_DIR'));
        if ($extra !== '') $roots[] = $extra;
        return $roots;
    }

    private static function normalizePath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        return DIRECTORY_SEPARATOR === '\\' ? strtolower($path) : $path;
    }

    /** Resolves a relative media path under the allowed roots; rejects traversal. */
    private static function resolveMediaFile(string $relative, array $mimeMap, string $kind): array
    {
        $relative = trim(str_replace('\\', '/', $relative));
        if ($relative === '' || str_contains($relative, "\0") || str_starts_with($relative, '/') || preg_match('/^[a-zA-Z]:\//', $relative)) {
            throw new InvalidArgumentException('Provide the ' . $kind . ' as a path relative to an allowed media folder (for example .temp/, files/, or n100n/files/).');
        }
        $extension = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
        if (!isset($mimeMap[$extension])) {
            throw new InvalidArgumentException('Unsupported ' . $kind . ' file type .' . $extension . '. Allowed: ' . implode(', ', array_keys($mimeMap)) . '.');
        }
        foreach (self::mediaRoots() as $root) {
            $realRoot = realpath($root);
            if ($realRoot === false) continue;
            $candidate = realpath($realRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative));
            if ($candidate === false || !is_file($candidate)) continue;
            $prefix = rtrim(self::normalizePath($realRoot), '/') . '/';
            if (!str_starts_with(self::normalizePath($candidate), $prefix)) continue;
            if (!is_readable($candidate)) throw new InvalidArgumentException('The ' . $kind . ' file exists but is not readable by the KRA server.');
            return ['path' => $candidate, 'mime' => $mimeMap[$extension], 'size' => (int) filesize($candidate)];
        }
        throw new InvalidArgumentException('The ' . $kind . ' file was not found under an allowed media folder (.temp/, files/, n100n/files/' . (trim((string) getenv('KRA_MEDIA_DIR')) !== '' ? ', or KRA_MEDIA_DIR' : '') . ').');
    }

    /** Low-level HTTPS call that also returns response headers; never follows redirects. */
    private static function send(string $method, string $url, array $headers, ?string $body, int $timeoutSeconds): array
    {
        $responseHeaders = [];
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                return strlen($line);
            },
        ]);
        if ($body !== null) curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        if ($timeoutSeconds === 0) {
            // Long uploads: no total cap, but abort a stalled transfer.
            curl_setopt($handle, CURLOPT_LOW_SPEED_LIMIT, 51200);
            curl_setopt($handle, CURLOPT_LOW_SPEED_TIME, 180);
        }
        $raw = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        return ['status' => $status, 'headers' => $responseHeaders, 'body' => is_string($raw) ? $raw : '', 'error' => $error];
    }

    private static function googleError(array $response, string $what): RuntimeException
    {
        $decoded = json_decode((string) $response['body'], true);
        $message = is_array($decoded) ? (string) ($decoded['error']['message'] ?? '') : '';
        $reason = is_array($decoded) ? (string) ($decoded['error']['errors'][0]['reason'] ?? '') : '';
        $detail = $response['error'] !== '' ? $response['error'] : ('HTTP ' . $response['status'] . ($reason !== '' ? ' (' . $reason . ')' : '') . ($message !== '' ? ': ' . $message : ''));
        return new RuntimeException('YouTube ' . $what . ' failed — ' . $detail);
    }

    public static function upload(array $input): array
    {
        self::curlAvailable();
        $status = KraYouTubeOAuth::status();
        if (!$status['connected']) throw new RuntimeException('YouTube is not connected. Authorize the channel in Creator Integration Settings first.');
        if (!$status['uploadGranted']) throw new RuntimeException('The connected grant does not include upload permission yet. Click AUTHORIZE YOUTUBE CHANNEL again and approve the upload scope, then retry.');

        $title = trim((string) ($input['title'] ?? ''));
        $description = (string) ($input['description'] ?? '');
        $titleLength = function_exists('mb_strlen') ? mb_strlen($title) : strlen($title);
        if ($title === '' || $titleLength > 100 || str_contains($title, '<') || str_contains($title, '>')) {
            throw new InvalidArgumentException('Title is required, max 100 characters, and must not contain < or >.');
        }
        if (strlen($description) > 5000 || str_contains($description, '<') || str_contains($description, '>')) {
            throw new InvalidArgumentException('Description must be at most 5000 bytes and must not contain < or >.');
        }
        $rawTags = $input['tags'] ?? [];
        if (is_string($rawTags)) $rawTags = explode(',', $rawTags);
        $tags = [];
        foreach (is_array($rawTags) ? $rawTags : [] as $tag) {
            $tag = trim((string) $tag);
            if ($tag !== '' && !str_contains($tag, '<') && !str_contains($tag, '>')) $tags[] = $tag;
            if (count($tags) >= 40) break;
        }
        if (strlen(implode(',', $tags)) > 480) throw new InvalidArgumentException('Combined tags are too long (YouTube allows roughly 500 characters including commas).');
        $privacy = strtolower(trim((string) ($input['privacy'] ?? 'private')));
        if (!in_array($privacy, ['private', 'unlisted', 'public'], true)) {
            throw new InvalidArgumentException('Privacy must be private, unlisted, or public.');
        }
        $categoryId = preg_replace('/\D+/', '', (string) ($input['categoryId'] ?? '22')) ?: '22';
        $madeForKids = filter_var($input['madeForKids'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $notifySubscribers = filter_var($input['notifySubscribers'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $video = self::resolveMediaFile((string) ($input['file'] ?? ''), self::VIDEO_MIME, 'video');
        if ($video['size'] <= 0) throw new InvalidArgumentException('The video file is empty.');
        $thumbnail = null;
        $thumbnailWarning = '';
        if (trim((string) ($input['thumbnail'] ?? '')) !== '') {
            try {
                $thumbnail = self::resolveMediaFile((string) $input['thumbnail'], self::IMAGE_MIME, 'thumbnail');
                if ($thumbnail['size'] > 2 * 1024 * 1024) {
                    $thumbnailWarning = 'Thumbnail skipped: larger than the 2 MB YouTube limit.';
                    $thumbnail = null;
                }
            } catch (Throwable $error) {
                $thumbnailWarning = 'Thumbnail skipped: ' . $error->getMessage();
            }
        }

        if (function_exists('set_time_limit')) @set_time_limit(0);
        $token = KraYouTubeOAuth::accessToken();

        // 1) Open a resumable upload session with the video metadata.
        $metadata = [
            'snippet' => [
                'title' => $title,
                'description' => $description,
                'tags' => $tags,
                'categoryId' => $categoryId,
            ],
            'status' => [
                'privacyStatus' => $privacy,
                'selfDeclaredMadeForKids' => $madeForKids,
            ],
        ];
        $initiateUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=' . ($notifySubscribers ? 'true' : 'false');
        $session = self::send('POST', $initiateUrl, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json; charset=UTF-8',
            'X-Upload-Content-Type: ' . $video['mime'],
            'X-Upload-Content-Length: ' . $video['size'],
        ], json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 60);
        $sessionUri = (string) ($session['headers']['location'] ?? '');
        if ($session['status'] < 200 || $session['status'] >= 300 || $sessionUri === '') {
            throw self::googleError($session, 'upload session');
        }

        // 2) Send the bytes in chunks, resuming from Google's reported offset after a failure.
        $stream = fopen($video['path'], 'rb');
        if ($stream === false) throw new RuntimeException('Could not open the video file for upload.');
        $total = $video['size'];
        $offset = 0;
        $videoResource = null;
        try {
            while ($offset < $total) {
                $chunkSize = (int) min(self::CHUNK_BYTES, $total - $offset);
                if (fseek($stream, $offset) !== 0) throw new RuntimeException('Could not seek inside the video file during upload.');
                $chunk = $chunkSize > 0 ? fread($stream, $chunkSize) : '';
                if (!is_string($chunk) || strlen($chunk) !== $chunkSize) throw new RuntimeException('Could not read the video file during upload.');
                $end = $offset + $chunkSize - 1;
                $lastResponse = null;
                for ($attempt = 1; $attempt <= 3; $attempt++) {
                    $lastResponse = self::send('PUT', $sessionUri, [
                        'Authorization: Bearer ' . $token,
                        'Content-Type: ' . $video['mime'],
                        'Content-Length: ' . $chunkSize,
                        'Content-Range: bytes ' . $offset . '-' . $end . '/' . $total,
                    ], $chunk, 0);
                    if ($lastResponse['status'] === 200 || $lastResponse['status'] === 201) {
                        $videoResource = json_decode((string) $lastResponse['body'], true);
                        $offset = $total;
                        break;
                    }
                    if ($lastResponse['status'] === 308) {
                        $offset = self::receivedOffset($lastResponse, $end + 1);
                        break;
                    }
                    if ($attempt === 3) throw self::googleError($lastResponse, 'upload transfer');
                    // Ask Google how many bytes landed, then continue from there.
                    $probe = self::send('PUT', $sessionUri, [
                        'Authorization: Bearer ' . $token,
                        'Content-Length: 0',
                        'Content-Range: bytes */' . $total,
                    ], '', 60);
                    if ($probe['status'] === 200 || $probe['status'] === 201) {
                        $videoResource = json_decode((string) $probe['body'], true);
                        $offset = $total;
                        break;
                    }
                    if ($probe['status'] === 308) {
                        $offset = self::receivedOffset($probe, $offset);
                        break;
                    }
                    if ($probe['status'] === 404) throw new RuntimeException('The YouTube upload session expired before the transfer finished. Run the upload again.');
                }
            }
        } finally {
            fclose($stream);
        }
        if (!is_array($videoResource) || empty($videoResource['id'])) {
            throw new RuntimeException('YouTube accepted the bytes but did not return a video id. Check YouTube Studio before retrying to avoid a duplicate.');
        }
        $videoId = (string) $videoResource['id'];

        // 3) Optional custom thumbnail (best-effort; the video is already uploaded).
        $thumbnailSet = false;
        if ($thumbnail !== null) {
            $imageBytes = file_get_contents($thumbnail['path']);
            if (is_string($imageBytes) && $imageBytes !== '') {
                $thumbResponse = self::send('POST', 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=' . urlencode($videoId) . '&uploadType=media', [
                    'Authorization: Bearer ' . $token,
                    'Content-Type: ' . $thumbnail['mime'],
                    'Content-Length: ' . strlen($imageBytes),
                ], $imageBytes, 120);
                if ($thumbResponse['status'] >= 200 && $thumbResponse['status'] < 300) $thumbnailSet = true;
                else $thumbnailWarning = 'Thumbnail could not be set (HTTP ' . $thumbResponse['status'] . '); set it in YouTube Studio.';
            }
        }

        error_log('[KraYouTubeUploader] Uploaded video ' . $videoId . ' (privacy=' . $privacy . ', bytes=' . $total . ') to channel ' . $status['channelId'] . '.');
        return [
            'videoId' => $videoId,
            'title' => $title,
            'privacy' => $privacy,
            'uploadStatus' => (string) ($videoResource['status']['uploadStatus'] ?? 'uploaded'),
            'watchUrl' => 'https://www.youtube.com/watch?v=' . $videoId,
            'studioUrl' => 'https://studio.youtube.com/video/' . $videoId . '/edit',
            'channelId' => $status['channelId'],
            'channelTitle' => $status['channelTitle'],
            'thumbnailSet' => $thumbnailSet,
            'warnings' => array_values(array_filter([$thumbnailWarning])),
        ];
    }

    /** Parses Google's `Range: bytes=0-123` resume header into the next expected offset. */
    private static function receivedOffset(array $response, int $fallback): int
    {
        $range = (string) ($response['headers']['range'] ?? '');
        if (preg_match('/bytes=0-(\d+)/', $range, $match)) return ((int) $match[1]) + 1;
        return $fallback;
    }
}
