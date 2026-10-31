<?php
declare(strict_types=1);

final class KraModelDispatcher
{
    /** Chat completion bridge for native Anthropic/Gemini APIs (including image parts). */
    public static function completeChat(array $request): array
    {
        $config = ProviderConfig::load();
        $name = (string) ($request['provider'] ?? '');
        $provider = $config['providers'][$name] ?? null;
        if (!is_array($provider) || !in_array($name, ['anthropic', 'gemini'], true)) {
            throw new InvalidArgumentException('Unsupported native chat provider: ' . $name);
        }
        $envName = (string) ($provider['apiKeyEnv'] ?? '');
        $key = trim((string) ($provider['apiKey'] ?? ''));
        if ($key === '' && $envName !== '') $key = trim((string) getenv($envName));
        if ($envName !== '' && $key === '') throw new RuntimeException('Provider key is not configured: ' . $envName);

        $model = trim((string) ($request['model'] ?? '')) ?: (string) ($provider['model'] ?? '');
        $messages = is_array($request['messages'] ?? null) ? $request['messages'] : [];
        if ($model === '' || $messages === []) throw new InvalidArgumentException('A provider model and chat messages are required.');
        $systemParts = [];
        $providerMessages = [];
        foreach ($messages as $message) {
            if (!is_array($message)) continue;
            $role = (string) ($message['role'] ?? 'user');
            $content = $message['content'] ?? '';
            if ($role === 'system' || $role === 'developer') {
                $systemParts[] = self::plainText($content);
                continue;
            }
            $providerMessages[] = [
                'role' => $role === 'assistant' ? 'assistant' : 'user',
                'content' => $name === 'anthropic'
                    ? self::anthropicContent($content)
                    : self::geminiContent($content),
            ];
        }
        if ($providerMessages === []) throw new InvalidArgumentException('No user or assistant messages were provided.');
        $systemText = trim(implode("\n\n", array_filter($systemParts)));
        $maxTokens = max(64, min(8192, (int) ($request['maxTokens'] ?? 1000)));
        $baseUrl = rtrim((string) ($provider['baseUrl'] ?? ''), '/');

        if ($name === 'anthropic') {
            $headers = ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'];
            $body = ['model' => $model, 'max_tokens' => $maxTokens, 'messages' => $providerMessages];
            if ($systemText !== '') $body['system'] = $systemText;
            $endpoint = $baseUrl . '/messages';
        } else {
            $headers = ['Content-Type: application/json'];
            $geminiModel = preg_replace('#^models/#', '', $model) ?? $model;
            $endpoint = $baseUrl . '/models/' . rawurlencode($geminiModel) . ':generateContent?key=' . rawurlencode($key);
            $contents = array_map(static function (array $message): array {
                return ['role' => $message['role'] === 'assistant' ? 'model' : 'user', 'parts' => $message['content']];
            }, $providerMessages);
            $body = ['contents' => $contents, 'generationConfig' => ['maxOutputTokens' => $maxTokens]];
            if ($systemText !== '') $body['systemInstruction'] = ['parts' => [['text' => $systemText]]];
        }

        $requestedTimeout = $request['timeoutSeconds'] ?? null;
        if ($requestedTimeout === null) $requestedTimeout = (int) (getenv('KRA_AI_REQUEST_TIMEOUT_SECONDS') ?: 30);
        $timeout = max(3, min(90, (int) $requestedTimeout));
        $response = self::request($endpoint, $headers, $body, $timeout);
        $content = $name === 'anthropic'
            ? implode("\n", array_map(static fn(array $part): string => (string) ($part['text'] ?? ''), array_filter((array) ($response['content'] ?? []), 'is_array')))
            : implode("\n", array_map(static fn(array $part): string => (string) ($part['text'] ?? ''), array_filter((array) ($response['candidates'][0]['content']['parts'] ?? []), 'is_array')));
        if (trim($content) === '') throw new RuntimeException('Provider returned an empty chat response.');
        return ['provider' => $name, 'model' => $model, 'content' => $content];
    }

    public static function listNativeModels(string $providerName): array
    {
        $config = ProviderConfig::load();
        $provider = $config['providers'][$providerName] ?? null;
        if (!is_array($provider) || !in_array($providerName, ['anthropic', 'gemini'], true)) {
            return ['provider' => $providerName, 'models' => [], 'online' => false, 'error' => 'Provider not configured.'];
        }
        $envName = (string) ($provider['apiKeyEnv'] ?? '');
        $key = trim((string) ($provider['apiKey'] ?? ''));
        if ($key === '' && $envName !== '') $key = trim((string) getenv($envName));
        if ($key === '') return ['provider' => $providerName, 'models' => [], 'online' => false, 'error' => 'Provider key is not configured.'];
        $baseUrl = rtrim((string) ($provider['baseUrl'] ?? ''), '/');
        if ($providerName === 'anthropic') {
            $url = $baseUrl . '/models?limit=10';
            $headers = ['x-api-key: ' . $key, 'anthropic-version: 2023-06-01'];
        } else {
            $url = $baseUrl . '/models?key=' . rawurlencode($key);
            $headers = [];
        }
        try {
            $response = self::request($url, $headers, [], 5, false);
            $items = $providerName === 'gemini' ? ($response['models'] ?? []) : ($response['data'] ?? []);
            $models = [];
            foreach (is_array($items) ? $items : [] as $item) {
                if (!is_array($item)) continue;
                $id = (string) ($item['id'] ?? $item['name'] ?? '');
                if ($providerName === 'gemini') $id = preg_replace('#^models/#', '', $id) ?? $id;
                if ($id !== '') $models[] = ['id' => $id, 'owned_by' => $providerName];
            }
            return ['provider' => $providerName, 'models' => $models, 'online' => true];
        } catch (Throwable $error) {
            return ['provider' => $providerName, 'models' => [], 'online' => false, 'error' => $error->getMessage()];
        }
    }

    public static function nativeHealth(string $providerName): array
    {
        $models = self::listNativeModels($providerName);
        return ['provider' => $providerName, 'online' => (bool) ($models['online'] ?? false), 'error' => $models['error'] ?? null];
    }

    private static function plainText(mixed $content): string
    {
        if (is_string($content)) return $content;
        if (!is_array($content)) return '';
        $parts = [];
        foreach ($content as $part) if (is_array($part) && isset($part['text'])) $parts[] = (string) $part['text'];
        return implode("\n", $parts);
    }

    private static function anthropicContent(mixed $content): array|string
    {
        if (is_string($content)) return $content;
        if (!is_array($content)) return '';
        $parts = [];
        foreach ($content as $part) {
            if (!is_array($part)) continue;
            if (($part['type'] ?? '') === 'text') $parts[] = ['type' => 'text', 'text' => (string) ($part['text'] ?? '')];
            if (($part['type'] ?? '') === 'image_url') {
                $url = (string) ($part['image_url']['url'] ?? '');
                if (preg_match('#^data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$#', $url, $match)) {
                    $parts[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $match[1], 'data' => $match[2]]];
                }
            }
        }
        return $parts;
    }

    private static function geminiContent(mixed $content): array
    {
        if (is_string($content)) return [['text' => $content]];
        $parts = [];
        foreach (is_array($content) ? $content : [] as $part) {
            if (!is_array($part)) continue;
            if (($part['type'] ?? '') === 'text') $parts[] = ['text' => (string) ($part['text'] ?? '')];
            if (($part['type'] ?? '') === 'image_url') {
                $url = (string) ($part['image_url']['url'] ?? '');
                if (preg_match('#^data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$#', $url, $match)) {
                    $parts[] = ['inlineData' => ['mimeType' => $match[1], 'data' => $match[2]]];
                }
            }
        }
        return $parts !== [] ? $parts : [['text' => '']];
    }

    public static function propose(array $request): array
    {
        $config = ProviderConfig::load();
        if (!$config['configured'] || empty($config['providers'])) {
            throw new RuntimeException('No provider configured. Copy api/config.example.json to api/config.json and set a BYOK environment variable.');
        }

        $providerName = (string) ($request['provider'] ?? $config['defaultProvider'] ?? '');
        $provider = $config['providers'][$providerName] ?? null;
        if (!is_array($provider)) {
            throw new InvalidArgumentException('Unknown provider: ' . $providerName);
        }

        $envKey = (string) ($provider['apiKeyEnv'] ?? '');
        $envVal = trim((string) ($provider['apiKey'] ?? ''));
        if ($envVal === '' && $envKey !== '') $envVal = trim((string) getenv($envKey));
        if ($envKey !== '' && $envVal === '') {
            throw new RuntimeException('Provider key is not configured: ' . $envKey);
        }

        $system = (string) ($request['system'] ?? '');
        $prompt = (string) ($request['prompt'] ?? '');
        if ($prompt === '') {
            throw new InvalidArgumentException('A prompt is required.');
        }

        if ($providerName === 'simulator' || $providerName === 'mock') {
            return [
                'provider' => $providerName,
                'model' => (string) ($provider['model'] ?? 'kra-simulator-v1'),
                'content' => "// Generated by KRA " . ucfirst($providerName) . " Engine\n"
                    . "// Prompt: " . $prompt . "\n"
                    . "// Status: Validated for Propose-then-Approve lifecycle\n",
            ];
        }

        $endpoint = self::endpoint($providerName, (string) $provider['baseUrl'], (string) $provider['model']);
        $headers = ['Content-Type: application/json'];
        if ($providerName === 'anthropic') {
            $headers[] = 'x-api-key: ' . $envVal;
            $headers[] = 'anthropic-version: 2023-06-01';
            $body = [
                'model' => $provider['model'],
                'max_tokens' => (int) ($request['maxTokens'] ?? 4000),
                'system' => $system,
                'messages' => [['role' => 'user', 'content' => $prompt]],
            ];
        } elseif ($providerName === 'gemini') {
            $endpoint .= '?key=' . rawurlencode($envVal);
            $body = [
                'contents' => [['parts' => [['text' => ($system !== '' ? $system . "\n\n" : '') . $prompt]]]],
                'generationConfig' => ['maxOutputTokens' => (int) ($request['maxTokens'] ?? 4000)],
            ];
        } else {
            if ($envVal !== '') {
                $headers[] = 'Authorization: Bearer ' . $envVal;
            }
            $body = [
                'model' => $provider['model'],
                'messages' => array_values(array_filter([
                    $system !== '' ? ['role' => 'system', 'content' => $system] : null,
                    ['role' => 'user', 'content' => $prompt],
                ])),
                'max_tokens' => (int) ($request['maxTokens'] ?? 4000),
                'temperature' => (float) ($request['temperature'] ?? 0.2),
            ];
        }

        try {
            $response = self::request($endpoint, $headers, $body);
            return [
                'provider' => $providerName,
                'model' => $provider['model'],
                'content' => self::extractContent($providerName, $response),
            ];
        } catch (Throwable $e) {
            $fallback = (string) ($provider['fallbackProvider'] ?? '');
            if ($fallback !== '' && $fallback !== $providerName) {
                $fb = self::propose(array_replace($request, ['provider' => $fallback]));
                $fb['fallbackFrom'] = $providerName;
                return $fb;
            }
            throw $e;
        }
    }

    private static function endpoint(string $name, string $baseUrl, string $model): string
    {
        $baseUrl = rtrim($baseUrl, '/');
        if ($name === 'anthropic') {
            return $baseUrl . '/messages';
        }
        if ($name === 'gemini') {
            return $baseUrl . '/models/' . rawurlencode($model) . ':generateContent';
        }
        return $baseUrl . '/chat/completions';
    }

    private static function request(string $url, array $headers, array $body, ?int $timeoutSeconds = null, bool $post = true): array
    {
        $payload = json_encode($body, JSON_UNESCAPED_SLASHES);

        $timeout = max(3, min(90, $timeoutSeconds ?? (int) (getenv('KRA_AI_REQUEST_TIMEOUT_SECONDS') ?: 30)));
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt_array($ch, [
                    CURLOPT_POST => $post,
                    CURLOPT_HTTPGET => !$post,
                    CURLOPT_POSTFIELDS => $post ? $payload : null,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CONNECTTIMEOUT => min(6, $timeout),
                    CURLOPT_TIMEOUT => $timeout,
                    CURLOPT_FOLLOWLOCATION => false,
                    CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                ]);
                $raw = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);
                if ($raw === false) {
                    throw new RuntimeException('Provider request failed or timed out.');
                }
                $decoded = json_decode($raw, true);
                if ($status < 200 || $status >= 300 || !is_array($decoded)) {
                    throw new RuntimeException('Provider returned HTTP ' . $status . '.');
                }
                return $decoded;
            }
        }

        // Resilient fallback using PHP streams when curl extension is absent
        $headerString = implode("\r\n", $headers) . "\r\n";
        $context = stream_context_create([
            'http' => [
                'method' => $post ? 'POST' : 'GET',
                'header' => $headerString,
                'content' => $post ? $payload : '',
                'timeout' => $timeout,
                'ignore_errors' => true,
                'follow_location' => 0,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $raw = @file_get_contents($url, false, $context);
        if ($raw === false) {
            // Stream-wrapper errors can echo the full URL, which may include a Gemini API key.
            throw new RuntimeException('Provider request failed or timed out.');
        }

        $status = 200;
        if (isset($http_response_header) && is_array($http_response_header)) {
            if (preg_match('{HTTP\/\S*\s(\d{3})}', $http_response_header[0], $m)) {
                $status = (int) $m[1];
            }
        }

        $decoded = json_decode($raw, true);
        if ($status < 200 || $status >= 300 || !is_array($decoded)) {
            throw new RuntimeException('Provider returned HTTP ' . $status . '.');
        }
        return $decoded;
    }

    private static function extractContent(string $provider, array $response): string
    {
        if ($provider === 'anthropic') {
            return (string) ($response['content'][0]['text'] ?? '');
        }
        if ($provider === 'gemini') {
            return (string) ($response['candidates'][0]['content']['parts'][0]['text'] ?? '');
        }
        return (string) ($response['choices'][0]['message']['content'] ?? '');
    }
}
