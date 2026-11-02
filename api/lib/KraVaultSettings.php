<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

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

    private static function readData(): array
    {
        try {
            $file = self::settingsFile();
            if (!is_file($file)) return [];
            $contents = (string) @file_get_contents($file);
            $marker = "__halt_compiler();\n";
            $offset = strpos($contents, $marker);
            if ($offset === false) return [];
            $data = json_decode(substr($contents, $offset + strlen($marker)), true);
            return is_array($data) ? $data : [];
        } catch (Throwable) {
            return [];
        }
    }

    private static function writeData(array $data): void
    {
        $file = self::settingsFile();
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        // PHP execution prevents direct HTTP requests from exposing this local path
        // even if Apache's rewrite protections are not enabled.
        $contents = "<?php http_response_code(404); exit; __halt_compiler();\n" . $json . PHP_EOL;
        if ($json === false || @file_put_contents($file, $contents, LOCK_EX) === false) {
            throw new RuntimeException('KRA could not save the vault selection. Check its local settings-folder permissions.');
        }
        @chmod($file, 0600);
    }

    private static function workspaceId(): string
    {
        return KraTenantContext::hasWorkspace() ? KraTenantContext::workspaceId() : '';
    }

    public static function migrateLegacyToWorkspace(string $workspaceId): void
    {
        $workspaceId = trim($workspaceId);
        if ($workspaceId === '') return;
        try {
            $data = self::readData();
            $changed = false;
            if (($data['legacyWorkspaceId'] ?? '') !== $workspaceId) {
                $data['legacyWorkspaceId'] = $workspaceId;
                $changed = true;
            }
            if (!is_array($data['workspaces'] ?? null)) $data['workspaces'] = [];
            if (!isset($data['workspaces'][$workspaceId]['path']) && trim((string) ($data['path'] ?? '')) !== '') {
                $data['workspaces'][$workspaceId] = ['path' => (string) $data['path'], 'updatedAt' => (string) ($data['updatedAt'] ?? gmdate(DATE_ATOM))];
                $changed = true;
            }
            if ($changed) self::writeData($data);
        } catch (Throwable $e) {
            error_log('[KraVaultSettings] legacy migration failed: ' . $e->getMessage());
        }
    }

    public static function selectedPath(?string $workspaceId = null): string
    {
        $data = self::readData();
        $workspaceId = $workspaceId ?? self::workspaceId();
        if ($workspaceId !== '') {
            $own = trim((string) ($data['workspaces'][$workspaceId]['path'] ?? ''));
            if ($own !== '') return $own;
            $isLegacy = (string) ($data['legacyWorkspaceId'] ?? '') === $workspaceId
                || ($workspaceId === self::workspaceId() && KraTenantContext::canUseLegacyIntegrations());
            return $isLegacy ? trim((string) ($data['path'] ?? '')) : '';
        }
        return trim((string) ($data['path'] ?? ''));
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
        if (KraTenantContext::isHosted() && !KraTenantContext::isPlatformAdmin(KraTenantContext::user())) {
            self::assertHostedBrowseAllowed($resolved);
        }
        if (!is_writable($resolved)) {
            throw new InvalidArgumentException('The KRA web-server account cannot write to that folder.');
        }
        $data = self::readData();
        $workspaceId = self::workspaceId();
        if ($workspaceId !== '') {
            if (!is_array($data['workspaces'] ?? null)) $data['workspaces'] = [];
            $data['workspaces'][$workspaceId] = ['path' => $resolved, 'updatedAt' => gmdate(DATE_ATOM)];
            if (KraTenantContext::canUseLegacyIntegrations() && !isset($data['legacyWorkspaceId'])) $data['legacyWorkspaceId'] = $workspaceId;
        } else {
            $data['path'] = $resolved;
            $data['updatedAt'] = gmdate(DATE_ATOM);
        }
        self::writeData($data);
        return self::describe($resolved, 'selected');
    }

    public static function current(): array
    {
        $selected = self::selectedPath();
        if ($selected !== '') return self::describe($selected, 'selected');
        $env = trim((string) (getenv('KRA_MEMORY_ROOT') ?: ''));
        $envApplies = self::workspaceId() === '' || KraTenantContext::canUseLegacyIntegrations() || !KraTenantContext::isHosted();
        if ($env !== '' && $envApplies) return self::describe($env, 'environment');
        $fallback = DIRECTORY_SEPARATOR === '\\' ? 'D:' . DIRECTORY_SEPARATOR . 'vault' . DIRECTORY_SEPARATOR . 'KRA' : '';
        if ($fallback !== '' && $envApplies && is_dir($fallback)) return self::describe($fallback, 'default');
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
            'workspaceId' => self::workspaceId(),
        ];
    }

    private static function hostedBrowseRoot(): string
    {
        $configured = trim((string) (getenv('KRA_VAULT_BROWSE_ROOT') ?: ''));
        if ($configured !== '' && is_dir($configured)) return realpath($configured) ?: $configured;
        if (class_exists('KraProjectPath')) return KraProjectPath::workspaceProjectsRoot();
        return '';
    }

    private static function assertHostedBrowseAllowed(string $path): void
    {
        if (!KraTenantContext::isHosted() || KraTenantContext::isPlatformAdmin(KraTenantContext::user())) return;
        $root = self::hostedBrowseRoot();
        $realRoot = $root !== '' ? (realpath($root) ?: $root) : '';
        $cmp = static fn(string $p): string => DIRECTORY_SEPARATOR === '\\' ? strtolower(rtrim($p, DIRECTORY_SEPARATOR)) : rtrim($p, DIRECTORY_SEPARATOR);
        if ($realRoot === '' || !($cmp($path) === $cmp($realRoot) || str_starts_with($cmp($path) . DIRECTORY_SEPARATOR, $cmp($realRoot) . DIRECTORY_SEPARATOR))) {
            throw new InvalidArgumentException('In hosted mode, a workspace vault must be inside its approved server area. Ask the platform admin to configure KRA_VAULT_BROWSE_ROOT or choose a folder under the workspace projects area.');
        }
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
        self::assertHostedBrowseAllowed($path);

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
        if ($parent !== '') {
            try { self::assertHostedBrowseAllowed($parent); } catch (Throwable) { $parent = ''; }
        }
        return ['path' => $path, 'parent' => $parent, 'roots' => [], 'dirs' => $dirs, 'writable' => is_writable($path), 'workspaceId' => self::workspaceId()];
    }

    private static function roots(): array
    {
        if (KraTenantContext::isHosted() && !KraTenantContext::isPlatformAdmin(KraTenantContext::user())) {
            $root = self::hostedBrowseRoot();
            return $root !== '' && is_dir($root) ? [['name' => 'Workspace area', 'path' => realpath($root) ?: $root]] : [];
        }
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
