<?php
declare(strict_types=1);

require_once __DIR__ . '/../ProviderConfig.php';
require_once __DIR__ . '/KraModelDispatcher.php';

final class KraRouterGateway
{
    private const REQUEST_TIMEOUT_SECONDS = 30;
    private const CONNECT_TIMEOUT_SECONDS = 6;
    private const HEALTH_TIMEOUT_SECONDS = 5;
    private const FALLBACK_BUDGET_SECONDS = 55;

    public static function health(string $providerName = ''): array
    {
        $config = ProviderConfig::load();
        $name = $providerName !== '' ? $providerName : (string) ($config['defaultProvider'] ?? '');
        $provider = $config['providers'][$name] ?? null;
        if (!is_array($provider)) {
            return ['provider' => $name, 'online' => false, 'error' => 'Provider not configured.'];
        }
        if (in_array($name, ['anthropic', 'gemini'], true)) return KraModelDispatcher::nativeHealth($name);
        if ($name === 'simulator') {
            return ['provider' => $name, 'online' => true, 'mode' => 'offline-simulator'];
        }

        $url = (string) ($provider['healthUrl'] ?: rtrim($provider['baseUrl'], '/') . '/models');
        $result = self::request($url, $provider, false, [], self::HEALTH_TIMEOUT_SECONDS);
        return [
            'provider' => $name,
            'online' => $result['ok'],
            'status' => $result['status'],
            'error' => $result['error'],
        ];
    }

    public static function models(string $providerName = ''): array
    {
        $config = ProviderConfig::load();
        $name = $providerName !== '' ? $providerName : (string) ($config['defaultProvider'] ?? '');
        $provider = $config['providers'][$name] ?? null;
        if (!is_array($provider)) {
            return ['provider' => $name, 'models' => [], 'online' => false, 'error' => 'Provider not configured.'];
        }
        if (in_array($name, ['anthropic', 'gemini'], true)) return KraModelDispatcher::listNativeModels($name);
        if ($name === 'simulator') {
            return ['provider' => $name, 'models' => [['id' => $provider['model'], 'owned_by' => 'kra']], 'online' => true];
        }

        $url = (string) ($provider['modelsUrl'] ?: rtrim($provider['baseUrl'], '/') . '/models');
        $result = self::request($url, $provider, false, [], self::HEALTH_TIMEOUT_SECONDS);
        $decoded = $result['json'];
        return [
            'provider' => $name,
            'models' => is_array($decoded['data'] ?? null) ? $decoded['data'] : [],
            'online' => $result['ok'],
            'status' => $result['status'],
            'error' => $result['error'],
        ];
    }

    public static function complete(array $request): array
    {
        $config = ProviderConfig::load();
        $name = (string) ($request['provider'] ?? $config['defaultProvider'] ?? '');
        $provider = $config['providers'][$name] ?? null;
        if (!is_array($provider)) {
            throw new InvalidArgumentException('Unknown provider: ' . $name);
        }
        if ($name === 'simulator') {
            return ['provider' => $name, 'model' => $provider['model'], 'content' => 'SIMULATOR_OK'];
        }
        if (in_array($name, ['anthropic', 'gemini'], true)) {
            return KraModelDispatcher::completeChat(array_replace($request, [
                'provider' => $name,
                'timeoutSeconds' => self::boundedTimeout($request['timeoutSeconds'] ?? self::REQUEST_TIMEOUT_SECONDS),
            ]));
        }

        $endpoint = rtrim((string) $provider['baseUrl'], '/') . '/chat/completions';
        $body = [
            'model' => trim((string) ($request['model'] ?? '')) !== ''
                ? (string) $request['model']
                : (string) $provider['model'],
            'messages' => $request['messages'] ?? [['role' => 'user', 'content' => (string) ($request['prompt'] ?? '')]],
            'max_tokens' => (int) ($request['maxTokens'] ?? 1000),
            'stream' => false,
        ];
        $timeout = self::boundedTimeout($request['timeoutSeconds'] ?? self::REQUEST_TIMEOUT_SECONDS);
        $result = self::request($endpoint, $provider, true, $body, $timeout);
        if (!$result['ok']) throw new RuntimeException($result['error']);
        return [
            'provider' => $name,
            'model' => $body['model'],
            'content' => (string) ($result['json']['choices'][0]['message']['content'] ?? ''),
        ];
    }

    public static function completeWithFallback(array $request, ?callable $onProgress = null): array
    {
        $config = ProviderConfig::load();
        $primary = (string) ($request['provider'] ?? $config['defaultProvider'] ?? '');
        $attempts = [];
        $visited = [];
        $current = $primary;
        $fallbackUsed = false;

        $allowSimulator = (bool) ($request['allowSimulator'] ?? true);
        $configuredBudget = (int) (getenv('KRA_AI_FALLBACK_BUDGET_SECONDS') ?: self::FALLBACK_BUDGET_SECONDS);
        $fallbackBudget = max(8, min(180, (int) ($request['fallbackBudgetSeconds'] ?? $configuredBudget)));
        $deadline = microtime(true) + $fallbackBudget;
        $perRequestTimeout = self::boundedTimeout($request['timeoutSeconds'] ?? self::REQUEST_TIMEOUT_SECONDS);
        for ($hop = 0; $hop < 4; $hop++) {
            if ($current === '' || isset($visited[$current])) {
                break;
            }
            if (!$allowSimulator && $current === 'simulator') {
                $attempts[] = ['simulator', 'disabled for live chat'];
                break;
            }
            $remaining = (int) ceil($deadline - microtime(true));
            if ($remaining < 1) {
                $attempts[] = [$current, 'total provider fallback time budget exhausted'];
                break;
            }
            $visited[$current] = true;
            if ($onProgress !== null) {
                $onProgress([
                    'kind' => 'provider_attempt', 'provider' => $current, 'attempt' => $hop + 1,
                    'message' => 'Menghubungi provider ' . $current . ' (percobaan ' . ($hop + 1) . ').',
                ]);
            }
            try {
                $retry = $request;
                $retry['timeoutSeconds'] = min($perRequestTimeout, $remaining);
                $retry['provider'] = $current;
                if ($current !== $primary) {
                    unset($retry['model']); // Let each fallback use its own configured model.
                }
                $result = self::complete($retry);
                $result['fallbackUsed'] = $fallbackUsed;
                $result['fallbackProvider'] = $fallbackUsed ? $current : null;
                $result['attempts'] = array_merge($attempts, [[$current, 'online']]);
                return $result;
            } catch (Throwable $providerError) {
                $attempts[] = [$current, $providerError->getMessage()];
            }

            $next = (string) ($config['providers'][$current]['fallbackProvider'] ?? '');
            if ($next === '' || $next === $current) {
                break;
            }
            $fallbackUsed = true;
            $current = $next;
        }

        return [
            'provider' => $primary,
            'model' => '',
            'content' => '',
            'fallbackUsed' => false,
            'attempts' => $attempts,
            'error' => 'All providers unavailable.',
        ];
    }

    private static function request(string $url, array $provider, bool $post, array $body = [], int $timeoutSeconds = self::REQUEST_TIMEOUT_SECONDS): array
    {
        $env = (string) ($provider['apiKeyEnv'] ?? '');
        $key = (string) ($provider['apiKey'] ?? '') !== '' ? (string) $provider['apiKey'] : ($env === '' ? '' : (string) getenv($env));
        $headers = ['Content-Type: application/json'];
        if ($key !== '') $headers[] = 'Authorization: Bearer ' . trim($key);
        $payload = $post ? json_encode($body, JSON_UNESCAPED_SLASHES) : '';
        $timeout = self::boundedTimeout($timeoutSeconds);

        if (function_exists('curl_init')) {
            $handle = curl_init($url);
            if ($handle !== false) {
                curl_setopt_array($handle, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CUSTOMREQUEST => $post ? 'POST' : 'GET',
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_POSTFIELDS => $post ? $payload : null,
                    CURLOPT_CONNECTTIMEOUT => min(self::CONNECT_TIMEOUT_SECONDS, $timeout),
                    CURLOPT_TIMEOUT => $timeout,
                    CURLOPT_FOLLOWLOCATION => false,
                    CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                ]);
                $raw = curl_exec($handle);
                $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
                $error = curl_error($handle);
                curl_close($handle);
                $decoded = is_string($raw) ? json_decode($raw, true) : null;
                return [
                    'ok' => is_array($decoded) && $status >= 200 && $status < 300,
                    'status' => $status,
                    'json' => is_array($decoded) ? $decoded : [],
                    'error' => $raw === false
                        ? ($error !== '' ? 'Router request failed: ' . $error : 'Router request failed or timed out.')
                        : ($status >= 300 ? 'Router returned HTTP ' . $status : 'Router returned an invalid response.'),
                ];
            }
        }

        $context = stream_context_create([
            'http' => [
                'method' => $post ? 'POST' : 'GET',
                'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $payload,
                'timeout' => $timeout,
                'ignore_errors' => true,
                'follow_location' => 0,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $raw = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)) {
            $status = (int) $match[1];
        }
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return [
            'ok' => is_array($decoded) && $status >= 200 && $status < 300,
            'status' => $status,
            'json' => is_array($decoded) ? $decoded : [],
            'error' => $raw === false ? 'Router request failed or timed out.' : ($status >= 300 ? 'Router returned HTTP ' . $status : 'Router returned an invalid response.'),
        ];
    }

    private static function boundedTimeout(mixed $requested): int
    {
        $configured = (int) (getenv('KRA_AI_REQUEST_TIMEOUT_SECONDS') ?: self::REQUEST_TIMEOUT_SECONDS);
        $timeout = (int) ($requested ?: $configured);
        return max(3, min(90, $timeout));
    }
}
