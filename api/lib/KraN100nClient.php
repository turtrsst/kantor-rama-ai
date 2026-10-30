<?php
declare(strict_types=1);

/** Server-side bridge to the local N100N REST service. Secrets never leave PHP. */
final class KraN100nClient
{
    private static function environment(string $name): string
    {
        $value = getenv($name);
        if ($value === false || $value === '') $value = $_SERVER[$name] ?? $_ENV[$name] ?? '';
        return trim((string) $value);
    }

    private static function baseUrl(): string
    {
        $url = self::environment('KRA_N100N_BASE_URL') ?: 'http://127.0.0.1:5679';
        $parts = parse_url($url);
        if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            throw new RuntimeException('N100N base URL is not a valid HTTP(S) URL.');
        }
        return rtrim($url, '/');
    }

    private static function apiKey(): string
    {
        $key = self::environment('KRA_N100N_API_KEY');
        if ($key === '') {
            throw new RuntimeException('N100N is not configured on the KRA server. Set KRA_N100N_API_KEY in the PHP environment.');
        }
        return $key;
    }

    /** @return array<string,mixed> */
    private static function request(string $method, string $path, ?array $payload = null): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('PHP cURL is required for the local N100N connection.');
        }
        $url = self::baseUrl() . $path;
        $headers = ['Accept: application/json', 'x-api-key: ' . self::apiKey()];
        $handle = curl_init($url);
        if ($handle === false) throw new RuntimeException('Could not start the N100N request.');
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        ];
        if ($payload !== null) {
            $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($body === false) {
                curl_close($handle);
                throw new RuntimeException('N100N request payload could not be encoded.');
            }
            $options[CURLOPT_POSTFIELDS] = $body;
            $options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/json';
        }
        curl_setopt_array($handle, $options);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $failed = $response === false;
        curl_close($handle);
        if ($failed) throw new RuntimeException('N100N did not respond. Confirm the local service is running and the KRA server can reach it.');
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('N100N returned HTTP ' . $status . '. Check its API key and workflow endpoint.');
        }
        $decoded = json_decode((string) $response, true);
        if (!is_array($decoded)) throw new RuntimeException('N100N returned a response that is not valid JSON.');
        return $decoded;
    }

    /** GET /api/workflows doubles as a credential-safe connection health check. */
    public static function status(): array
    {
        try {
            $workflows = self::workflows();
            return ['ok' => true, 'connected' => true, 'configured' => true, 'workflowCount' => count($workflows)];
        } catch (Throwable $error) {
            $configured = self::environment('KRA_N100N_API_KEY') !== '';
            return ['ok' => true, 'connected' => false, 'configured' => $configured, 'message' => $error->getMessage()];
        }
    }

    /** @return list<array<string,mixed>> */
    public static function workflows(): array
    {
        $data = self::request('GET', '/api/workflows');
        $rows = $data['workflows'] ?? $data['data']['workflows'] ?? $data['data'] ?? $data;
        if (!is_array($rows)) throw new RuntimeException('N100N returned an unexpected workflow list.');
        if (!array_is_list($rows)) {
            $rows = array_values($rows);
        }
        return array_values(array_filter($rows, static fn($item): bool => is_array($item)));
    }

    public static function run(int $workflowId, array $items): array
    {
        if ($workflowId < 1) throw new InvalidArgumentException('Choose a valid N100N workflow.');
        if (count($items) > 100) throw new InvalidArgumentException('A maximum of 100 workflow items can be sent at once.');
        return self::request('POST', '/api/workflows/' . $workflowId . '/run', [
            'workflow_id' => $workflowId,
            'items' => $items,
        ]);
    }

    public static function execution(string $executionId): array
    {
        $id = trim($executionId);
        if ($id === '' || strlen($id) > 128 || !preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
            throw new InvalidArgumentException('Execution ID contains unsupported characters.');
        }
        return self::request('GET', '/api/executions/' . rawurlencode($id));
    }
}
