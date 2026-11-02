<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

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

    private static function currentWorkspaceId(): string
    {
        return KraTenantContext::hasWorkspace() ? KraTenantContext::workspaceId() : '';
    }

    private static function envApplies(): bool
    {
        // Environment credentials describe one installation owner. They may be
        // reused by that owner's local workspaces, but never leak to another
        // tenant in hosted mode.
        return self::currentWorkspaceId() === '' || KraTenantContext::canUseLegacyIntegrations() || !KraTenantContext::isHosted();
    }

    private static function canReferenceProviderEnv(): bool
    {
        // A workspace admin must never be able to name an arbitrary server
        // environment variable (for example the DB password) and have KRA
        // send its value to a provider URL. Env references are reserved for
        // the installation owner/platform admin and the legacy workspace;
        // ordinary BYOK workspaces paste their own key into private storage.
        return self::currentWorkspaceId() === ''
            || KraTenantContext::canUseLegacyIntegrations()
            || KraTenantContext::isPlatformAdmin(KraTenantContext::user());
    }

    private static function sectionFrom(array $all, string $section, ?string $workspaceId = null): array
    {
        $workspaceId = $workspaceId ?? self::currentWorkspaceId();
        if ($workspaceId !== '') {
            $saved = $all['workspaces'][$workspaceId][$section] ?? null;
            if (is_array($saved)) return $saved;
            $isLegacyWorkspace = (string) ($all['legacyWorkspaceId'] ?? '') === $workspaceId
                || ($workspaceId === self::currentWorkspaceId() && KraTenantContext::canUseLegacyIntegrations());
            return $isLegacyWorkspace && is_array($all[$section] ?? null) ? $all[$section] : [];
        }
        return is_array($all[$section] ?? null) ? $all[$section] : [];
    }

    private static function update(string $section, array $values, ?string $workspaceId = null): void
    {
        $all = self::all();
        $workspaceId = $workspaceId ?? self::currentWorkspaceId();
        if ($workspaceId !== '') {
            if (!is_array($all['workspaces'] ?? null)) $all['workspaces'] = [];
            if (!is_array($all['workspaces'][$workspaceId] ?? null)) $all['workspaces'][$workspaceId] = [];
            $existing = self::sectionFrom($all, $section, $workspaceId);
            $all['workspaces'][$workspaceId][$section] = array_merge($existing, $values);
        } else {
            $all[$section] = array_merge(is_array($all[$section] ?? null) ? $all[$section] : [], $values);
        }
        self::saveAll($all);
    }

    private static function updateGlobal(string $section, array $values): void
    {
        $all = self::all();
        $all[$section] = array_merge(is_array($all[$section] ?? null) ? $all[$section] : [], $values);
        self::saveAll($all);
    }

    public static function migrateLegacyToWorkspace(string $workspaceId): void
    {
        $workspaceId = trim($workspaceId);
        if ($workspaceId === '') return;
        $all = self::all();
        $changed = false;
        if (($all['legacyWorkspaceId'] ?? '') !== $workspaceId) {
            $all['legacyWorkspaceId'] = $workspaceId;
            $changed = true;
        }
        if (!is_array($all['workspaces'] ?? null)) $all['workspaces'] = [];
        if (!is_array($all['workspaces'][$workspaceId] ?? null)) $all['workspaces'][$workspaceId] = [];
        foreach (['n100n', 'githubChanger', 'youtube', 'telegram', 'providers', 'license'] as $section) {
            if (!isset($all['workspaces'][$workspaceId][$section]) && is_array($all[$section] ?? null)) {
                $all['workspaces'][$workspaceId][$section] = $all[$section];
                $changed = true;
            }
        }
        if ($changed) self::saveAll($all);
    }

    public static function legacyWorkspaceId(): string
    {
        try { return trim((string) (self::all()['legacyWorkspaceId'] ?? '')); } catch (Throwable) { return ''; }
    }

    public static function installationId(): string
    {
        $all = self::all();
        $id = trim((string) ($all['installation']['id'] ?? ''));
        if ($id === '') {
            $id = 'kra_' . bin2hex(random_bytes(12));
            self::updateGlobal('installation', ['id' => $id, 'createdAt' => gmdate(DATE_ATOM)]);
        }
        return $id;
    }

    public static function licenseToken(): string
    {
        $saved = self::sectionFrom(self::all(), 'license');
        return trim((string) ($saved['token'] ?? ''));
    }

    public static function globalLicenseToken(): string
    {
        $all = self::all();
        return trim((string) ($all['license']['token'] ?? ''));
    }

    public static function saveLicenseToken(string $token): void
    {
        self::update('license', ['token' => trim($token), 'savedAt' => gmdate(DATE_ATOM)]);
    }

    /** Server-only BYOK provider overlay for the active workspace. */
    public static function providerSettings(): array
    {
        $saved = self::sectionFrom(self::all(), 'providers');
        $providers = is_array($saved['providers'] ?? null) ? $saved['providers'] : [];
        $clean = [];
        foreach ($providers as $name => $provider) {
            if (!is_array($provider)) continue;
            $name = strtolower(trim((string) $name));
            if (!preg_match('/^[a-z][a-z0-9_-]{0,40}$/', $name)) continue;
            $clean[$name] = [
                'baseUrl' => (string) ($provider['baseUrl'] ?? ''),
                'model' => (string) ($provider['model'] ?? ''),
                'apiKey' => (string) ($provider['apiKey'] ?? ''),
                'apiKeyEnv' => self::canReferenceProviderEnv() ? (string) ($provider['apiKeyEnv'] ?? '') : '',
                'healthUrl' => (string) ($provider['healthUrl'] ?? ''),
                'modelsUrl' => (string) ($provider['modelsUrl'] ?? ''),
                'fallbackProvider' => (string) ($provider['fallbackProvider'] ?? ''),
            ];
        }
        return [
            'defaultProvider' => strtolower(trim((string) ($saved['defaultProvider'] ?? ''))),
            'providers' => $clean,
        ];
    }

    private static function assertProviderUrlAllowed(string $url, string $label): void
    {
        $parts = parse_url($url);
        if (strlen($url) > 2048 || !is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException($label . ' provider tidak valid.');
        }
        if (!KraTenantContext::isHosted() || self::canReferenceProviderEnv()) return;

        // Hosted tenants may call public HTTPS model APIs with their own key.
        // Loopback/LAN endpoints belong to the server operator, so allowing a
        // tenant to aim KRA at them would become an SSRF primitive.
        if (strtolower((string) $parts['scheme']) !== 'https') {
            throw new InvalidArgumentException($label . ' provider pada mode hosted wajib HTTPS publik. Endpoint lokal hanya dapat diatur admin platform.');
        }
        $host = strtolower(trim((string) $parts['host'], "[] \t\n\r\0\x0B"));
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            throw new InvalidArgumentException($label . ' provider tidak boleh menunjuk host lokal/internal pada mode hosted.');
        }
        $isPublicIp = static function (string $ip): bool {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                $n = ip2long($ip);
                if ($n === false) return false;
                $ranges = [
                    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
                    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
                    ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
                ];
                foreach ($ranges as [$base, $bits]) {
                    $mask = $bits === 0 ? 0 : (-1 << (32 - $bits));
                    if (($n & $mask) === ((ip2long($base) ?: 0) & $mask)) return false;
                }
                return true;
            }
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
                $packed = inet_pton(AF_INET6, $ip);
                if ($packed === false) return false;
                $first = ord($packed[0]);
                $second = ord($packed[1]);
                if ($ip === '::1' || $ip === '::') return false;
                if (($first & 0xfe) === 0xfc) return false; // unique-local fc00::/7
                if ($first === 0xfe && ($second & 0xc0) === 0x80) return false; // link-local fe80::/10
                if ($first === 0xff) return false; // multicast
                return true;
            }
            return false;
        };
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!$isPublicIp($host)) throw new InvalidArgumentException($label . ' provider tidak boleh menunjuk IP privat/internal pada mode hosted.');
            return;
        }
        $ips = gethostbynamel($host) ?: [];
        if ($ips === [] || in_array(false, array_map($isPublicIp, $ips), true)) {
            throw new InvalidArgumentException($label . ' provider harus resolve ke alamat publik pada mode hosted.');
        }
    }

    public static function saveProviderSettings(array $input): array
    {
        $current = self::providerSettings();
        $providersInput = is_array($input['providers'] ?? null) ? $input['providers'] : [];
        if (count($providersInput) > 20) throw new InvalidArgumentException('Maksimum 20 provider per workspace.');
        $providers = $current['providers'];
        foreach ($providersInput as $rawName => $provider) {
            if (!is_array($provider)) continue;
            $name = strtolower(trim((string) $rawName));
            if (!preg_match('/^[a-z][a-z0-9_-]{0,40}$/', $name)) throw new InvalidArgumentException('Nama provider tidak valid: ' . $rawName);
            $existing = is_array($providers[$name] ?? null) ? $providers[$name] : [];
            $baseUrl = trim((string) ($provider['baseUrl'] ?? $existing['baseUrl'] ?? ''));
            if ($baseUrl !== '' && $baseUrl !== 'local') self::assertProviderUrlAllowed($baseUrl, 'Base URL provider ' . $name);
            $model = trim((string) ($provider['model'] ?? $existing['model'] ?? ''));
            if (strlen($model) > 200 || preg_match('/[\r\n]/', $model)) throw new InvalidArgumentException('Nama model provider tidak valid.');
            $apiKey = (string) ($existing['apiKey'] ?? '');
            if (!empty($provider['clearApiKey']) || !empty($provider['clear_api_key'])) $apiKey = '';
            elseif (array_key_exists('apiKey', $provider) && trim((string) $provider['apiKey']) !== '') {
                if (strlen((string) $provider['apiKey']) > 4096 || preg_match('/[\r\n]/', (string) $provider['apiKey'])) throw new InvalidArgumentException('API key provider tidak valid.');
                $apiKey = trim((string) $provider['apiKey']);
            }
            $apiKeyEnv = trim((string) ($provider['apiKeyEnv'] ?? $existing['apiKeyEnv'] ?? ''));
            if ($apiKeyEnv !== '' && !preg_match('/^[A-Z_][A-Z0-9_]*$/', $apiKeyEnv)) throw new InvalidArgumentException('Nama environment variable API key tidak valid.');
            if ($apiKeyEnv !== '' && !self::canReferenceProviderEnv()) {
                throw new InvalidArgumentException('Referensi environment variable hanya untuk admin platform/instalasi lokal tepercaya. Tempel API key BYOK workspace secara langsung; key tidak akan ditampilkan kembali.');
            }
            $fallback = strtolower(trim((string) ($provider['fallbackProvider'] ?? $existing['fallbackProvider'] ?? '')));
            if ($fallback !== '' && !preg_match('/^[a-z][a-z0-9_-]{0,40}$/', $fallback)) throw new InvalidArgumentException('Fallback provider tidak valid.');
            $providers[$name] = [
                'baseUrl' => $baseUrl,
                'model' => $model,
                'apiKey' => $apiKey,
                'apiKeyEnv' => $apiKeyEnv,
                'healthUrl' => trim((string) ($provider['healthUrl'] ?? $existing['healthUrl'] ?? '')),
                'modelsUrl' => trim((string) ($provider['modelsUrl'] ?? $existing['modelsUrl'] ?? '')),
                'fallbackProvider' => $fallback,
            ];
            foreach (['healthUrl', 'modelsUrl'] as $urlKey) {
                $candidate = (string) $providers[$name][$urlKey];
                if (strlen($candidate) > 2048 || preg_match('/[\r\n]/', $candidate)) {
                    throw new InvalidArgumentException('URL provider tidak valid.');
                }
                if ($candidate !== '') self::assertProviderUrlAllowed($candidate, 'URL provider');
            }
        }
        $default = strtolower(trim((string) ($input['defaultProvider'] ?? $current['defaultProvider'] ?? '')));
        if ($default !== '' && !preg_match('/^[a-z][a-z0-9_-]{0,40}$/', $default)) throw new InvalidArgumentException('Default provider tidak valid.');
        self::update('providers', ['defaultProvider' => $default, 'providers' => $providers, 'updatedAt' => gmdate(DATE_ATOM)]);
        return self::providerSettings();
    }

    public static function n100n(): array
    {
        $saved = self::sectionFrom(self::all(), 'n100n');
        $envUrl = self::envApplies() ? trim((string) (getenv('KRA_N100N_BASE_URL') ?: getenv('KRA_N100N_URL') ?: '')) : '';
        $envKey = self::envApplies() ? trim((string) (getenv('KRA_N100N_API_KEY') ?: getenv('KRA_N100N_TOKEN') ?: '')) : '';
        $url = trim((string) ($envUrl !== '' ? $envUrl : ($saved['baseUrl'] ?? 'http://127.0.0.1:5679')));
        $key = trim((string) ($envKey !== '' ? $envKey : ($saved['apiKey'] ?? '')));
        return ['baseUrl' => rtrim($url, '/'), 'apiKey' => $key, 'workspaceId' => self::currentWorkspaceId()];
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

    // --- GitHub Changer (dashboard Git/GitHub lokal) -----------------------
    // Kontrak yang sama dengan N100N: URL + kunci service disimpan privat di
    // server, environment menang, dan URL publik yang disanitasi saja yang
    // boleh dikirim ke browser.

    public static function githubChanger(): array
    {
        $saved = self::sectionFrom(self::all(), 'githubChanger');
        $envUrl = self::envApplies() ? trim((string) (getenv('KRA_GITHUB_CHANGER_URL') ?: getenv('KRA_GITHUB_CHANGER_BASE_URL') ?: '')) : '';
        $envKey = self::envApplies() ? trim((string) (getenv('KRA_GITHUB_CHANGER_API_KEY') ?: '')) : '';
        $url = trim((string) ($envUrl !== '' ? $envUrl : ($saved['baseUrl'] ?? 'http://127.0.0.1:4173')));
        $key = trim((string) ($envKey !== '' ? $envKey : ($saved['apiKey'] ?? '')));
        return ['baseUrl' => rtrim($url, '/'), 'apiKey' => $key, 'workspaceId' => self::currentWorkspaceId()];
    }

    /** URL aman untuk shortcut browser: tanpa userinfo, query, atau fragment. */
    public static function publicGitHubChangerBaseUrl(): string
    {
        $url = self::githubChanger()['baseUrl'];
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) return '';
        $safe = strtolower((string) $parts['scheme']) . '://' . (string) $parts['host'];
        if (isset($parts['port'])) $safe .= ':' . (int) $parts['port'];
        $safe .= (string) ($parts['path'] ?? '');
        return rtrim($safe, '/');
    }

    public static function saveGitHubChanger(string $url, ?string $key, bool $clearKey = false): void
    {
        $url = trim($url);
        $parts = parse_url($url);
        if ($url === '' || strlen($url) > 2048 || !is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])) {
            throw new InvalidArgumentException('Enter a valid GitHub Changer service URL using http:// or https://, without embedded credentials, query parameters, or fragments.');
        }
        $values = ['baseUrl' => rtrim($url, '/')];
        if ($clearKey) $values['apiKey'] = '';
        elseif ($key !== null && trim($key) !== '') {
            if (strlen($key) > 2048 || preg_match('/[\r\n]/', $key)) throw new InvalidArgumentException('The GitHub Changer service key is invalid.');
            $values['apiKey'] = trim($key);
        }
        self::update('githubChanger', $values);
    }

    /** Secret verifikasi notifikasi github-changer -> KRA (hanya environment). */
    public static function githubChangerEventSecret(): string
    {
        return trim((string) (getenv('KRA_GITHUB_CHANGER_EVENT_SECRET') ?: ''));
    }

    /** Event terakhir disimpan global (callback webhook tidak punya workspace). */
    public static function githubChangerEvent(): array
    {
        $all = self::all();
        $event = $all['githubChanger']['lastEvent'] ?? null;
        return is_array($event) ? $event : [];
    }

    public static function saveGitHubChangerEvent(array $event): void
    {
        $text = static function ($value, int $max): string {
            return substr(trim((string) (is_scalar($value) ? $value : '')), 0, $max);
        };
        $repos = [];
        foreach ((array) ($event['repos'] ?? []) as $repo) {
            if (!is_array($repo)) continue;
            $repos[] = [
                'name' => $text($repo['name'] ?? '', 120),
                'result' => $text($repo['result'] ?? '', 40),
                'reason' => $text($repo['reason'] ?? '', 200),
            ];
            if (count($repos) >= 20) break;
        }
        self::updateGlobal('githubChanger', [
            'lastEvent' => [
                'at' => $text($event['at'] ?? gmdate(DATE_ATOM), 40),
                'trigger' => $text($event['trigger'] ?? '', 40),
                'action' => $text($event['action'] ?? '', 20),
                'ok' => (int) ($event['ok'] ?? 0),
                'failed' => (int) ($event['failed'] ?? 0),
                'skipped' => (int) ($event['skipped'] ?? 0),
                'error' => $text($event['error'] ?? '', 300),
                'reason' => $text($event['reason'] ?? '', 300),
                'repos' => $repos,
                'receivedAt' => gmdate(DATE_ATOM),
            ],
        ]);
    }

    public static function youtube(): array
    {
        $saved = self::sectionFrom(self::all(), 'youtube');
        $allowEnv = self::envApplies();
        return [
            'clientId' => trim((string) (($allowEnv ? getenv('KRA_YOUTUBE_CLIENT_ID') : '') ?: ($saved['clientId'] ?? ''))),
            'clientSecret' => trim((string) (($allowEnv ? getenv('KRA_YOUTUBE_CLIENT_SECRET') : '') ?: ($saved['clientSecret'] ?? ''))),
            'redirectUri' => trim((string) (($allowEnv ? getenv('KRA_YOUTUBE_REDIRECT_URI') : '') ?: ($saved['redirectUri'] ?? ''))),
            'accessToken' => (string) ($saved['accessToken'] ?? ''),
            'refreshToken' => (string) ($saved['refreshToken'] ?? ''),
            'expiresAt' => (int) ($saved['expiresAt'] ?? 0),
            'grantedScopes' => (string) ($saved['grantedScopes'] ?? ''),
            'channelId' => (string) ($saved['channelId'] ?? ''),
            'channelTitle' => (string) ($saved['channelTitle'] ?? ''),
            'workspaceId' => self::currentWorkspaceId(),
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

    public static function setYoutubeOAuthState(string $state, int|string $userId, string $client = 'web', ?string $workspaceId = null): void
    {
        $all = self::all();
        if (!is_array($all['youtubeOauthStates'] ?? null)) $all['youtubeOauthStates'] = [];
        $now = time();
        foreach ($all['youtubeOauthStates'] as $hash => $meta) {
            if (!is_array($meta) || $now - (int) ($meta['at'] ?? 0) > 900) unset($all['youtubeOauthStates'][$hash]);
        }
        $all['youtubeOauthStates'][hash('sha256', $state)] = [
            'userId' => (string) $userId,
            'workspaceId' => $workspaceId ?? self::currentWorkspaceId(),
            'client' => $client === 'desktop' ? 'desktop' : 'web',
            'at' => $now,
        ];
        self::saveAll($all);
    }

    public static function consumeYoutubeOAuthState(string $state): bool
    {
        return self::consumeYoutubeOAuthStateMeta($state) !== null;
    }

    /** Validates and clears the pending OAuth state, returning its metadata once. */
    public static function consumeYoutubeOAuthStateMeta(string $state): ?array
    {
        $all = self::all();
        $hash = hash('sha256', $state);
        $meta = $all['youtubeOauthStates'][$hash] ?? null;
        if (is_array($meta)) {
            $age = time() - (int) ($meta['at'] ?? 0);
            unset($all['youtubeOauthStates'][$hash]);
            self::saveAll($all);
            if ($age < 0 || $age > 600) return null;
            return [
                'userId' => (string) ($meta['userId'] ?? ''),
                'workspaceId' => (string) ($meta['workspaceId'] ?? ''),
                'client' => (($meta['client'] ?? 'web') === 'desktop') ? 'desktop' : 'web',
            ];
        }

        // Backward compatibility for states issued by the pre-workspace build.
        $candidates = [['workspaceId' => '', 'section' => (array) ($all['youtube'] ?? [])]];
        foreach ((array) ($all['workspaces'] ?? []) as $workspaceId => $workspaceData) {
            if (is_array($workspaceData['youtube'] ?? null)) $candidates[] = ['workspaceId' => (string) $workspaceId, 'section' => $workspaceData['youtube']];
        }
        foreach ($candidates as $candidate) {
            $youtube = $candidate['section'];
            $expected = (string) ($youtube['oauthState'] ?? '');
            if ($expected === '' || !hash_equals($expected, $state)) continue;
            $age = time() - (int) ($youtube['oauthStateAt'] ?? 0);
            unset($youtube['oauthState'], $youtube['oauthStateAt'], $youtube['oauthStateUser'], $youtube['oauthStateClient']);
            if ($candidate['workspaceId'] === '') $all['youtube'] = $youtube;
            else $all['workspaces'][$candidate['workspaceId']]['youtube'] = $youtube;
            self::saveAll($all);
            if ($age < 0 || $age > 600) return null;
            return [
                'userId' => (string) ($candidate['section']['oauthStateUser'] ?? ''),
                'workspaceId' => (string) $candidate['workspaceId'],
                'client' => (($candidate['section']['oauthStateClient'] ?? 'web') === 'desktop') ? 'desktop' : 'web',
            ];
        }
        return null;
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
        if (!empty($tokens['scope'])) $values['grantedScopes'] = (string) $tokens['scope'];
        self::update('youtube', $values);
    }

    public static function disconnectYoutube(): void
    {
        self::update('youtube', ['accessToken' => '', 'refreshToken' => '', 'expiresAt' => 0, 'grantedScopes' => '', 'channelId' => '', 'channelTitle' => '', 'oauthState' => '', 'oauthStateAt' => 0, 'oauthStateUser' => 0, 'oauthStateClient' => 'web']);
    }

    // --- Telegram bot (monitoring) -------------------------------------
    // The bot token is a full-control credential for the bot: it is stored
    // like the YouTube secret (server-only, never returned by read APIs).

    public static function telegram(): array
    {
        return self::telegramForWorkspace(self::currentWorkspaceId());
    }

    public static function telegramForWorkspace(string $workspaceId): array
    {
        $all = self::all();
        $saved = self::sectionFrom($all, 'telegram', $workspaceId);
        $allowEnv = $workspaceId === ''
            || ($workspaceId === self::currentWorkspaceId() && self::envApplies())
            || ($all['legacyWorkspaceId'] ?? '') === $workspaceId;
        return [
            'botToken' => trim((string) (($allowEnv ? getenv('KRA_TELEGRAM_BOT_TOKEN') : '') ?: ($saved['botToken'] ?? ''))),
            'chatId' => trim((string) (($allowEnv ? getenv('KRA_TELEGRAM_CHAT_ID') : '') ?: ($saved['chatId'] ?? ''))),
            'chatTitle' => (string) ($saved['chatTitle'] ?? ''),
            'webhookSecret' => (string) ($saved['webhookSecret'] ?? ''),
            'webhookUrl' => (string) ($saved['webhookUrl'] ?? ''),
            'workspaceId' => $workspaceId,
        ];
    }

    /** Locate the workspace that owns a webhook secret (global legacy or a workspace bot). */
    public static function findTelegramWorkspaceBySecret(?string $secret): ?array
    {
        if ($secret === null || $secret === '') return null;
        $all = self::all();
        $global = (string) ($all['telegram']['webhookSecret'] ?? '');
        if ($global !== '' && hash_equals($global, $secret)) {
            return ['workspaceId' => (string) ($all['legacyWorkspaceId'] ?? ''), 'legacy' => true];
        }
        foreach ((array) ($all['workspaces'] ?? []) as $workspaceId => $data) {
            $candidate = (string) ($data['telegram']['webhookSecret'] ?? '');
            if ($candidate !== '' && hash_equals($candidate, $secret)) {
                return ['workspaceId' => (string) $workspaceId, 'legacy' => false];
            }
        }
        return null;
    }

    public static function saveTelegramToken(?string $botToken, bool $clearToken = false): void
    {
        if ($clearToken) {
            self::update('telegram', ['botToken' => '', 'webhookSecret' => '', 'webhookUrl' => '']);
            return;
        }
        if ($botToken === null || trim($botToken) === '') return; // blank keeps the saved token
        $botToken = trim($botToken);
        // BotFather format: "<bot-id>:<35-ish url-safe chars>".
        if (strlen($botToken) > 256 || !preg_match('/^\d{5,16}:[A-Za-z0-9_-]{20,}$/', $botToken)) {
            throw new InvalidArgumentException('Format bot token Telegram tidak dikenal. Salin persis token dari @BotFather (contoh: 123456789:AA...).');
        }
        $values = ['botToken' => $botToken];
        $current = self::telegram();
        if ($current['webhookSecret'] === '' || $current['botToken'] !== $botToken) {
            // A new token gets a fresh webhook secret; re-register the webhook after saving.
            $values['webhookSecret'] = bin2hex(random_bytes(24));
            $values['webhookUrl'] = '';
        }
        self::update('telegram', $values);
    }

    public static function saveTelegramWebhookUrl(string $url): void
    {
        self::update('telegram', ['webhookUrl' => $url]);
    }

    /** Persists a freshly registered webhook secret (rotation on re-register). */
    public static function saveTelegramWebhookSecret(string $secret): void
    {
        self::update('telegram', ['webhookSecret' => $secret]);
    }

    /** Starts pairing: the owner sends "/start <code>" to the bot within 10 minutes. */
    public static function startTelegramPairing(): string
    {
        $code = strtoupper(bin2hex(random_bytes(3))); // 6 hex chars, easy to type
        self::update('telegram', ['pairingCode' => $code, 'pairingExpiresAt' => time() + 600]);
        return $code;
    }

    public static function consumeTelegramPairing(string $code, string $chatId, string $chatTitle): bool
    {
        $all = self::all();
        $workspaceId = self::currentWorkspaceId();
        $telegram = self::sectionFrom($all, 'telegram', $workspaceId);
        $expected = strtoupper(trim((string) ($telegram['pairingCode'] ?? '')));
        $expires = (int) ($telegram['pairingExpiresAt'] ?? 0);
        if ($expected === '' || $expires < time() || !hash_equals($expected, strtoupper(trim($code)))) return false;
        $telegram['chatId'] = $chatId;
        $telegram['chatTitle'] = $chatTitle;
        unset($telegram['pairingCode'], $telegram['pairingExpiresAt']);
        if ($workspaceId !== '') {
            if (!is_array($all['workspaces'] ?? null)) $all['workspaces'] = [];
            if (!is_array($all['workspaces'][$workspaceId] ?? null)) $all['workspaces'][$workspaceId] = [];
            $all['workspaces'][$workspaceId]['telegram'] = $telegram;
        } else {
            $all['telegram'] = $telegram;
        }
        self::saveAll($all);
        return true;
    }

    public static function clearTelegramPairing(): void
    {
        self::update('telegram', ['chatId' => '', 'chatTitle' => '', 'pairingCode' => '', 'pairingExpiresAt' => 0]);
    }
}
