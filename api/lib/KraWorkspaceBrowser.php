<?php
declare(strict_types=1);

require_once __DIR__ . '/KraProjectPath.php';
require_once __DIR__ . '/KraTaskEngine.php';

/** Read-only project workspace access used by the file tree and approval preview. */
final class KraWorkspaceBrowser
{
    private const OMIT_DIRS = ['.git', '.temp', 'node_modules', 'vendor', '.svn', '.hg'];
    private const MAX_FILE_BYTES = 262144;
    private const MAX_DIRECTORY_ENTRIES = 300;

    public static function resolveRoot(string $candidate): string
    {
        $candidate = trim($candidate);
        $absolute = preg_match('#^(?:[A-Za-z]:[\\\\/]|/|\\\\\\\\)#', $candidate) === 1;
        if (!$absolute || preg_match('#(^|[\\\\/])\\.\\.([\\\\/]|$)#', $candidate)) {
            throw new InvalidArgumentException('Project folder must be an absolute, normalized path.');
        }
        $real = $candidate !== '' ? realpath($candidate) : false;
        if ($real === false || !is_dir($real)) {
            throw new InvalidArgumentException('Choose an existing project folder.');
        }
        $comparisonCandidate = DIRECTORY_SEPARATOR === '\\'
            ? str_replace('/', '\\', rtrim($candidate, "\\/"))
            : rtrim($candidate, '/');
        if (!self::samePath($comparisonCandidate, $real)) {
            throw new InvalidArgumentException('Project folder paths that resolve through symbolic links or aliases are not allowed.');
        }

        $kraRoot = realpath(KraProjectPath::kraRoot()) ?: KraProjectPath::kraRoot();
        if (self::samePath($real, $kraRoot) || self::isWithin($kraRoot, $real)) {
            throw new InvalidArgumentException('The KRA installation folder is not available in the project browser.');
        }

        $projectsRoot = realpath(KraProjectPath::projectsRoot()) ?: KraProjectPath::projectsRoot();
        $allowed = self::isWithin($projectsRoot, $real) && !self::samePath($projectsRoot, $real);
        if (!$allowed) {
            foreach (KraTaskEngine::loadTasks() as $task) {
                $taskRoot = trim((string) ($task['projectRoot'] ?? ''));
                $resolvedTaskRoot = $taskRoot !== '' ? realpath($taskRoot) : false;
                if ($resolvedTaskRoot !== false && is_dir($resolvedTaskRoot)
                    && self::samePath($real, $resolvedTaskRoot)) {
                    $allowed = true;
                    break;
                }
            }
        }
        if (!$allowed) {
            throw new InvalidArgumentException('Project folder must be inside the configured projects area or belong to a KRA task.');
        }
        return $real;
    }

    public static function listDirectory(string $projectRoot, string $relativePath = ''): array
    {
        $root = self::resolveRoot($projectRoot);
        $relative = self::normalizeRelativePath($relativePath, true);
        if (self::isSensitivePath($relative)) {
            throw new InvalidArgumentException('This folder is hidden from the workspace because it may contain secrets.');
        }
        $directory = self::resolveInsideRoot($root, $relative, true);
        if (!is_dir($directory)) {
            throw new InvalidArgumentException('Selected workspace folder was not found.');
        }

        $entries = [];
        $items = @scandir($directory);
        if ($items === false) {
            throw new RuntimeException('Workspace folder cannot be read.');
        }
        foreach ($items as $name) {
            if ($name === '.' || $name === '..' || str_starts_with($name, '$')) continue;
            $full = $directory . DIRECTORY_SEPARATOR . $name;
            if (is_link($full) || self::isOmittedPath($name) || self::isSensitivePath($name)) continue;
            $isDirectory = is_dir($full);
            if (!$isDirectory && !is_file($full)) continue;
            $relativeEntry = $relative === '' ? $name : $relative . '/' . $name;
            $entries[] = [
                'name' => $name,
                'path' => $relativeEntry,
                'kind' => $isDirectory ? 'directory' : 'file',
                'size' => $isDirectory ? null : (int) @filesize($full),
                'modifiedAt' => (int) @filemtime($full),
            ];
            if (count($entries) >= self::MAX_DIRECTORY_ENTRIES) break;
        }
        usort($entries, static function (array $a, array $b): int {
            if ($a['kind'] !== $b['kind']) return $a['kind'] === 'directory' ? -1 : 1;
            return strnatcasecmp($a['name'], $b['name']);
        });
        return ['root' => $root, 'path' => $relative, 'entries' => $entries, 'truncated' => count($entries) >= self::MAX_DIRECTORY_ENTRIES];
    }

    public static function validateRelativeFilePath(string $relativePath): string
    {
        $relative = self::normalizeRelativePath($relativePath, false);
        if (self::isSensitivePath($relative)) {
            throw new InvalidArgumentException('This file is hidden from the workspace because it may contain secrets.');
        }
        return $relative;
    }

    public static function readFile(string $projectRoot, string $relativePath): array
    {
        $root = self::resolveRoot($projectRoot);
        return self::readFromResolvedRoot($root, $relativePath);
    }

    public static function previewTask(string $taskId): array
    {
        $tasks = KraTaskEngine::loadTasks();
        $task = $tasks[$taskId] ?? null;
        if (!is_array($task) || ($task['status'] ?? '') !== 'WAITING_APPROVAL') {
            throw new InvalidArgumentException('Approval proposal is no longer waiting for review.');
        }
        $relative = (string) ($task['targetFile'] ?? '');
        $projectRoot = trim((string) ($task['projectRoot'] ?? ''));
        $relative = self::normalizeRelativePath($relative, false);
        if (self::isSensitivePath($relative)) {
            throw new InvalidArgumentException('This file is hidden from workspace previews because it may contain secrets.');
        }
        if ($projectRoot === '') {
            // Legacy proposals can target KRA itself. Never read app files into the workspace preview.
            return [
                'ok' => true,
                'taskId' => $taskId,
                'targetFile' => $relative,
                'exists' => null,
                'workspaceAvailable' => false,
                'beforeContent' => '',
                'proposedContent' => (string) ($task['proposedContent'] ?? ''),
            ];
        }
        $root = self::resolveRoot($projectRoot);
        $target = self::resolveInsideRoot($root, $relative, false);
        $exists = is_file($target) && !is_link($target);
        $before = $exists ? self::readTextContents($target) : '';
        return [
            'ok' => true,
            'taskId' => $taskId,
            'targetFile' => $relative,
            'exists' => $exists,
            'workspaceAvailable' => true,
            'beforeContent' => $before,
            'proposedContent' => (string) ($task['proposedContent'] ?? ''),
        ];
    }

    private static function readFromResolvedRoot(string $root, string $relativePath): array
    {
        $relative = self::normalizeRelativePath($relativePath, false);
        if (self::isSensitivePath($relative)) {
            throw new InvalidArgumentException('This file is hidden from the workspace because it may contain secrets.');
        }
        $target = self::resolveInsideRoot($root, $relative, false);
        if (!is_file($target) || is_link($target)) {
            throw new InvalidArgumentException('Selected file was not found.');
        }
        return [
            'root' => $root,
            'path' => $relative,
            'content' => self::readTextContents($target),
            'size' => (int) @filesize($target),
            'modifiedAt' => (int) @filemtime($target),
            'readOnly' => true,
        ];
    }

    private static function readTextContents(string $path): string
    {
        $size = @filesize($path);
        if ($size === false || $size > self::MAX_FILE_BYTES) {
            throw new InvalidArgumentException('File exceeds the 256 KB workspace preview limit.');
        }
        $handle = @fopen($path, 'rb');
        if ($handle === false) throw new RuntimeException('File cannot be read.');
        try {
            $content = fread($handle, self::MAX_FILE_BYTES + 1);
        } finally {
            fclose($handle);
        }
        if ($content === false) throw new RuntimeException('File cannot be read.');
        if (strlen($content) > self::MAX_FILE_BYTES) {
            throw new InvalidArgumentException('File exceeds the 256 KB workspace preview limit.');
        }
        if (str_contains($content, "\0")) {
            throw new InvalidArgumentException('Binary files cannot be opened in the text workspace.');
        }
        if (preg_match('//u', $content) !== 1) {
            throw new InvalidArgumentException('File is not valid UTF-8 text and cannot be previewed.');
        }
        return $content;
    }

    private static function normalizeRelativePath(string $path, bool $allowEmpty): string
    {
        $path = trim(str_replace('\\', '/', $path));
        if ($path === '' && $allowEmpty) return '';
        if ($path === '' || str_starts_with($path, '/') || preg_match('/^[A-Za-z]:/', $path)
            || preg_match('/[\x00-\x1f\x7f]/', $path)) {
            throw new InvalidArgumentException('A safe relative workspace path is required.');
        }
        $segments = explode('/', $path);
        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..' || str_contains($segment, ':')) {
                throw new InvalidArgumentException('Workspace paths cannot contain empty, dot, or parent segments.');
            }
            if (self::isOmittedPath($segment)) {
                throw new InvalidArgumentException('This workspace path is excluded from browsing.');
            }
        }
        return implode('/', $segments);
    }

    private static function resolveInsideRoot(string $root, string $relative, bool $mustExist): string
    {
        if ($relative === '') return $root;
        $current = $root;
        foreach (explode('/', $relative) as $segment) {
            $current .= DIRECTORY_SEPARATOR . $segment;
            if (is_link($current)) {
                throw new InvalidArgumentException('Symbolic links are not opened in the workspace browser.');
            }
        }
        if ($mustExist && !file_exists($current)) {
            throw new InvalidArgumentException('Selected workspace path was not found.');
        }
        $real = realpath($current);
        if ($real === false) {
            if (!$mustExist && !file_exists($current)) return $current;
            throw new InvalidArgumentException('Unable to resolve workspace path.');
        }
        if (!self::samePath($real, $root) && !self::isWithin($root, $real)) {
            throw new InvalidArgumentException('Workspace path escapes the selected project.');
        }
        return $real;
    }

    private static function isSensitivePath(string $path): bool
    {
        $segments = explode('/', strtolower(str_replace('\\', '/', $path)));
        foreach ($segments as $segment) {
            if (str_starts_with($segment, '.env') || str_contains($segment, 'secret')
                || str_contains($segment, 'credential') || str_contains($segment, 'token')) return true;
            if (in_array($segment, ['id_rsa', 'id_ed25519', 'config.json'], true)) return true;
            if (preg_match('/\.(pem|key|p12|pfx|keystore)$/i', $segment)) return true;
        }
        return false;
    }

    private static function isOmittedPath(string $segment): bool
    {
        return in_array(strtolower($segment), self::OMIT_DIRS, true);
    }

    private static function samePath(string $a, string $b): bool
    {
        return DIRECTORY_SEPARATOR === '\\' ? strtolower($a) === strtolower($b) : $a === $b;
    }

    private static function isWithin(string $root, string $path): bool
    {
        $root = rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (DIRECTORY_SEPARATOR === '\\') {
            return str_starts_with(strtolower(rtrim($path, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR), strtolower($root));
        }
        return str_starts_with(rtrim($path, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR, $root);
    }
}
