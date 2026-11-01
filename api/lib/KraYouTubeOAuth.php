<?php
declare(strict_types=1);

final class KraYouTubeOAuth
{
    public const READ_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
    public const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
    public const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly';

    private static function request(string $url, array $options = []): array
    {
        if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL is required for Google OAuth. Ask the hosting administrator to enable it.');
        $handle = curl_init($url);
        curl_setopt_array($handle, $options + [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        if (!is_string($body) || $status < 200 || $status >= 300) {
            throw new RuntimeException($error !== '' ? 'Google OAuth request failed: ' . $error : 'Google OAuth returned HTTP ' . $status . '.');
        }
        $payload = json_decode($body, true);
        if (!is_array($payload)) throw new RuntimeException('Google OAuth returned an invalid response.');
        return $payload;
    }

    /** @return list<string> OAuth scopes Google reported for the stored grant. */
    public static function grantedScopes(array $settings): array
    {
        $scopes = preg_split('/\s+/', trim((string) ($settings['grantedScopes'] ?? ''))) ?: [];
        return array_values(array_filter($scopes, static fn (string $scope): bool => $scope !== ''));
    }

    public static function status(): array
    {
        $settings = KraIntegrationSettings::youtube();
        $granted = self::grantedScopes($settings);
        $uploadGranted = in_array(self::UPLOAD_SCOPE, $granted, true);
        $connected = $settings['accessToken'] !== '' && $settings['channelId'] !== '';
        return [
            'configured' => $settings['clientId'] !== '' && $settings['clientSecret'] !== '' && $settings['redirectUri'] !== '',
            'connected' => $connected,
            'channelId' => $settings['channelId'],
            'channelTitle' => $settings['channelTitle'],
            'clientId' => $settings['clientId'],
            'redirectUri' => $settings['redirectUri'],
            'hasClientSecret' => $settings['clientSecret'] !== '',
            'grantedScopes' => $granted,
            'uploadGranted' => $uploadGranted,
            'analyticsGranted' => in_array(self::ANALYTICS_SCOPE, $granted, true),
            'canUpload' => $connected && $uploadGranted,
            'needsReconnectForUpload' => $connected && !$uploadGranted,
            'environmentManaged' => (string) getenv('KRA_YOUTUBE_CLIENT_ID') !== '' || (string) getenv('KRA_YOUTUBE_CLIENT_SECRET') !== '' || (string) getenv('KRA_YOUTUBE_REDIRECT_URI') !== '',
        ];
    }

    public static function authorizationUrl(int $userId, string $client = 'web'): string
    {
        $settings = KraIntegrationSettings::youtube();
        if ($settings['clientId'] === '' || $settings['clientSecret'] === '' || $settings['redirectUri'] === '') {
            throw new RuntimeException('Save the Google OAuth client ID, client secret, and registered callback URL first.');
        }
        $state = bin2hex(random_bytes(32));
        KraIntegrationSettings::setYoutubeOAuthState($state, $userId, $client);
        $query = http_build_query([
            'client_id' => $settings['clientId'],
            'redirect_uri' => $settings['redirectUri'],
            'response_type' => 'code',
            // Read scope identifies the channel; upload scope lets a supervisor
            // send finished videos to YouTube Studio from KRA (see KraYouTubeUploader).
            // + analytics scope feeds the 28-day Creator review card.
            'scope' => self::READ_SCOPE . ' ' . self::UPLOAD_SCOPE . ' ' . self::ANALYTICS_SCOPE,
            'access_type' => 'offline',
            'include_granted_scopes' => 'true',
            'prompt' => 'consent',
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . $query;
    }

    /**
     * Returns a valid access token for API calls, refreshing it with the
     * stored refresh token when it is expired or about to expire.
     */
    public static function accessToken(): string
    {
        $settings = KraIntegrationSettings::youtube();
        if ($settings['accessToken'] === '' && $settings['refreshToken'] === '') {
            throw new RuntimeException('YouTube is not connected. Authorize the channel in Creator Integration Settings first.');
        }
        if ($settings['accessToken'] !== '' && (int) $settings['expiresAt'] > time() + 120) {
            return $settings['accessToken'];
        }
        if ($settings['refreshToken'] === '') {
            throw new RuntimeException('The stored YouTube access token has expired and no refresh token is available. Reconnect the channel.');
        }
        try {
            $tokens = self::request('https://oauth2.googleapis.com/token', [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query([
                    'client_id' => $settings['clientId'],
                    'client_secret' => $settings['clientSecret'],
                    'refresh_token' => $settings['refreshToken'],
                    'grant_type' => 'refresh_token',
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            ]);
        } catch (Throwable $error) {
            // A revoked/expired grant (invalid_grant) is surfaced as a failed
            // token request; do not leak Google's response body to callers.
            error_log('[KraYouTubeOAuth] Token refresh failed: ' . $error->getMessage());
            throw new RuntimeException('YouTube token refresh failed. The authorization may have expired or been revoked; reconnect the channel in Creator Integration Settings.');
        }
        $accessToken = (string) ($tokens['access_token'] ?? '');
        if ($accessToken === '') throw new RuntimeException('Google did not return a refreshed access token.');
        // Keep previously granted scopes when Google omits them on refresh.
        if (empty($tokens['scope']) && $settings['grantedScopes'] !== '') $tokens['scope'] = $settings['grantedScopes'];
        KraIntegrationSettings::saveYoutubeTokens($tokens, $settings['channelId'], $settings['channelTitle']);
        return $accessToken;
    }

    public static function disconnect(): void
    {
        $settings = KraIntegrationSettings::youtube();
        $token = $settings['refreshToken'] !== '' ? $settings['refreshToken'] : $settings['accessToken'];
        if ($token !== '' && function_exists('curl_init')) {
            $handle = curl_init('https://oauth2.googleapis.com/revoke');
            curl_setopt_array($handle, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query(['token' => $token]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);
            curl_exec($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            $error = curl_error($handle);
            curl_close($handle);
            if (($status < 200 || $status >= 300) && $status !== 400) {
                error_log('[KraYouTubeOAuth] Token revocation request failed; KRA credentials were cleared. ' . $error);
            }
        } elseif ($token !== '') {
            error_log('[KraYouTubeOAuth] PHP cURL unavailable during revocation; KRA credentials were cleared locally.');
        }
        KraIntegrationSettings::disconnectYoutube();
    }

    /** GET against a Google API with the stored (auto-refreshed) access token. */
    private static function apiGet(string $url): array
    {
        return self::request($url, [
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . self::accessToken(), 'Accept: application/json'],
        ]);
    }

    /** @return list<array<string,mixed>> Analytics rows keyed by column header name. */
    private static function analyticsRows(array $report): array
    {
        $names = [];
        foreach (($report['columnHeaders'] ?? []) as $header) {
            $names[] = is_array($header) ? (string) ($header['name'] ?? '') : '';
        }
        $rows = [];
        foreach (($report['rows'] ?? []) as $row) {
            if (!is_array($row)) continue;
            $assoc = [];
            foreach ($names as $index => $name) {
                if ($name !== '') $assoc[$name] = $row[$index] ?? null;
            }
            $rows[] = $assoc;
        }
        return $rows;
    }

    /**
     * Last-28-days channel summary for the Creator feedback loop.
     * Needs the yt-analytics.readonly grant AND the "YouTube Analytics API"
     * enabled in the same Google Cloud project as the OAuth client.
     */
    public static function analyticsSummary(): array
    {
        $settings = KraIntegrationSettings::youtube();
        if ($settings['channelId'] === '') {
            throw new RuntimeException('YouTube channel belum terhubung. Hubungkan dulu lewat Creator Integration Settings.');
        }
        if (!in_array(self::ANALYTICS_SCOPE, self::grantedScopes($settings), true)) {
            throw new RuntimeException('Izin YouTube Analytics (yt-analytics.readonly) belum termasuk di consent saat ini. Klik Connect sekali lagi untuk memperbaruinya, dan aktifkan "YouTube Analytics API" di Google Cloud Console.');
        }
        $end = gmdate('Y-m-d', time() - 86400);
        $start = gmdate('Y-m-d', time() - 28 * 86400);
        $base = 'https://youtubeanalytics.googleapis.com/v2/reports?';
        try {
            $totalsReport = self::apiGet($base . http_build_query([
                'ids' => 'channel==MINE',
                'startDate' => $start,
                'endDate' => $end,
                'metrics' => 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares',
            ], '', '&', PHP_QUERY_RFC3986));
            $topReport = self::apiGet($base . http_build_query([
                'ids' => 'channel==MINE',
                'startDate' => $start,
                'endDate' => $end,
                'dimensions' => 'video',
                'metrics' => 'views,estimatedMinutesWatched,averageViewDuration',
                'sort' => '-views',
                'maxResults' => 5,
            ], '', '&', PHP_QUERY_RFC3986));
        } catch (RuntimeException $e) {
            if (str_contains($e->getMessage(), 'HTTP 403')) {
                throw new RuntimeException('YouTube Analytics API menolak akses (HTTP 403). Aktifkan "YouTube Analytics API" di Google Cloud Console untuk proyek OAuth yang sama, lalu coba lagi.');
            }
            throw $e;
        }
        $totalsRow = self::analyticsRows($totalsReport)[0] ?? [];
        $int = static fn (string $key): int => (int) round((float) ($totalsRow[$key] ?? 0));
        $topRows = self::analyticsRows($topReport);
        $videoIds = [];
        foreach ($topRows as $row) {
            $id = (string) ($row['video'] ?? '');
            if ($id !== '') $videoIds[] = $id;
        }
        $titles = [];
        if ($videoIds !== []) {
            try {
                $videos = self::apiGet('https://www.googleapis.com/youtube/v3/videos?' . http_build_query([
                    'part' => 'snippet',
                    'id' => implode(',', $videoIds),
                ], '', '&', PHP_QUERY_RFC3986));
                foreach (($videos['items'] ?? []) as $item) {
                    if (is_array($item)) $titles[(string) ($item['id'] ?? '')] = (string) ($item['snippet']['title'] ?? '');
                }
            } catch (Throwable $ignored) {
                // Titles are decoration; IDs still identify the videos.
            }
        }
        $topVideos = [];
        foreach ($topRows as $row) {
            $id = (string) ($row['video'] ?? '');
            $topVideos[] = [
                'id' => $id,
                'title' => $titles[$id] ?? $id,
                'url' => $id !== '' ? 'https://www.youtube.com/watch?v=' . rawurlencode($id) : '',
                'views' => (int) round((float) ($row['views'] ?? 0)),
                'watchMinutes' => (int) round((float) ($row['estimatedMinutesWatched'] ?? 0)),
                'averageViewDuration' => (int) round((float) ($row['averageViewDuration'] ?? 0)),
            ];
        }
        return [
            'period' => ['startDate' => $start, 'endDate' => $end, 'days' => 28],
            'channelTitle' => $settings['channelTitle'],
            'totals' => [
                'views' => $int('views'),
                'watchMinutes' => $int('estimatedMinutesWatched'),
                'watchHours' => round(((float) ($totalsRow['estimatedMinutesWatched'] ?? 0)) / 60, 1),
                'averageViewDuration' => $int('averageViewDuration'),
                'subscribersGained' => $int('subscribersGained'),
                'subscribersLost' => $int('subscribersLost'),
                'subscribersNet' => $int('subscribersGained') - $int('subscribersLost'),
                'likes' => $int('likes'),
                'comments' => $int('comments'),
                'shares' => $int('shares'),
            ],
            'topVideos' => $topVideos,
        ];
    }

    public static function callback(): never
    {
        $client = 'web';
        $destination = '../web/index.html?youtube=error';
        try {
            $state = (string) ($_GET['state'] ?? '');
            $meta = $state === '' ? null : KraIntegrationSettings::consumeYoutubeOAuthStateMeta($state);
            if ($meta === null) {
                throw new RuntimeException('Invalid or expired OAuth state.');
            }
            $client = $meta['client'];
            if (!empty($_GET['error'])) throw new RuntimeException('Google authorization was not completed.');
            $code = (string) ($_GET['code'] ?? '');
            if ($code === '' || strlen($code) > 4096) throw new RuntimeException('Google authorization code is missing.');
            $settings = KraIntegrationSettings::youtube();
            $tokens = self::request('https://oauth2.googleapis.com/token', [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query([
                    'code' => $code,
                    'client_id' => $settings['clientId'],
                    'client_secret' => $settings['clientSecret'],
                    'redirect_uri' => $settings['redirectUri'],
                    'grant_type' => 'authorization_code',
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            ]);
            $accessToken = (string) ($tokens['access_token'] ?? '');
            if ($accessToken === '') throw new RuntimeException('Google did not return an access token.');
            $channels = self::request('https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true', [
                CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
            ]);
            $channel = $channels['items'][0] ?? null;
            if (!is_array($channel) || empty($channel['id'])) throw new RuntimeException('No YouTube channel was returned by Google for this account.');
            KraIntegrationSettings::saveYoutubeTokens($tokens, (string) $channel['id'], (string) ($channel['snippet']['title'] ?? 'YouTube channel'));
            $destination = $client === 'desktop'
                ? '../web/youtube-connected.html?youtube=connected'
                : '../web/index.html?youtube=connected';
        } catch (Throwable $error) {
            // Do not echo OAuth codes, provider responses, tokens, or exception details to the browser.
            error_log('[KraYouTubeOAuth] ' . $error->getMessage());
            if ($client === 'desktop') $destination = '../web/youtube-connected.html?youtube=error';
        }
        header('Location: ' . $destination, true, 302);
        exit;
    }
}
