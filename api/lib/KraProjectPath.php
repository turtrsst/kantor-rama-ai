<?php
declare(strict_types=1);

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

    public static function slug(string $name): string
    {
        $slug = strtolower($name);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');
        $slug = substr($slug, 0, 40);
        return $slug !== '' ? $slug : 'aplikasi-baru';
    }

    public static function suggest(string $name): string
    {
        return self::projectsRoot() . DIRECTORY_SEPARATOR . self::slug($name);
    }

    /**
     * Hard rules only. `warnings` are advisory (nothing is broken), `reasons`
     * always block execution.
     */
    public static function validate(string $candidate): array
    {
        $raw = trim($candidate);
        $normalized = str_replace('/', DIRECTORY_SEPARATOR, $raw);
        $result = [
            'ok' => false,
            'path' => rtrim($normalized, DIRECTORY_SEPARATOR),
            'reasons' => [],
            'warnings' => [],
            'insideKra' => false,
            'exists' => false,
            'writable' => false,
        ];

        if ($raw === '') {
            $result['reasons'][] = 'Path is empty.';
            return $result;
        }

        $isAbsolute = preg_match('#^[A-Za-z]:[\\\\/]#', $raw) === 1
            || preg_match('#^\\\\\\\\[^\\\\]+\\\\#', $raw) === 1;
        if (!$isAbsolute) {
            $result['reasons'][] = 'Path must be absolute, for example ' . self::projectsRoot() . '\\my-app.';
            return $result;
        }

        $segments = preg_split('#[\\\\/]+#', $normalized) ?: [];
        if (in_array('..', $segments, true)) {
            $result['reasons'][] = 'Path cannot contain ".." segments.';
            return $result;
        }

        $trimmed = rtrim($normalized, DIRECTORY_SEPARATOR);
        if (preg_match('#^[A-Za-z]:$#', $trimmed) === 1) {
            $result['reasons'][] = 'A drive root is not a valid project location.';
            return $result;
        }

        $leaf = strtolower(basename($trimmed));
        if (in_array($leaf, self::SYSTEM_DIRS, true)) {
            $result['reasons'][] = '"' . basename($trimmed) . '" is a protected system directory.';
            return $result;
        }

        $kraRoot = self::kraRoot();
        $lowerTarget = strtolower($trimmed) . DIRECTORY_SEPARATOR;
        $lowerKra = strtolower($kraRoot) . DIRECTORY_SEPARATOR;
        if (str_starts_with($lowerTarget, $lowerKra) || strtolower($trimmed) === strtolower($kraRoot)) {
            $result['insideKra'] = true;
            $result['reasons'][] = 'Project path must be outside the KRA folder (' . $kraRoot . ').';
            return $result;
        }

        $realParent = realpath(dirname($trimmed));
        if ($realParent !== false && str_starts_with(
            strtolower($realParent . DIRECTORY_SEPARATOR),
            $lowerKra
        )) {
            $result['insideKra'] = true;
            $result['reasons'][] = 'Project path must be outside the KRA folder (' . $kraRoot . ').';
            return $result;
        }

        $result['exists'] = is_dir($trimmed);
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
        $dir = trim($dir);
        if ($dir === '' || !is_dir($dir)) {
            $dir = self::projectsRoot();
        }
        $dir = rtrim(str_replace('/', DIRECTORY_SEPARATOR, $dir), DIRECTORY_SEPARATOR);

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
        if ($parent === $dir || $parent === '.' || $parent === '') {
            $parent = '';
        }

        return [
            'dir' => $dir,
            'parent' => $parent,
            'dirs' => $entries,
            'projectsRoot' => self::projectsRoot(),
        ];
    }
}
