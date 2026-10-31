<?php
declare(strict_types=1);

/** Server-only integration settings. Values are never returned by read APIs. */
final class KraIntegrationSettings
{
    private static function path(): string
    {
        $projectRoot = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        $configured = trim((string) getenv('KRA_PRIVATE_CONFIG_DIR'));
        $directory = $configured !== ''
            ? $configured
            : rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'kra-private-' . substr(hash('sha256', $projectRoot), 0, 16);
        $created = !is_dir($directory);
        if ($created && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create a private integration settings directory. Configure KRA_PRIVATE_CONFIG_DIR outside the public web root.');
        }
        $realDirectory = realpath($directory);
        if ($realDirectory === false || $realDirectory === $projectRoot || str_starts_with($realDirectory . DIRECTORY_SEPARATOR, rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('KRA_PRIVATE_CONFIG_DIR must be outside the application and public web root.');
        }
        if ($created && DIRECTORY_SEPARATOR !== '\\') @chmod($realDirectory, 0700);
        $permissions = DIRECTORY_SEPARATOR !== '\\' ? @fileperms($realDirectory) : false;
        if (is_int($permissions) && ($permissions & 0077) !== 0) {
            throw new RuntimeException('The private settings directory must not be accessible to group or other users; restrict it to mode 0700.');
        }
        return $realDirectory . DIRECTORY_SEPARATOR . 'integrations.json';
    }

    public static function all(): array
    {
        $path = self::path();
        if (!is_file($path)) return [];
        $raw = @file_get_contents($path);
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    private static function saveAll(array $settings): void
    {
        $path = self::path();
        $json = json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $tmp = $path . '.' . bin2hex(random_bytes(8)) . '.tmp';
        if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
            throw new RuntimeException('Could not save private integration settings. Check write permissions for KRA_PRIVATE_CONFIG_DIR or the PHP temporary directory.');
        }
        if (DIRECTORY_SEPARATOR !== '\\') @chmod($tmp, 0600);
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('Could not atomically save private integration settings.');
        }
        if (DIRECTORY_SEPARATOR !== '\\') @chmod($path, 0600);
    }

    private static function update(string $section, array $values): void
    {
        $all = self::all();
        $all[$section] = array_merge(is_array($all[$section] ?? null) ? $all[$section] : [], $values);
        self::saveAll($all);
    }

    public static function n100n(): array
    {
        $saved = self::all()['n100n'] ?? [];
        if (!is_array($saved)) $saved = [];
        $url = trim((string) (getenv('KRA_N100N_BASE_URL') ?: getenv('KRA_N100N_URL') ?: ($saved['baseUrl'] ?? 'http://127.0.0.1:5679')));
        $key = trim((string) (getenv('KRA_N100N_API_KEY') ?: getenv('KRA_N100N_TOKEN') ?: ($saved['apiKey'] ?? '')));
        return ['baseUrl' => rtrim($url, '/'), 'apiKey' => $key];
    }

    /** Safe URL for browser-facing status/settings responses; omits userinfo, query, and fragment. */
    public static function publicN100nBaseUrl(): string
    {
        $url = self::n100n()['baseUrl'];
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) return '';
        $safe = strtolower((string) $parts['scheme']) . '://' . (string) $parts['host'];
        if (isset($parts['port'])) $safe .= ':' . (int) $parts['port'];
        $safe .= (string) ($parts['path'] ?? '');
        return rtrim($safe, '/');
    }

    public static function saveN100n(string $url, ?string $key, bool $clearKey = false): void
    {
        $url = trim($url);
        $parts = parse_url($url);
        if ($url === '' || strlen($url) > 2048 || !is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            throw new InvalidArgumentException('Enter a valid N100N service URL using http:// or https://, without embedded credentials, query parameters, or fragments.');
        }
        $values = ['baseUrl' => rtrim($url, '/')];
        if ($clearKey) $values['apiKey'] = '';
        elseif ($key !== null && trim($key) !== '') {
            if (strlen($key) > 2048 || preg_match('/[\r\n]/', $key)) throw new InvalidArgumentException('The N100N API key is invalid.');
            $values['apiKey'] = trim($key);
        }
        self::update('n100n', $values);
    }

    public static function youtube(): array
    {
        $saved = self::all()['youtube'] ?? [];
        if (!is_array($saved)) $saved = [];
        return [
            'clientId' => trim((string) (getenv('KRA_YOUTUBE_CLIENT_ID') ?: ($saved['clientId'] ?? ''))),
            'clientSecret' => trim((string) (getenv('KRA_YOUTUBE_CLIENT_SECRET') ?: ($saved['clientSecret'] ?? ''))),
            'redirectUri' => trim((string) (getenv('KRA_YOUTUBE_REDIRECT_URI') ?: ($saved['redirectUri'] ?? ''))),
            'accessToken' => (string) ($saved['accessToken'] ?? ''),
            'refreshToken' => (string) ($saved['refreshToken'] ?? ''),
            'expiresAt' => (int) ($saved['expiresAt'] ?? 0),
            'channelId' => (string) ($saved['channelId'] ?? ''),
            'channelTitle' => (string) ($saved['channelTitle'] ?? ''),
        ];
    }

    public static function saveYoutubeCredentials(string $clientId, ?string $clientSecret, string $redirectUri): void
    {
        $clientId = trim($clientId);
        $redirectUri = trim($redirectUri);
        $current = self::youtube();
        if ($clientId === '' || strlen($clientId) > 512 || preg_match('/[\r\n]/', $clientId)) {
            throw new InvalidArgumentException('Enter a valid Google OAuth client ID.');
        }
        $parts = parse_url($redirectUri);
        if ($redirectUri === '' || strlen($redirectUri) > 2048 || !is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['https', 'http'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('Enter the exact HTTPS callback URL registered in Google Cloud. HTTP is permitted only for localhost development.');
        }
        if (strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            && !in_array(strtolower((string) ($parts['host'] ?? '')), ['localhost', '127.0.0.1', '[::1]'], true)) {
            throw new InvalidArgumentException('YouTube OAuth callback URLs must use HTTPS outside localhost.');
        }
        $values = ['clientId' => $clientId, 'redirectUri' => $redirectUri];
        if ($clientSecret !== null && trim($clientSecret) !== '') {
            if (strlen($clientSecret) > 1024 || preg_match('/[\r\n]/', $clientSecret)) throw new InvalidArgumentException('The Google OAuth client secret is invalid.');
            $values['clientSecret'] = trim($clientSecret);
        } elseif ($current['clientSecret'] === '') {
            throw new InvalidArgumentException('Enter the Google OAuth client secret once. It is stored server-side and never sent back to the browser.');
        }
        self::update('youtube', $values);
    }

    public static function setYoutubeOAuthState(string $state, int $userId): void
    {
        self::update('youtube', ['oauthState' => $state, 'oauthStateAt' => time(), 'oauthStateUser' => $userId]);
    }

    public static function consumeYoutubeOAuthState(string $state): bool
    {
        $all = self::all();
        $youtube = is_array($all['youtube'] ?? null) ? $all['youtube'] : [];
        $expected = (string) ($youtube['oauthState'] ?? '');
        $age = time() - (int) ($youtube['oauthStateAt'] ?? 0);
        if ($expected === '' || $age < 0 || $age > 600 || !hash_equals($expected, $state)) return false;
        unset($youtube['oauthState'], $youtube['oauthStateAt'], $youtube['oauthStateUser']);
        $all['youtube'] = $youtube;
        self::saveAll($all);
        return true;
    }

    public static function saveYoutubeTokens(array $tokens, string $channelId, string $channelTitle): void
    {
        $values = [
            'accessToken' => (string) ($tokens['access_token'] ?? ''),
            'expiresAt' => time() + max(0, (int) ($tokens['expires_in'] ?? 0)),
            'channelId' => $channelId,
            'channelTitle' => $channelTitle,
        ];
        if (!empty($tokens['refresh_token'])) $values['refreshToken'] = (string) $tokens['refresh_token'];
        self::update('youtube', $values);
    }

    public static function disconnectYoutube(): void
    {
        self::update('youtube', ['accessToken' => '', 'refreshToken' => '', 'expiresAt' => 0, 'channelId' => '', 'channelTitle' => '', 'oauthState' => '', 'oauthStateAt' => 0, 'oauthStateUser' => 0]);
    }
}
