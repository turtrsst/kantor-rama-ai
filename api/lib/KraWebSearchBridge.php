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
        $cleanUrl = trim($url);
        if (!filter_var($cleanUrl, FILTER_VALIDATE_URL)) {
            return ['ok' => false, 'error' => 'Invalid URL specified.'];
        }

        $scheme = parse_url($cleanUrl, PHP_URL_SCHEME);
        if (!in_array(strtolower((string) $scheme), ['http', 'https'], true)) {
            return ['ok' => false, 'error' => 'Only HTTP and HTTPS URLs allowed.'];
        }

        // Block internal private IPs (SSRF guard)
        $host = parse_url($cleanUrl, PHP_URL_HOST);
        if ($host && (
            $host === 'localhost' ||
            str_starts_with($host, '127.') ||
            str_starts_with($host, '192.168.') ||
            str_starts_with($host, '10.')
        )) {
            return ['ok' => false, 'error' => 'SSRF gate: Internal network target blocked.'];
        }

        $headers = [
            'User-Agent: Kantor-Rama-AI/1.0 (Research Analyst Bot; +https://github.com/turtrsst/kantor-rama-ai)',
            'Accept: text/html,application/xhtml+xml,text/plain;q=0.9',
        ];

        $raw = self::request($cleanUrl, $headers);
        if ($raw === null) {
            return ['ok' => false, 'error' => 'Failed to retrieve content from URL.'];
        }

        $markdown = self::htmlToMarkdown($raw);
        return [
            'ok' => true,
            'url' => $cleanUrl,
            'length' => strlen($markdown),
            'content' => $markdown,
        ];
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
