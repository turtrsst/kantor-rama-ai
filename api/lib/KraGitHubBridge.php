<?php
declare(strict_types=1);

final class KraGitHubBridge
{
    public static function getRepo(): string
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

    private static function apiRequest(string $endpoint, string $method = 'GET', array $data = [], ?string $repoOverride = null): array
    {
        $repo = $repoOverride !== null && trim($repoOverride) !== '' ? trim($repoOverride) : self::getRepo();
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

    public static function isReady(): array
    {
        $token = self::getToken();
        return [
            'ready' => $token !== '',
            'repo' => self::getRepo(),
            'reason' => $token === '' ? 'GITHUB_TOKEN belum diset di environment server KRA.' : '',
        ];
    }

    public static function branches(?string $repo = null, int $limit = 50): array
    {
        $res = self::apiRequest('branches?per_page=' . max(1, min(100, $limit)), 'GET', [], $repo);
        if (!$res['ok']) return ['ok' => false, 'error' => $res['error'] ?? 'Could not list branches'];
        $branches = array_map(fn($b) => [
            'name' => (string) ($b['name'] ?? ''),
            'sha' => (string) ($b['commit']['sha'] ?? ''),
            'protected' => (bool) ($b['protected'] ?? false),
        ], is_array($res['data']) ? $res['data'] : []);
        return ['ok' => true, 'branches' => $branches];
    }

    public static function pullRequests(?string $repo = null, string $state = 'open', int $limit = 30): array
    {
        $state = in_array($state, ['open', 'closed', 'all'], true) ? $state : 'open';
        $res = self::apiRequest('pulls?state=' . $state . '&per_page=' . max(1, min(100, $limit)), 'GET', [], $repo);
        if (!$res['ok']) return ['ok' => false, 'error' => $res['error'] ?? 'Could not list pull requests'];
        $pulls = array_map(fn($p) => [
            'number' => (int) ($p['number'] ?? 0),
            'title' => (string) ($p['title'] ?? ''),
            'state' => (string) ($p['state'] ?? ''),
            'draft' => (bool) ($p['draft'] ?? false),
            'head' => (string) ($p['head']['ref'] ?? ''),
            'base' => (string) ($p['base']['ref'] ?? ''),
            'mergeable' => $p['mergeable'] ?? null,
            'url' => (string) ($p['html_url'] ?? ''),
            'user' => (string) ($p['user']['login'] ?? ''),
        ], is_array($res['data']) ? $res['data'] : []);
        return ['ok' => true, 'pullRequests' => $pulls];
    }

    public static function createPullRequest(string $title, string $head, string $base = 'main', string $body = '', bool $draft = false, ?string $repo = null): array
    {
        $title = trim($title);
        $head = trim($head);
        $base = trim($base) !== '' ? trim($base) : 'main';
        if ($title === '' || $head === '') {
            return ['ok' => false, 'error' => 'Judul dan branch sumber (head) wajib diisi.'];
        }
        if ($head === $base) {
            return ['ok' => false, 'error' => 'Branch sumber dan target tidak boleh sama.'];
        }
        $payload = ['title' => $title, 'head' => $head, 'base' => $base, 'draft' => $draft];
        if (trim($body) !== '') $payload['body'] = $body;
        $res = self::apiRequest('pulls', 'POST', $payload, $repo);
        if (!$res['ok']) {
            $detail = is_array($res['data'] ?? null) ? (string) ($res['data']['message'] ?? '') : '';
            $errors = is_array($res['data']['errors'] ?? null) ? json_encode($res['data']['errors']) : '';
            return ['ok' => false, 'error' => trim(($res['error'] ?? 'Pull request creation failed') . ' ' . $detail . ' ' . $errors)];
        }
        $pr = is_array($res['data']) ? $res['data'] : [];
        return [
            'ok' => true,
            'number' => (int) ($pr['number'] ?? 0),
            'title' => (string) ($pr['title'] ?? $title),
            'head' => (string) ($pr['head']['ref'] ?? $head),
            'base' => (string) ($pr['base']['ref'] ?? $base),
            'url' => (string) ($pr['html_url'] ?? ''),
            'message' => 'Pull request #' . (int) ($pr['number'] ?? 0) . ' dibuat (' . $head . ' → ' . $base . ').',
        ];
    }

    public static function mergePullRequest(int $number, string $method = 'merge', ?string $repo = null): array
    {
        if ($number <= 0) return ['ok' => false, 'error' => 'Nomor PR tidak valid.'];
        $method = in_array($method, ['merge', 'squash', 'rebase'], true) ? $method : 'merge';
        $res = self::apiRequest('pulls/' . $number . '/merge', 'PUT', ['merge_method' => $method], $repo);
        if (!$res['ok']) {
            $detail = is_array($res['data'] ?? null) ? (string) ($res['data']['message'] ?? '') : '';
            return ['ok' => false, 'error' => trim(($res['error'] ?? 'Merge failed') . ' ' . $detail)];
        }
        $data = is_array($res['data']) ? $res['data'] : [];
        return [
            'ok' => true,
            'merged' => (bool) ($data['merged'] ?? false),
            'sha' => (string) ($data['sha'] ?? ''),
            'message' => (string) ($data['message'] ?? ('Pull request #' . $number . ' di-merge.')),
        ];
    }
}
