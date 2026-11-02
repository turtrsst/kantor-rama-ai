<?php
declare(strict_types=1);

require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraTenantContext.php';
require_once __DIR__ . '/KraEntitlements.php';

/**
 * Workspace-bound KRA API keys for paying subscribers.
 *
 * The plaintext key is returned exactly once at creation/rotation. Only its
 * SHA-256 hash, display prefix, last four characters, scopes, and lifecycle
 * metadata are persisted. A key authenticates as its creator inside one
 * workspace, but it is deliberately not a SIAS session and never inherits
 * platform-admin authority (see KraTenantContext::isPlatformAdmin()).
 */
final class KraApiKeys
{
    public const FEATURE = 'kra_api_access';

    private const SCOPES = ['read', 'chat', 'tasks', 'workflows', 'memory', 'creator'];

    public static function availableScopes(): array
    {
        return self::SCOPES;
    }

    public static function looksLikeKey(string $value): bool
    {
        return preg_match('/^kra_(?:live|test)_[A-Za-z0-9_-]{32,128}$/', trim($value)) === 1;
    }

    public static function hashKey(string $rawKey): string
    {
        return hash('sha256', trim($rawKey));
    }

    /** Generate a 256-bit key plus the only values safe to persist/display. */
    public static function generateSecret(): array
    {
        $encoded = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $raw = 'kra_live_' . $encoded;
        return [
            'raw' => $raw,
            'prefix' => substr($raw, 0, 17),
            'last4' => substr($raw, -4),
            'hash' => self::hashKey($raw),
        ];
    }

    public static function normalizeScopes(mixed $scopes): array
    {
        if (is_string($scopes)) {
            $scopes = preg_split('/[\s,]+/', $scopes) ?: [];
        }
        if (!is_array($scopes)) {
            throw new InvalidArgumentException('Scope KRA API Key tidak valid.');
        }
        $wanted = [];
        foreach ($scopes as $scope) {
            $scope = strtolower(trim((string) $scope));
            if ($scope === '') continue;
            if (!in_array($scope, self::SCOPES, true)) {
                throw new InvalidArgumentException('Scope KRA API Key tidak dikenal: ' . $scope . '.');
            }
            $wanted[$scope] = true;
        }
        $normalized = array_values(array_filter(self::SCOPES, static fn(string $scope): bool => isset($wanted[$scope])));
        if ($normalized === []) {
            throw new InvalidArgumentException('Pilih minimal satu scope untuk KRA API Key.');
        }
        return $normalized;
    }

    /**
     * Paid-access rule for both issuing and using a key. A free PRO trial is
     * intentionally not enough: the workspace owner needs an active paid
     * subscription, a valid paid offline license, or exact SIAS admin access.
     */
    public static function paidAccessError(?array $entitlement): ?string
    {
        if (!is_array($entitlement)) {
            return 'KRA API Key hanya tersedia untuk workspace dengan paket berbayar aktif.';
        }
        $source = strtolower(trim((string) ($entitlement['source'] ?? '')));
        if ($source === 'sias_admin') return null;

        $plan = KraEntitlements::normalizePlan((string) ($entitlement['plan'] ?? 'free'));
        $features = array_map('strval', (array) ($entitlement['features'] ?? []));
        if ($plan === 'free' || empty($entitlement['active']) || !in_array(self::FEATURE, $features, true)) {
            return 'KRA API Key hanya tersedia untuk pemilik workspace dengan PRO/PLUS/PLATINUM aktif atau lisensi offline berbayar yang valid.';
        }
        if ($source === 'subscription' && strtolower(trim((string) ($entitlement['status'] ?? ''))) === 'trialing') {
            return 'Trial PRO gratis belum dapat membuat atau memakai KRA API Key. Aktifkan paket berbayar terlebih dahulu.';
        }
        return null;
    }

    public static function assertPaidAccess(?array $entitlement = null): array
    {
        $entitlement = $entitlement ?? KraEntitlements::forCurrentContext();
        $error = self::paidAccessError($entitlement);
        if ($error !== null) throw new DomainException($error);
        return $entitlement;
    }

    public static function isUsableRow(array $row, ?int $now = null): bool
    {
        return !empty(self::publicRow($row, $now)['usable']);
    }

    /** Public representation: never includes the hash or plaintext secret. */
    public static function publicRow(array $row, ?int $now = null): array
    {
        $now = $now ?? time();
        $status = strtolower(trim((string) ($row['status'] ?? 'revoked')));
        $expiresAt = $row['expires_at'] ?? $row['expiresAt'] ?? null;
        $expiresTs = self::timestamp($expiresAt);
        $expired = $status === 'active' && $expiresTs !== null && $expiresTs <= $now;
        if ($expired) $status = 'expired';

        $scopes = $row['scopes'] ?? [];
        if (is_string($scopes)) {
            $decoded = json_decode($scopes, true);
            $scopes = is_array($decoded) ? $decoded : [];
        }
        try {
            $scopes = self::normalizeScopes($scopes);
        } catch (Throwable) {
            $scopes = [];
        }

        return [
            'id' => (string) ($row['id'] ?? ''),
            'workspaceId' => (string) ($row['workspace_id'] ?? $row['workspaceId'] ?? ''),
            'ownerUserId' => (string) ($row['owner_user_id'] ?? $row['ownerUserId'] ?? ''),
            'createdByUserId' => (string) ($row['created_by_user_id'] ?? $row['createdByUserId'] ?? ''),
            'createdByUsername' => (string) ($row['created_by_username'] ?? $row['createdByUsername'] ?? ''),
            'name' => (string) ($row['name'] ?? 'KRA API Key'),
            'prefix' => (string) ($row['key_prefix'] ?? $row['prefix'] ?? 'kra_live_'),
            'last4' => (string) ($row['key_last4'] ?? $row['last4'] ?? ''),
            'scopes' => $scopes,
            'status' => $status,
            'usable' => $status === 'active',
            'expiresAt' => $expiresAt,
            'lastUsedAt' => $row['last_used_at'] ?? $row['lastUsedAt'] ?? null,
            'lastUsedIp' => (string) ($row['last_used_ip'] ?? $row['lastUsedIp'] ?? ''),
            'revokedAt' => $row['revoked_at'] ?? $row['revokedAt'] ?? null,
            'createdAt' => $row['created_at'] ?? $row['createdAt'] ?? null,
            'updatedAt' => $row['updated_at'] ?? $row['updatedAt'] ?? null,
        ];
    }

    public static function listForWorkspace(array $workspace): array
    {
        $db = self::database();
        $stmt = $db->prepare('SELECT k.*, u.username AS created_by_username
            FROM kra_api_keys k
            LEFT JOIN kra_users u ON u.id = k.created_by_user_id
            WHERE k.workspace_id = :workspace
            ORDER BY FIELD(k.status, "active", "revoked"), k.created_at DESC');
        $stmt->execute([':workspace' => self::workspaceId($workspace)]);
        return array_map(static fn(array $row): array => self::publicRow($row), $stmt->fetchAll());
    }

    public static function publicById(array $workspace, string $keyId): ?array
    {
        $row = self::rowById(self::database(), self::workspaceId($workspace), $keyId);
        return $row === null ? null : self::publicRow($row);
    }

    public static function activeCount(array $workspace): int
    {
        $db = self::database();
        $stmt = $db->prepare('SELECT COUNT(*) FROM kra_api_keys
            WHERE workspace_id = :workspace AND status = "active"
              AND (expires_at IS NULL OR expires_at > NOW())');
        $stmt->execute([':workspace' => self::workspaceId($workspace)]);
        return (int) $stmt->fetchColumn();
    }

    public static function summary(array $workspace, ?array $entitlement = null): array
    {
        $entitlement = $entitlement ?? KraEntitlements::forCurrentContext();
        $activeCount = self::activeCount($workspace);
        $limit = KraEntitlements::limit('apiKeys', $entitlement);
        $paidAccessError = self::paidAccessError($entitlement);
        $blockedReason = $paidAccessError;
        if ($blockedReason === null && $limit !== null && $activeCount >= $limit) {
            $blockedReason = 'Batas KRA API Key aktif untuk paket ini sudah tercapai (' . $limit . '). Revoke key lama atau upgrade paket.';
        }
        return [
            'activeCount' => $activeCount,
            'limit' => $limit,
            'paidAccess' => $paidAccessError === null,
            'canGenerate' => $blockedReason === null,
            'blockedReason' => $blockedReason,
            'availableScopes' => self::SCOPES,
            'plan' => (string) ($entitlement['plan'] ?? 'free'),
            'planName' => (string) ($entitlement['planName'] ?? 'KRA OFFICE'),
        ];
    }

    public static function create(array $workspace, array $actor, string $name, mixed $scopes, ?int $expiresInDays = 90): array
    {
        self::assertPaidAccess();
        $expiresAt = self::expiresAtFromDays($expiresInDays);
        $db = self::database();
        KraEntitlements::assertUnderLimit('apiKeys', self::activeCount($workspace), 'KRA API Key aktif');
        $created = self::insertNew($db, $workspace, $actor, $name, self::normalizeScopes($scopes), $expiresAt);
        return [
            'apiKey' => (string) $created['raw'],
            'key' => self::publicRow((array) $created['row']),
        ];
    }

    public static function revoke(array $workspace, array $actor, string $keyId): array
    {
        $db = self::database();
        $workspaceId = self::workspaceId($workspace);
        $row = self::rowById($db, $workspaceId, $keyId);
        if ($row === null) throw new DomainException('KRA API Key tidak ditemukan pada workspace aktif.');
        if (strtolower((string) ($row['status'] ?? '')) === 'active') {
            $db->prepare('UPDATE kra_api_keys
                SET status = "revoked", revoked_at = NOW(), revoked_by_user_id = :actor
                WHERE workspace_id = :workspace AND id = :id')
                ->execute([
                    ':actor' => self::actorId($actor),
                    ':workspace' => $workspaceId,
                    ':id' => (string) $row['id'],
                ]);
            $row = self::rowById($db, $workspaceId, $keyId) ?? $row;
        }
        return self::publicRow($row);
    }

    /** Replace a usable key atomically; the new plaintext is shown once. */
    public static function rotate(array $workspace, array $actor, string $keyId): array
    {
        self::assertPaidAccess();
        $db = self::database();
        $workspaceId = self::workspaceId($workspace);
        $old = self::rowById($db, $workspaceId, $keyId);
        if ($old === null) throw new DomainException('KRA API Key tidak ditemukan pada workspace aktif.');
        if (!self::isUsableRow($old)) throw new DomainException('Hanya KRA API Key aktif yang dapat di-rotate.');

        KraEntitlements::assertUnderLimit('apiKeys', max(0, self::activeCount($workspace) - 1), 'KRA API Key aktif');
        $ownTransaction = !$db->inTransaction();
        if ($ownTransaction) $db->beginTransaction();
        try {
            $created = self::insertNew(
                $db,
                $workspace,
                $actor,
                (string) ($old['name'] ?? 'KRA API Key'),
                self::publicRow($old)['scopes'],
                isset($old['expires_at']) && $old['expires_at'] !== null ? (string) $old['expires_at'] : null
            );
            $db->prepare('UPDATE kra_api_keys
                SET status = "revoked", revoked_at = NOW(), revoked_by_user_id = :actor
                WHERE workspace_id = :workspace AND id = :id')
                ->execute([
                    ':actor' => self::actorId($actor),
                    ':workspace' => $workspaceId,
                    ':id' => (string) $old['id'],
                ]);
            if ($ownTransaction) $db->commit();
        } catch (Throwable $e) {
            if ($ownTransaction && $db->inTransaction()) $db->rollBack();
            throw $e;
        }

        return [
            'apiKey' => (string) $created['raw'],
            'key' => self::publicRow((array) $created['row']),
            'replacedKeyId' => (string) $old['id'],
        ];
    }

    /**
     * Resolve a plaintext key to a creator principal. Entitlement, workspace
     * membership, and endpoint scope are re-checked by api/index.php after
     * this lookup, so an expired subscription disables existing keys too.
     */
    public static function authenticate(string $rawKey): ?array
    {
        $rawKey = trim($rawKey);
        if (!self::looksLikeKey($rawKey)) return null;
        $db = KraDb::connect();
        if (!$db instanceof PDO) return null;

        $hash = self::hashKey($rawKey);
        $stmt = $db->prepare('SELECT k.*, u.username, u.display_name, u.role,
                u.username AS created_by_username
            FROM kra_api_keys k
            INNER JOIN kra_users u ON u.id = k.created_by_user_id
            WHERE k.key_hash = :hash LIMIT 1');
        $stmt->execute([':hash' => $hash]);
        $row = $stmt->fetch();
        if (!is_array($row) || !hash_equals((string) ($row['key_hash'] ?? ''), $hash)) return null;
        if (!self::isUsableRow($row)) return null;

        $public = self::publicRow($row);
        try {
            $db->prepare('UPDATE kra_api_keys SET last_used_at = NOW(), last_used_ip = :ip WHERE id = :id')
                ->execute([
                    ':ip' => substr(trim((string) ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 64),
                    ':id' => (string) $row['id'],
                ]);
        } catch (Throwable $e) {
            error_log('[KraApiKeys] last-used update failed: ' . $e->getMessage());
        }

        return [
            'id' => (string) $row['created_by_user_id'],
            'username' => (string) ($row['username'] ?? ''),
            'display_name' => (string) ($row['display_name'] ?? ''),
            'role' => (string) ($row['role'] ?? 'user'),
            'authType' => 'api_key',
            'apiKeyId' => (string) $row['id'],
            'apiKeyName' => (string) ($row['name'] ?? 'KRA API Key'),
            'apiKeyWorkspaceId' => (string) $row['workspace_id'],
            'apiKeyScopes' => $public['scopes'],
            'apiKey' => $public,
        ];
    }

    public static function principalHasScope(?array $principal, string $scope): bool
    {
        if (!is_array($principal) || (string) ($principal['authType'] ?? '') !== 'api_key') return false;
        return in_array(strtolower(trim($scope)), array_map('strval', (array) ($principal['apiKeyScopes'] ?? [])), true);
    }

    private static function insertNew(PDO $db, array $workspace, array $actor, string $name, array $scopes, ?string $expiresAt): array
    {
        $workspaceId = self::workspaceId($workspace);
        $actorId = self::actorId($actor);
        $ownerId = trim((string) ($workspace['ownerUserId'] ?? $workspace['owner_user_id'] ?? $actorId));
        $name = trim(preg_replace('/\s+/', ' ', $name) ?: '');
        if ($name === '') $name = 'KRA API Key';
        if (strlen($name) > 120) throw new InvalidArgumentException('Nama KRA API Key maksimal 120 karakter.');

        $id = 'key_' . bin2hex(random_bytes(12));
        $secret = self::generateSecret();
        $stmt = $db->prepare('INSERT INTO kra_api_keys
            (id, workspace_id, owner_user_id, created_by_user_id, name, key_prefix, key_last4, key_hash, scopes, status, expires_at)
            VALUES
            (:id, :workspace, :owner, :creator, :name, :prefix, :last4, :hash, :scopes, "active", :expires)');
        $stmt->bindValue(':expires', $expiresAt, $expiresAt === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $stmt->execute([
            ':id' => $id,
            ':workspace' => $workspaceId,
            ':owner' => $ownerId,
            ':creator' => $actorId,
            ':name' => $name,
            ':prefix' => (string) $secret['prefix'],
            ':last4' => (string) $secret['last4'],
            ':hash' => (string) $secret['hash'],
            ':scopes' => json_encode(self::normalizeScopes($scopes), JSON_UNESCAPED_SLASHES),
        ]);
        $row = self::rowById($db, $workspaceId, $id);
        if ($row === null) throw new RuntimeException('KRA API Key gagal dibaca setelah dibuat.');
        return ['raw' => (string) $secret['raw'], 'row' => $row];
    }

    private static function rowById(PDO $db, string $workspaceId, string $keyId): ?array
    {
        $stmt = $db->prepare('SELECT k.*, u.username AS created_by_username
            FROM kra_api_keys k
            LEFT JOIN kra_users u ON u.id = k.created_by_user_id
            WHERE k.workspace_id = :workspace AND k.id = :id LIMIT 1');
        $stmt->execute([':workspace' => $workspaceId, ':id' => trim($keyId)]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    private static function database(): PDO
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) {
            throw new RuntimeException('Database KRA tidak tersedia; KRA API Key tidak dapat dikelola.');
        }
        return $db;
    }

    private static function workspaceId(array $workspace): string
    {
        $id = trim((string) ($workspace['id'] ?? ''));
        if ($id === '') throw new DomainException('Workspace aktif tidak ditemukan untuk KRA API Key.');
        return $id;
    }

    private static function actorId(array $actor): string
    {
        $id = trim((string) ($actor['id'] ?? ''));
        if ($id === '') throw new DomainException('Pengguna SIAS wajib login sebelum mengelola KRA API Key.');
        return $id;
    }

    private static function expiresAtFromDays(?int $days): ?string
    {
        if ($days === null || $days === 0) return null;
        if ($days < 1 || $days > 3650) {
            throw new InvalidArgumentException('Masa berlaku KRA API Key harus 1–3650 hari, atau 0 untuk tidak kedaluwarsa.');
        }
        return date('Y-m-d H:i:s', time() + $days * 86400);
    }

    private static function timestamp(mixed $value): ?int
    {
        if ($value === null || $value === '') return null;
        if (is_int($value)) return $value;
        $ts = strtotime((string) $value);
        return $ts === false ? null : $ts;
    }
}
