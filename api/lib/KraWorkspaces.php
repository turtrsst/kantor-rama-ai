<?php
declare(strict_types=1);

require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraTenantContext.php';

/** Workspace + membership + registered project roots. */
final class KraWorkspaces
{
    public static function defaultIdForUser(string $userId): string
    {
        return 'ws_' . substr(hash('sha256', 'kra-default:' . $userId), 0, 24);
    }

    public static function ensureDefault(array $user): array
    {
        $userId = trim((string) ($user['id'] ?? ''));
        if ($userId === '') throw new InvalidArgumentException('User SIAS wajib login sebelum workspace dibuat.');
        $id = self::defaultIdForUser($userId);
        $name = trim((string) ($user['display_name'] ?? $user['username'] ?? 'Workspace Saya')) . ' Workspace';
        $db = KraDb::connect();
        if (!$db instanceof PDO) {
            return self::normalize([
                'id' => $id, 'name' => $name, 'owner_user_id' => $userId,
                'status' => 'active', 'is_default' => 1, 'member_role' => 'owner',
            ], $user);
        }
        $db->prepare('INSERT IGNORE INTO kra_workspaces (id, name, owner_user_id, status, is_default)
            VALUES (:id, :name, :owner, "active", 1)')
            ->execute([':id' => $id, ':name' => substr($name, 0, 160), ':owner' => $userId]);
        $db->prepare('INSERT IGNORE INTO kra_workspace_members (workspace_id, user_id, role)
            VALUES (:workspace, :user, "owner")')
            ->execute([':workspace' => $id, ':user' => $userId]);

        $workspace = self::byId($id, $user);
        if ($workspace !== null) self::claimLegacyIfEligible($workspace, $user);
        return $workspace ?? self::normalize([
            'id' => $id, 'name' => $name, 'owner_user_id' => $userId,
            'status' => 'active', 'is_default' => 1, 'member_role' => 'owner',
        ], $user);
    }

    public static function listForUser(array $user): array
    {
        self::ensureDefault($user);
        $userId = (string) ($user['id'] ?? '');
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [self::ensureDefault($user)];
        $stmt = $db->prepare('SELECT w.*, m.role AS member_role FROM kra_workspaces w
            INNER JOIN kra_workspace_members m ON m.workspace_id = w.id
            WHERE m.user_id = :user AND w.status = "active"
            ORDER BY w.is_default DESC, w.created_at ASC');
        $stmt->execute([':user' => $userId]);
        return array_map(static fn(array $row): array => self::normalize($row, $user), $stmt->fetchAll());
    }

    public static function byId(string $workspaceId, ?array $user = null): ?array
    {
        $workspaceId = trim($workspaceId);
        if ($workspaceId === '') return null;
        $db = KraDb::connect();
        if (!$db instanceof PDO) {
            if ($user !== null && $workspaceId === self::defaultIdForUser((string) ($user['id'] ?? ''))) return self::ensureDefault($user);
            return null;
        }
        if ($user !== null && (string) ($user['id'] ?? '') !== '') {
            $stmt = $db->prepare('SELECT w.*, m.role AS member_role FROM kra_workspaces w
                LEFT JOIN kra_workspace_members m ON m.workspace_id = w.id AND m.user_id = :user
                WHERE w.id = :id AND w.status = "active" LIMIT 1');
            $stmt->execute([':user' => (string) $user['id'], ':id' => $workspaceId]);
        } else {
            $stmt = $db->prepare('SELECT w.*, NULL AS member_role FROM kra_workspaces w WHERE w.id = :id AND w.status = "active" LIMIT 1');
            $stmt->execute([':id' => $workspaceId]);
        }
        $row = $stmt->fetch();
        return is_array($row) ? self::normalize($row, $user) : null;
    }

    public static function resolve(array $user, ?string $requestedId = null): array
    {
        $default = self::ensureDefault($user);
        $requestedId = trim((string) ($requestedId ?? ''));
        if ($requestedId === '' || $requestedId === $default['id']) return $default;
        $workspace = self::byId($requestedId, $user);
        if ($workspace === null) throw new DomainException('Workspace tidak ditemukan atau sudah diarsipkan.');
        if (KraTenantContext::isPlatformAdmin($user)) {
            $workspace['memberRole'] = (string) ($workspace['memberRole'] ?? '') ?: 'platform_admin';
            $workspace['platformSupportAccess'] = true;
            return $workspace;
        }
        if (!in_array((string) ($workspace['memberRole'] ?? ''), ['owner', 'admin', 'member', 'viewer'], true)) {
            throw new DomainException('Anda bukan anggota workspace tersebut.');
        }
        return $workspace;
    }

    public static function create(array $user, string $name): array
    {
        $name = trim(preg_replace('/\s+/', ' ', $name) ?: '');
        if ($name === '' || strlen($name) > 160) throw new InvalidArgumentException('Nama workspace wajib diisi (maks. 160 karakter).');
        $userId = (string) ($user['id'] ?? '');
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia; workspace belum dibuat.');
        $previousUser = KraTenantContext::user();
        $previousWorkspace = KraTenantContext::workspace();
        try {
            $default = self::ensureDefault($user);
            KraTenantContext::setUser($user);
            KraTenantContext::setWorkspace($default);
            if (class_exists('KraEntitlements')) {
                $stmt = $db->prepare('SELECT COUNT(*) FROM kra_workspaces WHERE owner_user_id = :owner AND status = "active"');
                $stmt->execute([':owner' => $userId]);
                KraEntitlements::assertUnderLimit('workspaces', (int) $stmt->fetchColumn(), 'workspace milik Anda');
            }
            $id = 'ws_' . bin2hex(random_bytes(12));
            $db->prepare('INSERT INTO kra_workspaces (id, name, owner_user_id, status, is_default) VALUES (:id, :name, :owner, "active", 0)')
                ->execute([':id' => $id, ':name' => $name, ':owner' => $userId]);
            $db->prepare('INSERT INTO kra_workspace_members (workspace_id, user_id, role) VALUES (:workspace, :user, "owner")')
                ->execute([':workspace' => $id, ':user' => $userId]);
            return self::byId($id, $user) ?? throw new RuntimeException('Workspace gagal dibaca setelah dibuat.');
        } finally {
            // Quota resolution is evaluated in the creator's default workspace;
            // it must not silently change the caller's active tenant context.
            KraTenantContext::setUser($previousUser);
            KraTenantContext::setWorkspace($previousWorkspace);
        }
    }

    public static function rename(array $workspace, string $name): array
    {
        self::assertWorkspaceAdmin($workspace);
        $name = trim(preg_replace('/\s+/', ' ', $name) ?: '');
        if ($name === '' || strlen($name) > 160) throw new InvalidArgumentException('Nama workspace tidak valid.');
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia.');
        $db->prepare('UPDATE kra_workspaces SET name = :name WHERE id = :id')
            ->execute([':name' => $name, ':id' => (string) $workspace['id']]);
        $workspace['name'] = $name;
        return $workspace;
    }

    public static function archive(array $workspace): void
    {
        self::assertWorkspaceAdmin($workspace);
        if (!empty($workspace['isDefault'])) throw new DomainException('Workspace default tidak dapat diarsipkan.');
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia.');
        $db->prepare('UPDATE kra_workspaces SET status = "archived" WHERE id = :id')
            ->execute([':id' => (string) $workspace['id']]);
    }

    public static function members(array $workspace): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [];
        $stmt = $db->prepare('SELECT m.user_id, m.role, m.created_at, u.username, u.display_name, u.role AS sias_role
            FROM kra_workspace_members m LEFT JOIN kra_users u ON u.id = m.user_id
            WHERE m.workspace_id = :workspace ORDER BY FIELD(m.role, "owner", "admin", "member", "viewer"), u.display_name');
        $stmt->execute([':workspace' => (string) $workspace['id']]);
        return array_map(static fn(array $row): array => [
            'userId' => (string) $row['user_id'],
            'username' => (string) ($row['username'] ?? ''),
            'displayName' => (string) ($row['display_name'] ?? $row['user_id']),
            'role' => (string) $row['role'],
            'siasRole' => (string) ($row['sias_role'] ?? ''),
            'joinedAt' => $row['created_at'] ?? null,
        ], $stmt->fetchAll());
    }

    public static function addMember(array $workspace, string $usernameOrId, string $role = 'member'): array
    {
        self::assertWorkspaceAdmin($workspace);
        $role = strtolower(trim($role));
        if (!in_array($role, ['admin', 'member', 'viewer'], true)) throw new InvalidArgumentException('Role anggota harus admin, member, atau viewer.');
        if (!class_exists('KraAuth')) throw new RuntimeException('Modul auth tidak tersedia.');
        $member = KraAuth::findUserByUsernameOrId(trim($usernameOrId));
        if ($member === null) throw new DomainException('Pengguna SIAS tersebut belum pernah login ke KRA, jadi belum dapat diundang.');
        if ((string) $member['id'] === (string) ($workspace['ownerUserId'] ?? '')) {
            throw new DomainException('Role pemilik workspace tidak dapat diubah dari owner.');
        }
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia.');
        $existing = self::members($workspace);
        $already = false;
        foreach ($existing as $row) if ($row['userId'] === (string) $member['id']) $already = true;
        if (!$already && class_exists('KraEntitlements')) {
            $previousWorkspace = KraTenantContext::workspace();
            try {
                KraTenantContext::setWorkspace($workspace);
                KraEntitlements::assertUnderLimit('seats', count($existing), 'kursi anggota workspace');
            } finally {
                KraTenantContext::setWorkspace($previousWorkspace);
            }
        }
        $db->prepare('INSERT INTO kra_workspace_members (workspace_id, user_id, role)
            VALUES (:workspace, :user, :role)
            ON DUPLICATE KEY UPDATE role = VALUES(role)')
            ->execute([':workspace' => (string) $workspace['id'], ':user' => (string) $member['id'], ':role' => $role]);
        return self::members($workspace);
    }

    public static function removeMember(array $workspace, string $userId): array
    {
        self::assertWorkspaceAdmin($workspace);
        if ($userId === (string) ($workspace['ownerUserId'] ?? '')) throw new DomainException('Pemilik workspace tidak dapat dihapus dari keanggotaan.');
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia.');
        $db->prepare('DELETE FROM kra_workspace_members WHERE workspace_id = :workspace AND user_id = :user')
            ->execute([':workspace' => (string) $workspace['id'], ':user' => $userId]);
        return self::members($workspace);
    }

    // --------------------------------------------------------------- projects

    public static function registerProject(array $workspace, string $name, string $rootPath, bool $isDefault = false, bool $enforceQuota = true): array
    {
        self::assertWorkspaceAdmin($workspace);
        if (!class_exists('KraProjectPath')) require_once __DIR__ . '/KraProjectPath.php';
        $check = KraProjectPath::validateForWorkspace($rootPath, (string) $workspace['id']);
        if (empty($check['ok'])) throw new DomainException('Lokasi proyek ditolak: ' . implode(' ', (array) ($check['reasons'] ?? [])));
        $resolvedRoot = (string) $check['path'];
        $name = trim(preg_replace('/\s+/', ' ', $name) ?: '') ?: basename(str_replace('\\', '/', rtrim($resolvedRoot, '\\/')));
        $db = KraDb::connect();
        $hash = hash('sha256', strtolower(str_replace('/', DIRECTORY_SEPARATOR, $resolvedRoot)));
        if (!$db instanceof PDO) {
            return ['id' => 'prj_' . substr($hash, 0, 24), 'workspaceId' => (string) $workspace['id'], 'name' => $name, 'rootPath' => $resolvedRoot, 'isDefault' => $isDefault, 'status' => 'active', 'pathCheck' => $check];
        }
        $stmt = $db->prepare('SELECT * FROM kra_projects WHERE workspace_id = :workspace AND root_hash = :hash LIMIT 1');
        $stmt->execute([':workspace' => (string) $workspace['id'], ':hash' => $hash]);
        $existing = $stmt->fetch();
        if (!is_array($existing) && $enforceQuota && class_exists('KraEntitlements')) {
            $previousWorkspace = KraTenantContext::workspace();
            try {
                KraTenantContext::setWorkspace($workspace);
                $count = $db->prepare('SELECT COUNT(*) FROM kra_projects WHERE workspace_id = :workspace AND status = "active"');
                $count->execute([':workspace' => (string) $workspace['id']]);
                KraEntitlements::assertUnderLimit('projects', (int) $count->fetchColumn(), 'proyek workspace');
            } finally {
                KraTenantContext::setWorkspace($previousWorkspace);
            }
        }
        if ($isDefault) {
            $db->prepare('UPDATE kra_projects SET is_default = 0 WHERE workspace_id = :workspace')
                ->execute([':workspace' => (string) $workspace['id']]);
        }
        $id = is_array($existing) ? (string) $existing['id'] : 'prj_' . bin2hex(random_bytes(12));
        $db->prepare('INSERT INTO kra_projects (id, workspace_id, owner_user_id, name, root_path, root_hash, status, is_default)
            VALUES (:id, :workspace, :owner, :name, :root, :hash, "active", :default)
            ON DUPLICATE KEY UPDATE name=VALUES(name), root_path=VALUES(root_path), status="active", is_default=VALUES(is_default)')
            ->execute([
                ':id' => $id, ':workspace' => (string) $workspace['id'],
                ':owner' => (string) ($workspace['ownerUserId'] ?? KraTenantContext::userId()),
                ':name' => substr($name, 0, 160), ':root' => $resolvedRoot, ':hash' => $hash,
                ':default' => $isDefault ? 1 : 0,
            ]);
        $project = self::projectById($workspace, $id);
        if ($project !== null) $project['pathCheck'] = $check;
        return $project ?? ['id' => $id, 'workspaceId' => (string) $workspace['id'], 'name' => $name, 'rootPath' => $resolvedRoot, 'isDefault' => $isDefault, 'status' => 'active', 'pathCheck' => $check];
    }

    public static function projects(array $workspace): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [];
        $stmt = $db->prepare('SELECT * FROM kra_projects WHERE workspace_id = :workspace AND status = "active" ORDER BY is_default DESC, created_at ASC');
        $stmt->execute([':workspace' => (string) $workspace['id']]);
        return array_map([self::class, 'normalizeProject'], $stmt->fetchAll());
    }

    public static function projectById(array $workspace, string $projectId): ?array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return null;
        $stmt = $db->prepare('SELECT * FROM kra_projects WHERE workspace_id = :workspace AND id = :id AND status = "active" LIMIT 1');
        $stmt->execute([':workspace' => (string) $workspace['id'], ':id' => $projectId]);
        $row = $stmt->fetch();
        return is_array($row) ? self::normalizeProject($row) : null;
    }

    public static function projectByRoot(array $workspace, string $rootPath): ?array
    {
        $hash = hash('sha256', strtolower(str_replace('/', DIRECTORY_SEPARATOR, rtrim(trim($rootPath), '\\/'))));
        $db = KraDb::connect();
        if (!$db instanceof PDO) return null;
        $stmt = $db->prepare('SELECT * FROM kra_projects WHERE workspace_id = :workspace AND root_hash = :hash AND status = "active" LIMIT 1');
        $stmt->execute([':workspace' => (string) $workspace['id'], ':hash' => $hash]);
        $row = $stmt->fetch();
        return is_array($row) ? self::normalizeProject($row) : null;
    }

    public static function defaultProjectRoot(array $workspace): string
    {
        if (!class_exists('KraProjectPath')) require_once __DIR__ . '/KraProjectPath.php';
        $projects = self::projects($workspace);
        foreach ($projects as $project) if (!empty($project['isDefault'])) return (string) $project['rootPath'];
        return KraProjectPath::workspaceProjectsRoot((string) $workspace['id'], !empty($workspace['legacyClaim']))
            . DIRECTORY_SEPARATOR . 'workspace-files';
    }

    public static function ensureDefaultProject(array $workspace): array
    {
        $projects = self::projects($workspace);
        foreach ($projects as $project) if (!empty($project['isDefault'])) return $project;
        $root = self::defaultProjectRoot($workspace);
        if (!is_dir($root) && !@mkdir($root, 0777, true) && !is_dir($root)) {
            throw new RuntimeException('Folder proyek default workspace tidak dapat dibuat: ' . $root);
        }
        return self::registerProject($workspace, 'Workspace Files', $root, true, false);
    }

    public static function assertWorkspaceAdmin(array $workspace): void
    {
        $user = KraTenantContext::user();
        if ($user === null && KraTenantContext::workspace() === null) return; // trusted CLI/internal path
        if (KraTenantContext::isPlatformAdmin($user)) return;
        if ((string) ($workspace['ownerUserId'] ?? '') === KraTenantContext::userId()) return;
        if (in_array(strtolower((string) ($workspace['memberRole'] ?? '')), ['owner', 'admin'], true)) return;
        throw new DomainException('Hanya pemilik/admin workspace yang dapat melakukan tindakan ini.');
    }

    public static function assertWorkspaceMember(array $workspace): void
    {
        $user = KraTenantContext::user();
        if ($user === null && KraTenantContext::workspace() === null) return;
        if (KraTenantContext::isPlatformAdmin($user)) return;
        if (in_array(strtolower((string) ($workspace['memberRole'] ?? '')), ['owner', 'admin', 'member', 'viewer'], true)) return;
        if ((string) ($workspace['ownerUserId'] ?? '') === KraTenantContext::userId()) return;
        throw new DomainException('Anda bukan anggota workspace aktif.');
    }

    private static function claimLegacyIfEligible(array $workspace, array $user): void
    {
        if (!KraTenantContext::isPlatformAdmin($user)) return;
        if (($workspace['id'] ?? '') !== self::defaultIdForUser((string) ($user['id'] ?? ''))) return;
        $db = KraDb::connect();
        if (!$db instanceof PDO) return;
        $id = (string) $workspace['id'];
        $userId = (string) $user['id'];
        try {
            $db->prepare('UPDATE kra_agents SET workspace_id = :workspace, owner_user_id = COALESCE(owner_user_id, :owner) WHERE workspace_id IS NULL OR workspace_id IN ("", "legacy")')
                ->execute([':workspace' => $id, ':owner' => $userId]);
            $db->prepare('UPDATE kra_tasks SET workspace_id = :workspace, owner_user_id = COALESCE(owner_user_id, :owner) WHERE workspace_id IS NULL OR workspace_id IN ("", "legacy")')
                ->execute([':workspace' => $id, ':owner' => $userId]);
            $db->prepare('UPDATE kra_chat_history SET workspace_id = :workspace WHERE workspace_id IS NULL OR workspace_id IN ("", "legacy")')
                ->execute([':workspace' => $id]);
            $db->prepare('UPDATE kra_agent_presence SET workspace_id = :workspace WHERE workspace_id IS NULL OR workspace_id IN ("", "legacy")')
                ->execute([':workspace' => $id]);
            $db->prepare('UPDATE kra_agent_events SET workspace_id = :workspace WHERE workspace_id IS NULL OR workspace_id IN ("", "legacy")')
                ->execute([':workspace' => $id]);
            $db->prepare('UPDATE kra_agent_skills SET workspace_id = :workspace WHERE workspace_id IS NULL OR workspace_id IN ("", "legacy")')
                ->execute([':workspace' => $id]);
            if (class_exists('KraIntegrationSettings')) KraIntegrationSettings::migrateLegacyToWorkspace($id);
            if (class_exists('KraVaultSettings')) KraVaultSettings::migrateLegacyToWorkspace($id);
        } catch (Throwable $e) {
            error_log('[KraWorkspaces] legacy claim failed: ' . $e->getMessage());
        }
    }

    private static function normalize(array $row, ?array $user = null): array
    {
        $id = (string) ($row['id'] ?? '');
        $ownerId = (string) ($row['owner_user_id'] ?? $row['ownerUserId'] ?? '');
        $isDefault = !empty($row['is_default'] ?? $row['isDefault'] ?? false);
        $legacyClaim = $isDefault && $user !== null && KraTenantContext::isPlatformAdmin($user)
            && $id === self::defaultIdForUser((string) ($user['id'] ?? '')) && $ownerId === (string) ($user['id'] ?? '');
        return [
            'id' => $id,
            'name' => (string) ($row['name'] ?? 'Workspace'),
            'ownerUserId' => $ownerId,
            'status' => (string) ($row['status'] ?? 'active'),
            'isDefault' => $isDefault,
            'memberRole' => (string) ($row['member_role'] ?? $row['memberRole'] ?? ''),
            'legacyClaim' => $legacyClaim,
            'createdAt' => $row['created_at'] ?? $row['createdAt'] ?? null,
            'updatedAt' => $row['updated_at'] ?? $row['updatedAt'] ?? null,
        ];
    }

    private static function normalizeProject(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'workspaceId' => (string) ($row['workspace_id'] ?? $row['workspaceId'] ?? ''),
            'ownerUserId' => (string) ($row['owner_user_id'] ?? ''),
            'name' => (string) ($row['name'] ?? 'Project'),
            'rootPath' => (string) ($row['root_path'] ?? $row['rootPath'] ?? ''),
            'status' => (string) ($row['status'] ?? 'active'),
            'isDefault' => !empty($row['is_default'] ?? $row['isDefault'] ?? false),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
}
