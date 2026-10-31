<?php
declare(strict_types=1);

final class KraYouTubeOAuth
{
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

    public static function status(): array
    {
        $settings = KraIntegrationSettings::youtube();
        return [
            'configured' => $settings['clientId'] !== '' && $settings['clientSecret'] !== '' && $settings['redirectUri'] !== '',
            'connected' => $settings['accessToken'] !== '' && $settings['channelId'] !== '',
            'channelId' => $settings['channelId'],
            'channelTitle' => $settings['channelTitle'],
            'clientId' => $settings['clientId'],
            'redirectUri' => $settings['redirectUri'],
            'hasClientSecret' => $settings['clientSecret'] !== '',
            'environmentManaged' => (string) getenv('KRA_YOUTUBE_CLIENT_ID') !== '' || (string) getenv('KRA_YOUTUBE_CLIENT_SECRET') !== '' || (string) getenv('KRA_YOUTUBE_REDIRECT_URI') !== '',
        ];
    }

    public static function authorizationUrl(int $userId): string
    {
        $settings = KraIntegrationSettings::youtube();
        if ($settings['clientId'] === '' || $settings['clientSecret'] === '' || $settings['redirectUri'] === '') {
            throw new RuntimeException('Save the Google OAuth client ID, client secret, and registered callback URL first.');
        }
        $state = bin2hex(random_bytes(32));
        KraIntegrationSettings::setYoutubeOAuthState($state, $userId);
        $query = http_build_query([
            'client_id' => $settings['clientId'],
            'redirect_uri' => $settings['redirectUri'],
            'response_type' => 'code',
            'scope' => 'https://www.googleapis.com/auth/youtube.readonly',
            'access_type' => 'offline',
            'include_granted_scopes' => 'true',
            'prompt' => 'consent',
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . $query;
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

    public static function callback(): never
    {
        $destination = '../web/index.html?youtube=error';
        try {
            $state = (string) ($_GET['state'] ?? '');
            if ($state === '' || !KraIntegrationSettings::consumeYoutubeOAuthState($state)) {
                throw new RuntimeException('Invalid or expired OAuth state.');
            }
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
            $destination = '../web/index.html?youtube=connected';
        } catch (Throwable $error) {
            // Do not echo OAuth codes, provider responses, tokens, or exception details to the browser.
            error_log('[KraYouTubeOAuth] ' . $error->getMessage());
        }
        header('Location: ' . $destination, true, 302);
        exit;
    }
}
