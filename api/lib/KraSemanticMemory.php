<?php
declare(strict_types=1);

require_once __DIR__ . '/KraVaultSync.php';
require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraRouterGateway.php';
require_once __DIR__ . '/KraTenantContext.php';

final class KraSemanticMemory
{
    public static function recall(string $query, int $limit = 5): array
    {
        $vaultDir = KraVaultSync::getVaultDir();
        $memoryDir = KraVaultSync::getMemoryDir(false);
        if ($vaultDir === '' || !is_dir($vaultDir) || $memoryDir === '') {
            return [];
        }

        $documents = self::scanVaultDocuments($vaultDir, $memoryDir);
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
                    'workspaceId' => KraTenantContext::workspaceId(),
                    'link' => '[[' . preg_replace('/\.md$/', '', $doc['relative_path']) . ']]',
                ];
            }
        }

        usort($scored, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);
        return array_slice($scored, 0, max(1, $limit));
    }

    private static function scanVaultDocuments(string $vaultDir, string $memoryDir): array
    {
        // Hosted mode is strict: semantic recall only reads the active
        // workspace's generated memory folder. Local-first installations may
        // also search the owner's selected vault, while excluding sibling
        // KRA workspace folders and notes explicitly stamped for another one.
        $scanRoot = KraTenantContext::isHosted() && KraTenantContext::hasWorkspace() && !KraTenantContext::canSeeLegacy()
            ? $memoryDir
            : $vaultDir;
        if (!is_dir($scanRoot)) return [];
        $files = [];
        $workspaceId = KraTenantContext::workspaceId();
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($scanRoot, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $info) {
            if (count($files) >= 500) break;
            if (!$info->isFile() || $info->isLink() || strtolower($info->getExtension()) !== 'md' || $info->getSize() > 524288) {
                continue;
            }
            $fullPath = $info->getPathname();
            $normalized = str_replace('\\', '/', $fullPath);
            if (str_contains($normalized, '/.obsidian/')) continue;
            $relativeToVault = str_replace('\\', '/', substr($fullPath, strlen($vaultDir) + 1));
            if (preg_match('#^KRA Workspaces/([^/]+)/#', $relativeToVault, $m)
                && $workspaceId !== KraTenantContext::LEGACY_WORKSPACE_ID
                && $m[1] !== $workspaceId) {
                continue;
            }
            $content = (string) @file_get_contents($fullPath);
            if ($content === '') continue;
            if (preg_match('/^---\s*\n.*?^kra_workspace:\s*([^\s]+).*?^---\s*$/ms', $content, $fm)
                && KraTenantContext::hasWorkspace()
                && trim((string) $fm[1]) !== $workspaceId
                && !KraTenantContext::canSeeLegacy()) {
                continue;
            }

            $files[] = [
                'relative_path' => $relativeToVault,
                'title' => $info->getBasename('.md'),
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
            // Multi-word recall scores individual terms. Anchor the excerpt
            // on the window containing the most distinct query terms; merely
            // taking the earliest term often lands in YAML tags/frontmatter.
            $terms = [];
            foreach (preg_split('/\s+/', strtolower(trim($query))) ?: [] as $term) {
                $term = trim($term, " \t\n\r\0\x0B.,;:!?()[]{}\"'`");
                if (strlen($term) >= 3) $terms[$term] = true;
            }
            $terms = array_keys($terms);
            $candidates = [];
            foreach ($terms as $term) {
                $offset = 0;
                for ($i = 0; $i < 20; $i++) {
                    $candidate = stripos($content, $term, $offset);
                    if ($candidate === false) break;
                    $candidates[] = $candidate;
                    $offset = $candidate + strlen($term);
                }
            }
            $bestScore = -1;
            foreach (array_unique($candidates) as $candidate) {
                $window = strtolower(substr($content, max(0, $candidate - 40), 220));
                $score = 0;
                foreach ($terms as $term) if (str_contains($window, $term)) $score++;
                if ($score > $bestScore || ($score === $bestScore && ($pos === false || $candidate < $pos))) {
                    $bestScore = $score;
                    $pos = $candidate;
                }
            }
        }
        if ($pos === false) {
            return substr(trim(preg_replace('/\s+/', ' ', $content)), 0, 160) . '...';
        }
        $start = max(0, $pos - 40);
        return '...' . trim(preg_replace('/\s+/', ' ', substr($content, $start, 160))) . '...';
    }
}
