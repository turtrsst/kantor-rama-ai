<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

/**
 * Project path gate.
 *
 * New applications must live outside the KRA repository so the workspace stays
 * a plain, self-contained project tree. This class owns the hard rule, the
 * default location, and the read-only directory browser used by the UI.
 */
final class KraProjectPath
{
    /** Directory names that are never valid project roots. */
    private const SYSTEM_DIRS = [
        'windows', 'program files', 'program files (x86)', 'programdata',
        'system32', 'syswow64', '$recycle.bin', 'recovery', 'perflogs',
        'system volume information',
    ];

    public static function kraRoot(): string
    {
        $root = realpath(dirname(__DIR__, 2));
        return $root !== false ? $root : dirname(__DIR__, 2);
    }

    /**
     * Where new projects go by default: the webserver document root that holds
     * KRA itself, so a new app is reachable at http://host/<slug> immediately.
     */
    public static function projectsRoot(): string
    {
        $env = getenv('KRA_PROJECTS_ROOT');
        if ($env !== false && trim($env) !== '' && is_dir($env)) {
            return rtrim($env, "\\/");
        }
        return dirname(self::kraRoot());
    }

    private static function comparePath(string $path): string
    {
        $path = str_replace('/', DIRECTORY_SEPARATOR, $path);
        return DIRECTORY_SEPARATOR === '\\' ? strtolower($path) : $path;
    }

    private static function pathWithin(string $candidate, string $root): bool
    {
        $candidate = rtrim(self::comparePath($candidate), DIRECTORY_SEPARATOR);
        $root = rtrim(self::comparePath($root), DIRECTORY_SEPARATOR);
        return $candidate === $root || str_starts_with($candidate . DIRECTORY_SEPARATOR, $root . DIRECTORY_SEPARATOR);
    }

    /** Per-workspace area under the configured projects root. Legacy owner keeps the historical root. */
    public static function workspaceProjectsRoot(?string $workspaceId = null, ?bool $legacyClaim = null): string
    {
        $workspaceId = trim((string) ($workspaceId ?? (KraTenantContext::hasWorkspace() ? KraTenantContext::workspaceId() : '')));
        $legacyClaim = $legacyClaim ?? KraTenantContext::canSeeLegacy();
        if ($workspaceId === '' || $workspaceId === KraTenantContext::LEGACY_WORKSPACE_ID || $legacyClaim) {
            return self::projectsRoot();
        }
        $safe = preg_replace('/[^A-Za-z0-9_-]/', '', $workspaceId) ?: 'workspace';
        return self::projectsRoot() . DIRECTORY_SEPARATOR . 'KRA Workspaces' . DIRECTORY_SEPARATOR . substr($safe, 0, 96);
    }

    public static function ensureWorkspaceProjectsRoot(?string $workspaceId = null): string
    {
        $root = self::workspaceProjectsRoot($workspaceId);
        if (!is_dir($root) && !@mkdir($root, 0777, true) && !is_dir($root)) {
            throw new RuntimeException('Folder proyek workspace tidak dapat dibuat: ' . $root);
        }
        return $root;
    }

    public static function slug(string $name): string
    {
        $slug = strtolower($name);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');
        $slug = substr($slug, 0, 40);
        return $slug !== '' ? $slug : 'aplikasi-baru';
    }

    public static function suggest(string $name, ?string $workspaceId = null): string
    {
        return self::workspaceProjectsRoot($workspaceId) . DIRECTORY_SEPARATOR . self::slug($name);
    }

    /**
     * Hard rules only. `warnings` are advisory (nothing is broken), `reasons`
     * always block execution.
     */
    public static function validateForWorkspace(string $candidate, string $workspaceId): array
    {
        return self::validate($candidate, $workspaceId, false);
    }

    public static function validate(string $candidate, ?string $workspaceId = null, ?bool $legacyClaim = null): array
    {
        $raw = trim($candidate);
        $normalized = str_replace('/', DIRECTORY_SEPARATOR, $raw);
        $effectiveWorkspaceId = trim((string) ($workspaceId ?? (KraTenantContext::hasWorkspace() ? KraTenantContext::workspaceId() : '')));
        $effectiveLegacy = $legacyClaim ?? KraTenantContext::canSeeLegacy();
        $workspaceRoot = self::workspaceProjectsRoot($effectiveWorkspaceId !== '' ? $effectiveWorkspaceId : null, $effectiveLegacy);
        $result = [
            'ok' => false,
            'path' => rtrim($normalized, DIRECTORY_SEPARATOR),
            'reasons' => [],
            'warnings' => [],
            'insideKra' => false,
            'exists' => false,
            'writable' => false,
            'workspaceId' => $effectiveWorkspaceId,
            'workspaceProjectsRoot' => $workspaceRoot,
            'deploymentMode' => KraTenantContext::deploymentMode(),
        ];

        if ($raw === '') {
            $result['reasons'][] = 'Path is empty.';
            return $result;
        }

        $isAbsolute = preg_match('#^[A-Za-z]:[\\\\/]#', $raw) === 1
            || preg_match('#^\\\\\\\\[^\\\\]+\\\\#', $raw) === 1
            || str_starts_with($raw, '/');
        if (!$isAbsolute) {
            $result['reasons'][] = 'Path must be absolute, for example ' . $workspaceRoot . DIRECTORY_SEPARATOR . 'my-app.';
            return $result;
        }

        $segments = preg_split('#[\\\\/]+#', $normalized) ?: [];
        if (in_array('..', $segments, true)) {
            $result['reasons'][] = 'Path cannot contain ".." segments.';
            return $result;
        }

        $trimmed = rtrim($normalized, DIRECTORY_SEPARATOR);
        if (preg_match('#^[A-Za-z]:$#', $trimmed) === 1 || $trimmed === '') {
            $result['reasons'][] = 'A drive/filesystem root is not a valid project location.';
            return $result;
        }

        $leaf = strtolower(basename($trimmed));
        $unixFirstSegment = DIRECTORY_SEPARATOR !== '\\' && str_starts_with($trimmed, DIRECTORY_SEPARATOR)
            ? strtolower((string) (($segments[1] ?? '') !== '' ? $segments[1] : ($segments[0] ?? '')))
            : '';
        if (in_array($leaf, self::SYSTEM_DIRS, true)
            || in_array($unixFirstSegment, ['etc', 'proc', 'sys', 'dev', 'root', 'boot'], true)) {
            $result['reasons'][] = '"' . basename($trimmed) . '" is in a protected system location.';
            return $result;
        }

        $kraRoot = self::kraRoot();
        if (self::pathWithin($trimmed, $kraRoot)) {
            $result['insideKra'] = true;
            $result['reasons'][] = 'Project path must be outside the KRA folder (' . $kraRoot . ').';
            return $result;
        }

        $realParent = realpath(dirname($trimmed));
        if ($realParent !== false && self::pathWithin($realParent, $kraRoot)) {
            $result['insideKra'] = true;
            $result['reasons'][] = 'Project path must be outside the KRA folder (' . $kraRoot . ').';
            return $result;
        }

        if (KraTenantContext::isHosted()) {
            $canonicalCandidate = $trimmed;
            if ($realParent !== false) $canonicalCandidate = $realParent . DIRECTORY_SEPARATOR . basename($trimmed);
            $canonicalWorkspaceRoot = realpath($workspaceRoot) ?: $workspaceRoot;
            if (!self::pathWithin($canonicalCandidate, $canonicalWorkspaceRoot)
                || self::comparePath(rtrim($canonicalCandidate, DIRECTORY_SEPARATOR)) === self::comparePath(rtrim($canonicalWorkspaceRoot, DIRECTORY_SEPARATOR))) {
                $result['reasons'][] = 'In hosted mode, a project must be inside its own workspace projects area (' . $workspaceRoot . ').';
                return $result;
            }
        }

        $result['exists'] = is_dir($trimmed);
        if ($result['exists']) {
            $realTarget = realpath($trimmed);
            if ($realTarget === false) {
                $result['reasons'][] = 'Unable to resolve the target directory safely.';
                return $result;
            }
            if (self::pathWithin($realTarget, $kraRoot)) {
                $result['insideKra'] = true;
                $result['reasons'][] = 'Resolved project path points inside the KRA folder.';
                return $result;
            }
            if (KraTenantContext::isHosted() && !self::pathWithin($realTarget, realpath($workspaceRoot) ?: $workspaceRoot)) {
                $result['reasons'][] = 'Resolved project path escapes its workspace projects area.';
                return $result;
            }
        }
        $checkTarget = $result['exists'] ? $trimmed : ($realParent !== false ? $realParent : '');
        $result['writable'] = $checkTarget !== '' && is_writable($checkTarget);
        if (!$result['writable']) {
            $result['warnings'][] = 'Target location is not writable by the web server user.';
        }
        if (!$result['exists']) {
            $result['warnings'][] = 'Folder does not exist yet; KRA will create it on approval.';
        }

        $result['ok'] = true;
        return $result;
    }

    /**
     * Read-only directory listing for the path picker.
     */
    public static function browse(string $dir, int $limit = 200): array
    {
        $configuredRoot = self::workspaceProjectsRoot();
        $root = realpath($configuredRoot) ?: $configuredRoot;
        $dir = trim($dir);
        if ($dir === '' || !is_dir($dir)) $dir = $root;
        $dir = realpath(str_replace('/', DIRECTORY_SEPARATOR, $dir)) ?: $root;
        if (!self::pathWithin($dir, $root)) $dir = $root;

        $limit = max(1, min(200, $limit));
        $entries = [];
        if (is_dir($dir)) {
            $handle = @opendir($dir);
            if ($handle !== false) {
                while (($item = readdir($handle)) !== false) {
                    if ($item === '.' || $item === '..') {
                        continue;
                    }
                    $full = $dir . DIRECTORY_SEPARATOR . $item;
                    if (!is_dir($full)) {
                        continue;
                    }
                    if (str_starts_with($item, '.') || str_starts_with($item, '$')) {
                        continue;
                    }
                    $entries[] = $item;
                    if (count($entries) >= $limit) {
                        break;
                    }
                }
                closedir($handle);
            }
        }
        sort($entries, SORT_NATURAL | SORT_FLAG_CASE);

        $parent = dirname($dir);
        if ($parent === $dir || $parent === '.' || $parent === '' || !self::pathWithin($parent, $root)) {
            $parent = '';
        }

        return [
            'dir' => $dir,
            'parent' => $parent,
            'dirs' => $entries,
            'projectsRoot' => $root,
            'workspaceProjectsRoot' => $root,
        ];
    }
}
