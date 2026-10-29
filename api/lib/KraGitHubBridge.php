<?php
declare(strict_types=1);

final class KraGitHubBridge
{
    private static function getRepo(): string
    {
        $envRepo = getenv('GITHUB_REPOSITORY') ?: getenv('KRA_GITHUB_REPO');
        if ($envRepo) {
            return trim($envRepo);
        }
        return 'turtrsst/kantor-rama-ai';
    }

    private static function getToken(): string
    {
        return trim((string) (getenv('GITHUB_TOKEN') ?: getenv('GH_TOKEN') ?: ''));
    }

    private static function apiRequest(string $endpoint, string $method = 'GET', array $data = []): array
    {
        $repo = self::getRepo();
        $token = self::getToken();
        $url = "https://api.github.com/repos/{$repo}/" . ltrim($endpoint, '/');

        $headers = [
            'User-Agent: Kantor-Rama-AI/1.0',
            'Accept: application/vnd.github.v3+json',
        ];
        if ($token !== '') {
            $headers[] = "Authorization: Bearer {$token}";
        }

        $payload = !empty($data) ? json_encode($data, JSON_UNESCAPED_SLASHES) : null;

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                curl_setopt($ch, CURLOPT_TIMEOUT, 20);
                if ($method === 'POST') {
                    curl_setopt($ch, CURLOPT_POST, true);
                    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                } elseif ($method !== 'GET') {
                    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                }
                $raw = curl_exec($ch);
                $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);

                if ($raw !== false && $code >= 200 && $code < 300) {
                    $json = json_decode($raw, true);
                    return ['ok' => true, 'status' => $code, 'data' => is_array($json) ? $json : $raw];
                }
                return ['ok' => false, 'status' => $code, 'error' => $raw ?: 'cURL request failed'];
            }
        }

        // Native streams fallback
        $headerStr = implode("\r\n", $headers) . "\r\n";
        $opts = [
            'http' => [
                'method' => $method,
                'header' => $headerStr,
                'timeout' => 20,
                'ignore_errors' => true,
            ]
        ];
        if ($payload !== null) {
            $opts['http']['content'] = $payload;
        }

        $raw = @file_get_contents($url, false, stream_context_create($opts));
        $code = 200;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $code = (int) $m[1];
        }

        if ($raw !== false && $code >= 200 && $code < 300) {
            $json = json_decode($raw, true);
            return ['ok' => true, 'status' => $code, 'data' => is_array($json) ? $json : $raw];
        }

        return ['ok' => false, 'status' => $code, 'error' => $raw ?: 'Stream request failed'];
    }

    public static function listRuns(?string $workflowFile = null, int $limit = 5): array
    {
        $endpoint = $workflowFile !== null && $workflowFile !== ''
            ? "actions/workflows/{$workflowFile}/runs?per_page={$limit}"
            : "actions/runs?per_page={$limit}";

        $res = self::apiRequest($endpoint);
        if (!$res['ok']) {
            // Graceful offline fallback metadata when no live token is present
            return [
                'ok' => false,
                'repo' => self::getRepo(),
                'error' => $res['error'] ?? 'API error',
                'status' => $res['status'] ?? 0,
                'runs' => [],
            ];
        }

        $runs = [];
        $rawRuns = $res['data']['workflow_runs'] ?? [];
        foreach ($rawRuns as $r) {
            $runs[] = [
                'id' => $r['id'] ?? null,
                'name' => $r['name'] ?? '',
                'status' => $r['status'] ?? '',
                'conclusion' => $r['conclusion'] ?? '',
                'branch' => $r['head_branch'] ?? '',
                'url' => $r['html_url'] ?? '',
                'created_at' => $r['created_at'] ?? '',
            ];
        }

        return [
            'ok' => true,
            'repo' => self::getRepo(),
            'count' => count($runs),
            'runs' => $runs,
        ];
    }

    public static function dispatch(string $workflowFile, string $ref = 'main', array $inputs = []): array
    {
        $endpoint = "actions/workflows/{$workflowFile}/dispatches";
        $data = [
            'ref' => $ref,
            'inputs' => $inputs,
        ];
        $res = self::apiRequest($endpoint, 'POST', $data);
        if ($res['status'] === 204 || $res['ok']) {
            return [
                'ok' => true,
                'message' => "Workflow {$workflowFile} dispatched on ref: {$ref}.",
                'repo' => self::getRepo(),
            ];
        }
        return [
            'ok' => false,
            'error' => $res['error'] ?? 'Dispatch failed',
            'status' => $res['status'] ?? 0,
            'repo' => self::getRepo(),
        ];
    }

    public static function getWorkflowLogs(int $runId): array
    {
        $endpoint = "actions/runs/{$runId}/jobs";
        $res = self::apiRequest($endpoint);
        if (!$res['ok']) {
            return ['ok' => false, 'error' => $res['error'] ?? 'Could not fetch run jobs'];
        }
        $jobs = [];
        foreach ($res['data']['jobs'] ?? [] as $job) {
            $jobs[] = [
                'id' => $job['id'] ?? null,
                'name' => $job['name'] ?? '',
                'status' => $job['status'] ?? '',
                'conclusion' => $job['conclusion'] ?? '',
                'steps' => array_map(fn($s) => [
                    'name' => $s['name'] ?? '',
                    'status' => $s['status'] ?? '',
                    'conclusion' => $s['conclusion'] ?? '',
                ], $job['steps'] ?? []),
            ];
        }
        return ['ok' => true, 'runId' => $runId, 'jobs' => $jobs];
    }
}
