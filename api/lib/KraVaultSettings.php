<?php
declare(strict_types=1);

/** Local, server-side selection and read-only browsing for the Obsidian vault. */
final class KraVaultSettings
{
    private static function settingsFile(): string
    {
        $custom = trim((string) (getenv('KRA_SETTINGS_DIR') ?: ''));
        $projectRoot = dirname(__DIR__, 2);
        $root = $custom !== '' ? $custom : $projectRoot . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'private-settings';
        if (!is_dir($root) && !@mkdir($root, 0700, true) && !is_dir($root)) {
            throw new RuntimeException('KRA could not create its private local settings directory.');
        }
        return rtrim($root, "\\/") . DIRECTORY_SEPARATOR . 'obsidian-vault.php';
    }

    public static function selectedPath(): string
    {
        try {
            $file = self::settingsFile();
            if (!is_file($file)) return '';
            $contents = (string) @file_get_contents($file);
            $marker = "__halt_compiler();\n";
            $offset = strpos($contents, $marker);
            if ($offset === false) return '';
            $data = json_decode(substr($contents, $offset + strlen($marker)), true);
            return is_array($data) ? trim((string) ($data['path'] ?? '')) : '';
        } catch (Throwable) {
            return '';
        }
    }

    public static function save(string $candidate): array
    {
        $candidate = trim($candidate);
        if ($candidate === '' || str_contains($candidate, "\0")) {
            throw new InvalidArgumentException('Choose an existing vault folder.');
        }
        $resolved = realpath($candidate);
        if ($resolved === false || !is_dir($resolved)) {
            throw new InvalidArgumentException('That folder does not exist on the KRA server.');
        }
        if (!is_writable($resolved)) {
            throw new InvalidArgumentException('The KRA web-server account cannot write to that folder.');
        }
        $file = self::settingsFile();
        $json = json_encode(['path' => $resolved, 'updatedAt' => gmdate(DATE_ATOM)], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        // PHP execution prevents direct HTTP requests from exposing this local path
        // even if Apache's rewrite protections are not enabled.
        $contents = "<?php http_response_code(404); exit; __halt_compiler();\n" . $json . PHP_EOL;
        if ($json === false || @file_put_contents($file, $contents, LOCK_EX) === false) {
            throw new RuntimeException('KRA could not save the vault selection. Check its local settings-folder permissions.');
        }
        @chmod($file, 0600);
        return self::describe($resolved, 'selected');
    }

    public static function current(): array
    {
        $selected = self::selectedPath();
        if ($selected !== '') return self::describe($selected, 'selected');
        $env = trim((string) (getenv('KRA_MEMORY_ROOT') ?: ''));
        if ($env !== '') return self::describe($env, 'environment');
        $fallback = 'D:' . DIRECTORY_SEPARATOR . 'vault' . DIRECTORY_SEPARATOR . 'KRA';
        if (is_dir($fallback)) return self::describe($fallback, 'default');
        return self::describe('', 'unset');
    }

    private static function describe(string $path, string $source): array
    {
        $exists = $path !== '' && is_dir($path);
        $real = $exists ? (realpath($path) ?: $path) : $path;
        return [
            'path' => $real,
            'source' => $source,
            'exists' => $exists,
            'writable' => $exists && is_writable($real),
            'isObsidianVault' => $exists && is_dir($real . DIRECTORY_SEPARATOR . '.obsidian'),
        ];
    }

    /** List roots or immediate child directories only. Never returns file contents. */
    public static function browse(string $requestedPath = ''): array
    {
        $requestedPath = trim($requestedPath);
        if ($requestedPath === '') {
            return ['path' => '', 'parent' => '', 'roots' => self::roots(), 'dirs' => []];
        }
        if (str_contains($requestedPath, "\0")) throw new InvalidArgumentException('Folder path is invalid.');
        $path = realpath($requestedPath);
        if ($path === false || !is_dir($path)) throw new InvalidArgumentException('That server folder cannot be opened.');

        $dirs = [];
        $handle = @opendir($path);
        if ($handle !== false) {
            while (($name = readdir($handle)) !== false) {
                if ($name === '.' || $name === '..' || str_starts_with($name, '.')) continue;
                $full = $path . DIRECTORY_SEPARATOR . $name;
                if (!is_dir($full)) continue;
                $dirs[] = ['name' => $name, 'path' => (realpath($full) ?: $full)];
                if (count($dirs) >= 250) break;
            }
            closedir($handle);
        }
        usort($dirs, static fn(array $a, array $b): int => strnatcasecmp($a['name'], $b['name']));
        $parent = dirname($path);
        if ($parent === $path || preg_match('/^[A-Za-z]:[\\\\\/]?$/', $path) === 1) $parent = '';
        return ['path' => $path, 'parent' => $parent, 'roots' => [], 'dirs' => $dirs, 'writable' => is_writable($path)];
    }

    private static function roots(): array
    {
        $roots = [];
        if (PHP_OS_FAMILY === 'Windows') {
            foreach (range('A', 'Z') as $letter) {
                $path = $letter . ':' . DIRECTORY_SEPARATOR;
                if (is_dir($path)) $roots[] = ['name' => $letter . ':', 'path' => $path];
            }
        } else {
            $roots[] = ['name' => DIRECTORY_SEPARATOR, 'path' => DIRECTORY_SEPARATOR];
            $home = trim((string) (getenv('HOME') ?: ''));
            if ($home !== '' && is_dir($home)) $roots[] = ['name' => 'Home', 'path' => realpath($home) ?: $home];
        }
        return $roots;
    }
}
