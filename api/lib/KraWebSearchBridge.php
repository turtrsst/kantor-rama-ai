<?php
declare(strict_types=1);

final class KraWebSearchBridge
{
    private const MAX_FETCH_BYTES = 60000;
    private const MAX_TEXT_LENGTH = 12000;

    public static function search(string $query, int $limit = 5): array
    {
        $q = trim($query);
        if ($q === '') {
            return ['ok' => false, 'error' => 'Query cannot be empty.'];
        }

        // Try DuckDuckGo HTML Lite search
        $url = 'https://html.duckduckgo.com/html/?q=' . urlencode($q);
        $headers = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept: text/html,application/xhtml+xml',
        ];

        $html = self::request($url, $headers);
        if ($html === null || $html === '') {
            return [
                'ok' => false,
                'error' => 'Search upstream request failed or blocked.',
                'query' => $q,
                'results' => [],
            ];
        }

        $results = self::parseDuckDuckGoResults($html, $limit);
        return [
            'ok' => true,
            'query' => $q,
            'count' => count($results),
            'results' => $results,
        ];
    }

    public static function fetch(string $url): array
    {
        $current = trim($url);
        if (!filter_var($current, FILTER_VALIDATE_URL)) {
            return ['ok' => false, 'error' => 'Invalid URL specified.'];
        }
        $headers = [
            'User-Agent: Kantor-Rama-AI/1.0 (Research Analyst Bot; +https://github.com/turtrsst/kantor-rama-ai)',
            'Accept: text/html,application/xhtml+xml,text/plain;q=0.9',
        ];

        // Resolve and classify every destination, including every redirect hop.
        for ($hop = 0; $hop <= 3; $hop++) {
            $target = self::validatePublicTarget($current);
            if (!($target['ok'] ?? false)) return ['ok' => false, 'error' => $target['error']];
            $response = self::requestPublic($current, $headers, $target['ips']);
            if (!($response['ok'] ?? false)) return ['ok' => false, 'error' => $response['error'] ?? 'Upstream request failed.'];
            $status = (int) ($response['status'] ?? 0);
            if (in_array($status, [301, 302, 303, 307, 308], true)) {
                if ($hop === 3 || empty($response['location'])) {
                    return ['ok' => false, 'error' => 'Redirect limit reached or redirect location missing.'];
                }
                $current = self::resolveRedirect($current, (string) $response['location']);
                if (!filter_var($current, FILTER_VALIDATE_URL)) return ['ok' => false, 'error' => 'Invalid redirect URL.'];
                continue;
            }
            if ($status < 200 || $status >= 300) return ['ok' => false, 'error' => 'Upstream returned HTTP ' . $status . '.'];
            $markdown = self::htmlToMarkdown((string) $response['body']);
            return [
                'ok' => true,
                'url' => $current,
                'length' => strlen($markdown),
                'content' => $markdown,
            ];
        }
        return ['ok' => false, 'error' => 'Redirect limit exceeded.'];
    }

    private static function validatePublicTarget(string $url): array
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = strtolower(rtrim((string) parse_url($url, PHP_URL_HOST), '.'));
        $port = (int) (parse_url($url, PHP_URL_PORT) ?? ($scheme === 'https' ? 443 : 80));
        $expectedPort = $scheme === 'https' ? 443 : 80;
        if (!in_array($scheme, ['http', 'https'], true) || $host === '' || $port !== $expectedPort
            || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null) {
            return ['ok' => false, 'error' => 'Only public HTTP/HTTPS on standard ports without URL credentials is allowed.'];
        }
        if (str_contains($host, '%') || $host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
            return ['ok' => false, 'error' => 'SSRF gate: local hostnames are blocked.'];
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $ips = [$host];
        } else {
            $records = @dns_get_record($host, DNS_A | DNS_AAAA);
            $ips = [];
            foreach (($records ?: []) as $record) {
                if (!empty($record['ip'])) $ips[] = $record['ip'];
                if (!empty($record['ipv6'])) $ips[] = $record['ipv6'];
            }
        }
        $ips = array_values(array_unique($ips));
        if ($ips === []) return ['ok' => false, 'error' => 'SSRF gate: hostname did not resolve to a public address.'];
        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return ['ok' => false, 'error' => 'SSRF gate: private, reserved, and non-routable addresses are blocked.'];
            }
        }
        return ['ok' => true, 'ips' => $ips];
    }

    private static function requestPublic(string $url, array $headers, array $ips): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'Secure URL fetch requires the PHP cURL extension.'];
        }
        $host = (string) parse_url($url, PHP_URL_HOST);
        $port = (int) (parse_url($url, PHP_URL_PORT) ?? (strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https' ? 443 : 80));
        $ip = $ips[0];
        $resolveIp = str_contains($ip, ':') ? '[' . $ip . ']' : $ip;
        $location = '';
        $body = '';
        $ch = curl_init($url);
        if ($ch === false) return ['ok' => false, 'error' => 'Unable to initialize cURL.'];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXREDIRS => 0,
            CURLOPT_RESOLVE => [$host . ':' . $port . ':' . $resolveIp],
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$location): int {
                if (stripos($line, 'Location:') === 0) $location = trim(substr($line, 9));
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body): int {
                if (strlen($body) + strlen($chunk) > self::MAX_FETCH_BYTES) return 0;
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($body === false) return ['ok' => false, 'error' => 'Upstream request failed: ' . $error];
        return ['ok' => true, 'status' => $status, 'location' => $location, 'body' => $body];
    }

    private static function resolveRedirect(string $base, string $location): string
    {
        $location = trim($location);
        if (preg_match('#^https?://#i', $location)) return $location;
        $parts = parse_url($base);
        if (!$parts || empty($parts['scheme']) || empty($parts['host'])) return '';
        $origin = $parts['scheme'] . '://' . $parts['host']
            . (isset($parts['port']) ? ':' . $parts['port'] : '');
        if (str_starts_with($location, '//')) return $parts['scheme'] . ':' . $location;
        if (str_starts_with($location, '/')) return $origin . $location;
        $path = (string) ($parts['path'] ?? '/');
        return $origin . rtrim(dirname($path), '/') . '/' . $location;
    }

    public static function htmlToMarkdown(string $html): string
    {
        // Strip scripts, styles, iframes
        $clean = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $html);
        $clean = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', (string) $clean);
        $clean = preg_replace('/<svg\b[^>]*>(.*?)<\/svg>/is', '', (string) $clean);
        $clean = preg_replace('/<!--(.*?)-->/s', '', (string) $clean);

        // Convert standard headings
        $clean = preg_replace('/<h1[^>]*>(.*?)<\/h1>/i', "\n# $1\n", (string) $clean);
        $clean = preg_replace('/<h2[^>]*>(.*?)<\/h2>/i', "\n## $1\n", (string) $clean);
        $clean = preg_replace('/<h3[^>]*>(.*?)<\/h3>/i', "\n### $1\n", (string) $clean);

        // Convert links [text](href)
        $clean = preg_replace_callback('/<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/i', static function ($m) {
            $text = trim(strip_tags($m[2]));
            return $text !== '' ? "[{$text}]({$m[1]})" : '';
        }, (string) $clean);

        // Convert paragraphs and line breaks
        $clean = preg_replace('/<p[^>]*>/i', "\n\n", (string) $clean);
        $clean = preg_replace('/<\/p>/i', '', (string) $clean);
        $clean = preg_replace('/<br\s*\/?>/i', "\n", (string) $clean);
        $clean = preg_replace('/<li[^>]*>/i', "\n- ", (string) $clean);

        // Strip remaining HTML tags
        $text = strip_tags((string) $clean);

        // Clean up excessive whitespace
        $text = (string) preg_replace('/[ \t]+/', ' ', $text);
        $text = (string) preg_replace('/\n\s+\n/', "\n\n", $text);
        $text = (string) preg_replace('/\n{3,}/', "\n\n", $text);
        $text = trim($text);

        // ponytail: clamped to 12KB for LLM context window safety
        if (strlen($text) > self::MAX_TEXT_LENGTH) {
            $text = substr($text, 0, self::MAX_TEXT_LENGTH) . "\n\n... [Content truncated for length]";
        }

        return $text;
    }

    private static function parseDuckDuckGoResults(string $html, int $limit): array
    {
        $results = [];
        // Match DuckDuckGo HTML results
        // <a class="result__url" href="..."> or <a class="result__snippet" ...>
        if (preg_match_all('/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/is', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $rawUrl = $m[1];
                // Unpack uddg parameter if wrapped
                if (preg_match('/uddg=([^&]+)/', $rawUrl, $um)) {
                    $rawUrl = urldecode($um[1]);
                }
                $snippet = trim(strip_tags($m[2]));
                $results[] = [
                    'url' => $rawUrl,
                    'snippet' => $snippet,
                ];
                if (count($results) >= $limit) break;
            }
        }

        // Fallback title matcher if snippet pattern failed
        if (empty($results) && preg_match_all('/<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/is', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $rawUrl = trim(strip_tags($m[1]));
                if (str_starts_with($rawUrl, 'http')) {
                    $results[] = [
                        'url' => $rawUrl,
                        'snippet' => trim(strip_tags($m[2])),
                    ];
                }
                if (count($results) >= $limit) break;
            }
        }

        return $results;
    }

    private static function request(string $url, array $headers): ?string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_TIMEOUT => 15,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 3,
                ]);
                $content = curl_exec($ch);
                $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);
                if ($content !== false && $code >= 200 && $code < 400) {
                    return substr((string) $content, 0, self::MAX_FETCH_BYTES);
                }
            }
        }

        // Fallback stream
        $headerStr = implode("\r\n", $headers) . "\r\n";
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => $headerStr,
                'timeout' => 15,
                'ignore_errors' => true,
            ]
        ]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw !== false) {
            return substr($raw, 0, self::MAX_FETCH_BYTES);
        }
        return null;
    }
}
