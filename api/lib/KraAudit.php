<?php
declare(strict_types=1);

final class KraAudit
{
    private const EXCLUDED = [
        '.git',
        '.obsidian',
        'node_modules',
        'vendor',
        '.cache',
        'dist',
        'build',
    ];

    /** Third-party asset trees copied into KRA; counted but not style-audited. */
    private const VENDORED = [
        'resources',
    ];

    private const TEXT_EXTENSIONS = [
        'php', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
        'css', 'html', 'md', 'json', 'yaml', 'yml',
        'xml', 'sql', 'py', 'sh', 'bat', 'ps1', 'txt',
    ];

    public static function run(string $target): array
    {
        $root = realpath($target);
        if ($root === false || !is_dir($root)) {
            throw new InvalidArgumentException('Target directory does not exist.');
        }

        $files = [];
        $findings = [];
        $extensions = [];
        $totalBytes = 0;
        $readable = 0;
        $todoCount = 0;
        $secretCount = 0;
        $largest = [];

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            if ($item->isDir()) {
                continue;
            }

            $relative = self::relative($root, $item->getPathname());
            if (self::excluded($relative)) {
                continue;
            }

            $size = $item->getSize();
            $totalBytes += $size;
            $ext = strtolower(pathinfo($item->getFilename(), PATHINFO_EXTENSION) ?: '[none]');
            $extensions[$ext] = ($extensions[$ext] ?? 0) + 1;
            $files[] = ['path' => $relative, 'size' => $size, 'ext' => $ext];
            $largest[] = ['path' => $relative, 'size' => $size];

            // Third-party assets are inventoried but not style/secret audited.
            if (self::vendored($relative)) {
                continue;
            }

            if ($size === 0) {
                self::add($findings, 'Low', $relative, 1, 'Empty file detected.');
            }

            if (!in_array($ext, self::TEXT_EXTENSIONS, true) || $size > 2_000_000) {
                continue;
            }

            $content = @file_get_contents($item->getPathname());
            if ($content === false) {
                continue;
            }

            $readable++;
            $isScannerSource = str_contains($relative, 'KraAudit.php');
            $isDoc = str_ends_with($relative, '.md') || str_ends_with($relative, '.json');
            $lines = preg_split('/\R/', $content) ?: [];

            foreach ($lines as $lineNo => $line) {
                $lineNum = $lineNo + 1;

                // Check debt markers (skip scanner definition and markdown docs)
                if (!$isScannerSource && !$isDoc) {
                    if (preg_match('/\b(TODO|FIXME|HACK|XXX)\b/i', $line, $matches)) {
                        $todoCount++;
                        self::add(
                            $findings,
                            'Low',
                            $relative,
                            $lineNum,
                            'Known debt marker: ' . strtoupper($matches[1]) . '.'
                        );
                    }
                }

                // Check potential credential leaks
                $knownSecretPattern = '/(-----BEGIN [A-Z ]+ PRIVATE KEY-----'
                    . '|\bAKIA[0-9A-Z]{16}\b'
                    . '|\bsk-[A-Za-z0-9_-]{20,}\b'
                    . '|\bgh[pousr]_[A-Za-z0-9]{20,}\b'
                    . '|\bxox[baprs]-[A-Za-z0-9-]{20,}\b'
                    . '|\bAIza[0-9A-Za-z_-]{30,}\b)/i';
                $credentialAssignmentPattern = '/\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?key|secret|password|token)\b\s*(?:=|=>|:)\s*(?:(["\'])([^"\']{8,})\1|([A-Za-z0-9_+\/-]{12,}))/i';
                $hasKnownSecret = preg_match($knownSecretPattern, $line) === 1;
                $hasLiteralCredential = false;
                if (!$hasKnownSecret && preg_match($credentialAssignmentPattern, $line, $credentialMatch) === 1) {
                    $isUnquoted = ($credentialMatch[3] ?? '') !== '';
                    $value = trim($isUnquoted ? $credentialMatch[3] : ($credentialMatch[2] ?? ''));
                    $isPlaceholder = preg_match('/^(?:<|\$|\{)|(?:^|[_-])(?:your|replace|change|insert|example|sample|dummy|fake|placeholder|do-not-show|not-set|none|null|cave_api_key)(?:[_-]|$)/i', $value) === 1;
                    $isEnvironmentLookup = preg_match('/\b(?:getenv|env|process\.env)\s*\(/i', $value) === 1;
                    $looksLikeHighEntropyKey = false;
                    if ($isUnquoted && strlen($value) >= 20) {
                        $entropy = 0.0;
                        foreach (count_chars($value, 1) as $frequency) {
                            $probability = $frequency / strlen($value);
                            $entropy -= $probability * log($probability, 2);
                        }
                        $looksLikeHighEntropyKey = $entropy >= 3.5;
                    }
                    $hasLiteralCredential = !$isPlaceholder && !$isEnvironmentLookup && (!$isUnquoted || $looksLikeHighEntropyKey);
                }
                if (!$isScannerSource && ($hasKnownSecret || $hasLiteralCredential)) {
                    $secretCount++;
                    self::add(
                        $findings,
                        'Critical',
                        $relative,
                        $lineNum,
                        'Possible credential or secret pattern detected.'
                    );
                }

                // Hard-coded absolute paths (outside markdown docs and READMEs)
                $auditLine = preg_replace('/\\\\n/', '', $line) ?? $line;
                $auditLine = preg_replace('/\\\\[A-Za-z]/', '', $auditLine) ?? $auditLine;
                if (!$isDoc && preg_match('/[A-Za-z]:\\\\[^\\s"\']+\\\\[^\\s"\']+/', $auditLine)) {
                    self::add(
                        $findings,
                        'Medium',
                        $relative,
                        $lineNum,
                        'Hard-coded Windows absolute path detected.'
                    );
                }

                // Line length check (excluding json/markdown/minified files)
                if ($ext !== 'json' && $ext !== 'md' && strlen($line) > 160) {
                    self::add(
                        $findings,
                        'Low',
                        $relative,
                        $lineNum,
                        'Long line (' . strlen($line) . ' chars) may reduce readability.'
                    );
                }
            }
        }

        usort($largest, fn($a, $b) => $b['size'] <=> $a['size']);
        $largest = array_slice($largest, 0, 5);

        $names = array_map(fn($f) => strtolower(basename($f['path'])), $files);

        if (!self::hasName($names, 'readme.md')) {
            self::add($findings, 'Medium', '[project root]', 0, 'README.md is missing.');
        }
        if (!self::hasName($names, '.gitignore')) {
            self::add($findings, 'Low', '[project root]', 0, '.gitignore is missing.');
        }
        if (!self::hasName($names, 'license') && !self::hasName($names, 'license.md')) {
            self::add($findings, 'Low', '[project root]', 0, 'License file is missing.');
        }

        $verdict = $secretCount > 0
            ? 'REJECTED / HALTED'
            : (count($findings) > 0 ? 'NEEDS REVISION' : 'APPROVED');

        return [
            'target' => $root,
            'generatedAt' => gmdate('c'),
            'verdict' => $verdict,
            'summary' => [
                'files' => count($files),
                'readableFiles' => $readable,
                'bytes' => $totalBytes,
                'findings' => count($findings),
                'todoMarkers' => $todoCount,
                'possibleSecrets' => $secretCount,
            ],
            'extensions' => $extensions,
            'largestFiles' => $largest,
            'findings' => $findings,
            'scope' => self::scope($names),
            'readOnly' => true,
        ];
    }

    private static function scope(array $names): array
    {
        return [
            'php' => in_array('composer.json', $names, true) || in_array('index.php', $names, true),
            'node' => in_array('package.json', $names, true),
            'git' => in_array('.git', $names, true),
            'web' => in_array('index.html', $names, true),
        ];
    }

    private static function hasName(array $names, string $name): bool
    {
        return in_array(strtolower($name), $names, true);
    }

    private static function excluded(string $path): bool
    {
        $normalized = str_replace('\\', '/', $path);
        foreach (explode('/', $normalized) as $part) {
            if (in_array(strtolower($part), self::EXCLUDED, true)) {
                return true;
            }
        }
        return false;
    }

    private static function vendored(string $path): bool
    {
        $normalized = str_replace('\\', '/', $path);
        $first = explode('/', $normalized)[0] ?? '';
        return in_array(strtolower($first), self::VENDORED, true);
    }

    private static function relative(string $root, string $path): string
    {
        return ltrim(str_replace('\\', '/', substr($path, strlen($root))), '/');
    }

    private static function add(
        array &$list,
        string $severity,
        string $file,
        int $line,
        string $message
    ): void {
        $list[] = [
            'severity' => $severity,
            'file' => $file ?: '[project root]',
            'line' => $line,
            'message' => $message,
        ];
    }
}
