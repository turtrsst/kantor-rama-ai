<?php
declare(strict_types=1);

require_once __DIR__ . '/KraVaultSync.php';
require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraRouterGateway.php';

final class KraSemanticMemory
{
    public static function recall(string $query, int $limit = 5): array
    {
        $vaultDir = KraVaultSync::getVaultDir();
        if ($vaultDir === '' || !is_dir($vaultDir)) {
            return [];
        }

        $documents = self::scanVaultDocuments($vaultDir);
        if (empty($documents)) {
            return [];
        }

        $queryVector = self::embedText($query);
        $scored = [];

        foreach ($documents as $doc) {
            $docVector = self::embedText($doc['content']);
            $similarity = self::cosineSimilarity($queryVector, $docVector);
            $lexicalBoost = self::lexicalScore($query, $doc['title'] . ' ' . $doc['content']);
            $finalScore = ($similarity * 0.7) + ($lexicalBoost * 0.3);

            if ($finalScore > 0.05) {
                $snippet = self::snippet($doc['content'], $query);
                $scored[] = [
                    'file' => $doc['relative_path'],
                    'title' => $doc['title'],
                    'score' => round($finalScore, 4),
                    'similarity' => round($similarity, 4),
                    'snippet' => $snippet,
                    'link' => '[[' . str_replace('.md', '', $doc['relative_path']) . ']]',
                ];
            }
        }

        usort($scored, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);
        return array_slice($scored, 0, max(1, $limit));
    }

    private static function scanVaultDocuments(string $vaultDir): array
    {
        $files = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($vaultDir, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $info) {
            if (!$info->isFile() || strtolower($info->getExtension()) !== 'md') {
                continue;
            }
            $fullPath = $info->getPathname();
            if (str_contains($fullPath, '.obsidian')) {
                continue;
            }
            $relative = str_replace('\\', '/', substr($fullPath, strlen($vaultDir) + 1));
            $content = (string) @file_get_contents($fullPath);
            if ($content === '') {
                continue;
            }

            $title = $info->getBasename('.md');
            $files[] = [
                'relative_path' => $relative,
                'title' => $title,
                'content' => $content,
            ];
        }

        return $files;
    }

    private static function embedText(string $text): array
    {
        $clean = strtolower(trim(preg_replace('/[^a-zA-Z0-9\s]/', ' ', $text)));
        $words = array_values(array_filter(explode(' ', $clean), static fn(string $w): bool => strlen($w) > 2));
        if (empty($words)) {
            return array_fill(0, 64, 0.0);
        }

        $vector = array_fill(0, 64, 0.0);
        foreach ($words as $word) {
            $hash = crc32($word);
            $index = abs($hash) % 64;
            $vector[$index] += 1.0;
        }

        $norm = 0.0;
        foreach ($vector as $val) {
            $norm += $val * $val;
        }
        $norm = sqrt($norm);
        if ($norm > 0.0) {
            for ($i = 0; $i < 64; $i++) {
                $vector[$i] /= $norm;
            }
        }

        return $vector;
    }

    private static function cosineSimilarity(array $vecA, array $vecB): float
    {
        $dot = 0.0;
        for ($i = 0; $i < count($vecA); $i++) {
            $dot += ($vecA[$i] ?? 0.0) * ($vecB[$i] ?? 0.0);
        }
        return max(0.0, min(1.0, $dot));
    }

    private static function lexicalScore(string $query, string $text): float
    {
        $qWords = array_values(array_filter(explode(' ', strtolower(trim($query)))));
        if (empty($qWords)) {
            return 0.0;
        }
        $matches = 0;
        $lowerText = strtolower($text);
        foreach ($qWords as $qw) {
            if (str_contains($lowerText, $qw)) {
                $matches++;
            }
        }
        return $matches / count($qWords);
    }

    private static function snippet(string $content, string $query): string
    {
        $pos = stripos($content, $query);
        if ($pos === false) {
            return substr(trim(preg_replace('/\s+/', ' ', $content)), 0, 160) . '...';
        }
        $start = max(0, $pos - 40);
        return '...' . trim(preg_replace('/\s+/', ' ', substr($content, $start, 160))) . '...';
    }
}
