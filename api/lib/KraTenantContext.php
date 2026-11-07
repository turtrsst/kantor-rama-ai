<?php
declare(strict_types=1);

/**
 * Request-local tenant context.
 *
 * PHP handles one HTTP request in one process, so a small static context is
 * the least invasive way to make the existing static engines workspace-aware
 * without rewriting every method signature. The API boundary sets this after
 * authentication; CLI/internal calls without a user keep the legacy scope.
 */
final class KraTenantContext
{
    public const LEGACY_WORKSPACE_ID = 'legacy';

    private static ?array $user = null;
    private static ?array $workspace = null;
    private static ?array $entitlement = null;
    private static bool $systemAccess = false;

    public static function clear(): void
    {
        self::$user = null;
        self::$workspace = null;
        self::$entitlement = null;
        self::$systemAccess = false;
    }

    public static function setUser(?array $user): void
    {
        self::$user = $user;
    }

    public static function user(): ?array
    {
        return self::$user;
    }

    public static function userId(): string
    {
        return trim((string) (self::$user['id'] ?? ''));
    }

    public static function isApiKeyAuth(?array $user = null): bool
    {
        if (func_num_args() === 0) $user = self::$user;
        return is_array($user) && (string) ($user['authType'] ?? '') === 'api_key';
    }

    public static function apiKeyScopes(): array
    {
        if (!self::isApiKeyAuth()) return [];
        return array_values(array_map('strval', (array) (self::$user['apiKeyScopes'] ?? [])));
    }

    public static function setWorkspace(?array $workspace): void
    {
        self::$workspace = $workspace;
        self::$entitlement = null;
    }

    public static function workspace(): ?array
    {
        return self::$workspace;
    }

    public static function workspaceId(): string
    {
        $id = trim((string) (self::$workspace['id'] ?? ''));
        return $id !== '' ? $id : self::LEGACY_WORKSPACE_ID;
    }

    public static function hasWorkspace(): bool
    {
        return trim((string) (self::$workspace['id'] ?? '')) !== '';
    }

    public static function workspaceOwnerId(): string
    {
        $owner = trim((string) (self::$workspace['ownerUserId'] ?? self::$workspace['owner_user_id'] ?? ''));
        return $owner !== '' ? $owner : self::userId();
    }

    public static function memberRole(): string
    {
        $role = strtolower(trim((string) (self::$workspace['memberRole'] ?? self::$workspace['member_role'] ?? '')));
        if ($role !== '') return $role;
        if (self::$workspace !== null && self::userId() !== '' && self::workspaceOwnerId() === self::userId()) return 'owner';
        return '';
    }

    public static function isWorkspaceAdmin(): bool
    {
        if (self::isPlatformAdmin(self::$user)) return true;
        return in_array(self::memberRole(), ['owner', 'admin'], true);
    }

    public static function isWorkspaceMember(): bool
    {
        if (self::isPlatformAdmin(self::$user)) return true;
        return in_array(self::memberRole(), ['owner', 'admin', 'member', 'viewer'], true);
    }

    public static function setEntitlement(?array $entitlement): void
    {
        self::$entitlement = $entitlement;
    }

    public static function entitlement(): ?array
    {
        return self::$entitlement;
    }

    public static function setSystemAccess(bool $allowed): void
    {
        self::$systemAccess = $allowed;
    }

    public static function hasSystemAccess(): bool
    {
        return self::$systemAccess;
    }

    /** Exact SIAS platform-admin roles; generic supervisors do not bypass billing. */
    public static function isPlatformAdmin(?array $user = null): bool
    {
        // Route helpers may omit the argument to mean "the authenticated user
        // on this request". An explicit null still means no user -> false.
        if (func_num_args() === 0) $user = self::$user;
        if (!is_array($user)) return false;
        // A delegated KRA API key is never a platform-admin credential, even
        // when an exact SIAS admin created it. Interactive SIAS sessions keep
        // the platform-admin bypass; API keys stay workspace/scope-bound.
        if (self::isApiKeyAuth($user)) return false;
        $role = strtolower(trim((string) ($user['role'] ?? '')));
        $role = str_replace(['_', '-'], ' ', $role);
        $role = preg_replace('/\s+/', ' ', $role) ?: '';
        return in_array($role, ['admin', 'administrator', 'superadmin', 'super admin'], true);
    }

    /** Broad operational role used only for non-billing legacy decisions. */
    public static function isSupervisor(?array $user): bool
    {
        if (self::isApiKeyAuth($user)) return false;
        if (self::isPlatformAdmin($user)) return true;
        $role = strtolower(trim((string) ($user['role'] ?? '')));
        return preg_match('/(^|[^a-z])(supervisor|boss|owner)([^a-z]|$)/', $role) === 1;
    }

    public static function deploymentMode(): string
    {
        $mode = strtolower(trim((string) (getenv('KRA_DEPLOYMENT_MODE') ?: '')));
        if ($mode === 'hosted' || $mode === 'local') {
            return $mode;
        }
        // No explicit mode: infer it. A deployment reached over a public host
        // must never inherit the local-first escape hatches (filesystem browse
        // anywhere, admin-only shortcuts, unmetered paths).
        return self::looksPublic() ? 'hosted' : 'local';
    }

    /**
     * True when the request arrived on a hostname that is not loopback or a
     * private/LAN address. Used only to pick the safe default deployment mode.
     */
    private static function looksPublic(): bool
    {
        $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
        $host = preg_replace('#:\d+$#', '', $host) ?? '';
        if ($host === '') return false;
        if (in_array($host, ['localhost', '127.0.0.1', '::1', '[::1]'], true)) return false;
        if (str_ends_with($host, '.local') || str_ends_with($host, '.localhost')) return false;
        // IPv4 private ranges and Tailscale CGNAT (100.64.0.0/10).
        if (preg_match('#^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$#', $host, $m) === 1) {
            $a = (int) $m[1]; $b = (int) $m[2];
            if ($a === 10 || $a === 127) return false;
            if ($a === 192 && $b === 168) return false;
            if ($a === 172 && $b >= 16 && $b <= 31) return false;
            if ($a === 100 && $b >= 64 && $b <= 127) return false; // Tailscale
            if ($a === 169 && $b === 254) return false;
        }
        return true;
    }

    public static function isHosted(): bool
    {
        return self::deploymentMode() === 'hosted';
    }

    /**
     * Legacy rows created before workspace columns existed belong to the
     * platform admin's default workspace. KraWorkspaces marks that one
     * workspace with legacyClaim=true; nobody else may see legacy data.
     */
    public static function canSeeLegacy(): bool
    {
        if (self::$user === null && self::$workspace === null) return true; // CLI/internal legacy calls
        return !empty(self::$workspace['legacyClaim']);
    }

    public static function canUseLegacyIntegrations(): bool
    {
        return self::canSeeLegacy();
    }

    public static function scopeKey(): string
    {
        $id = preg_replace('/[^A-Za-z0-9_-]/', '', self::workspaceId()) ?: self::LEGACY_WORKSPACE_ID;
        return substr($id, 0, 96);
    }

    /** Whether a stored row belongs in the current workspace view. */
    public static function rowVisible(array $row): bool
    {
        if (self::$systemAccess) return true;
        if (self::$user === null && self::$workspace === null) return true;
        $rowWorkspace = trim((string) ($row['workspaceId'] ?? $row['workspace_id'] ?? ''));
        if ($rowWorkspace === '' || $rowWorkspace === self::LEGACY_WORKSPACE_ID) {
            return self::canSeeLegacy();
        }
        return hash_equals(self::workspaceId(), $rowWorkspace);
    }
}
