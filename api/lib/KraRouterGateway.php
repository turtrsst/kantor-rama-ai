<?php
declare(strict_types=1);

require_once __DIR__ . '/../ProviderConfig.php';

final class KraRouterGateway
{
    public static function health(string $providerName = ''): array
    {
        $config = ProviderConfig::load();
        $name = $providerName !== '' ? $providerName : (string) ($config['defaultProvider'] ?? '');
        $provider = $config['providers'][$name] ?? null;
        if (!is_array($provider)) {
            return ['provider' => $name, 'online' => false, 'error' => 'Provider not configured.'];
        }
        if ($name === 'simulator') {
            return ['provider' => $name, 'online' => true, 'mode' => 'offline-simulator'];
        }

        $url = (string) ($provider['healthUrl'] ?: rtrim($provider['baseUrl'], '/') . '/models');
        $result = self::request($url, $provider, false);
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
        if ($name === 'simulator') {
            return ['provider' => $name, 'models' => [['id' => $provider['model'], 'owned_by' => 'kra']], 'online' => true];
        }

        $url = (string) ($provider['modelsUrl'] ?: rtrim($provider['baseUrl'], '/') . '/models');
        $result = self::request($url, $provider, false);
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

        $endpoint = rtrim((string) $provider['baseUrl'], '/') . '/chat/completions';
        $body = [
            'model' => trim((string) ($request['model'] ?? '')) !== ''
                ? (string) $request['model']
                : (string) $provider['model'],
            'messages' => $request['messages'] ?? [['role' => 'user', 'content' => (string) ($request['prompt'] ?? '')]],
            'max_tokens' => (int) ($request['maxTokens'] ?? 1000),
            'stream' => false,
        ];
        $result = self::request($endpoint, $provider, true, $body);
        if (!$result['ok']) throw new RuntimeException($result['error']);
        return [
            'provider' => $name,
            'model' => $body['model'],
            'content' => (string) ($result['json']['choices'][0]['message']['content'] ?? ''),
        ];
    }

    public static function completeWithFallback(array $request): array
    {
        $config = ProviderConfig::load();
        $primary = (string) ($request['provider'] ?? $config['defaultProvider'] ?? '');
        $attempts = [];
        $visited = [];
        $current = $primary;
        $fallbackUsed = false;

        $allowSimulator = (bool) ($request['allowSimulator'] ?? true);
        for ($hop = 0; $hop < 4; $hop++) {
            if ($current === '' || isset($visited[$current])) {
                break;
            }
            if (!$allowSimulator && $current === 'simulator') {
                $attempts[] = ['simulator', 'disabled for live chat'];
                break;
            }
            $visited[$current] = true;
            try {
                $retry = $request;
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

    private static function request(string $url, array $provider, bool $post, array $body = []): array
    {
        $headers = ['Content-Type: application/json'];
        $env = (string) ($provider['apiKeyEnv'] ?? '');
        $key = (string) ($provider['apiKey'] ?? '') !== '' ? (string) $provider['apiKey'] : ($env === '' ? '' : (string) getenv($env));

        $headerStr = "Content-Type: application/json\r\n";
        if ($key !== '') {
            $headerStr .= "Authorization: Bearer " . trim($key) . "\r\n";
        }

        $options = [
            'http' => [
                'method' => $post ? 'POST' : 'GET',
                'header' => $headerStr,
                'content' => $post ? json_encode($body, JSON_UNESCAPED_SLASHES) : '',
                'timeout' => 90,
                'ignore_errors' => true,
            ],
        ];
        $context = stream_context_create($options);
        $raw = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)) {
            $status = (int) $match[1];
        }
        $json = json_decode((string) $raw, true);
        return [
            'ok' => $raw !== false && $status >= 200 && $status < 300 && is_array($json),
            'status' => $status,
            'json' => is_array($json) ? $json : [],
            'error' => $raw === false ? 'Router request failed or timed out.' : ($status >= 300 ? 'Router returned HTTP ' . $status : ''),
        ];
    }
}
