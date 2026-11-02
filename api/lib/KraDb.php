<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

final class KraDb
{
    private static ?PDO $pdo = null;

    private static function workspaceId(): string
    {
        return KraTenantContext::workspaceId();
    }

    /** SQL predicate + params for a workspace-owned table alias/column prefix. */
    private static function workspacePredicate(string $column = 'workspace_id'): string
    {
        if (KraTenantContext::hasSystemAccess()) return '1 = 1';
        if (KraTenantContext::canSeeLegacy()) {
            return "($column = '" . str_replace("'", "''", self::workspaceId()) . "' OR $column IS NULL OR $column IN ('', 'legacy'))";
        }
        return "$column = '" . str_replace("'", "''", self::workspaceId()) . "'";
    }

    private static function ensureCompositePrimaryKey(string $table, array $columns): void
    {
        if (self::$pdo === null) return;
        $stmt = self::$pdo->prepare('SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = "PRIMARY"');
        $stmt->execute([':table' => $table]);
        $current = strtolower(trim((string) $stmt->fetchColumn()));
        $desired = strtolower(implode(',', $columns));
        if ($current === $desired) return;
        $quoted = implode(', ', array_map(static fn(string $c): string => '`' . str_replace('`', '', $c) . '`', $columns));
        self::$pdo->exec('ALTER TABLE `' . str_replace('`', '', $table) . '` DROP PRIMARY KEY, ADD PRIMARY KEY (' . $quoted . ')');
    }

    private static function ensureIndex(string $table, string $index, array $columns): void
    {
        if (self::$pdo === null) return;
        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index');
        $stmt->execute([':table' => $table, ':index' => $index]);
        if ((int) $stmt->fetchColumn() > 0) return;
        $quoted = implode(', ', array_map(static fn(string $c): string => '`' . str_replace('`', '', $c) . '`', $columns));
        self::$pdo->exec('CREATE INDEX `' . str_replace('`', '', $index) . '` ON `' . str_replace('`', '', $table) . '` (' . $quoted . ')');
    }

    public static function connect(): ?PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $host = getenv('KRA_DB_HOST') ?: '127.0.0.1';
        $user = trim((string) getenv('KRA_DB_USER'));
        $pass = (string) getenv('KRA_DB_PASS');
        if ($user === '') {
            $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
            $localRequest = in_array($remote, ['127.0.0.1', '::1'], true);
            $localDevServer = PHP_SAPI === 'cli-server' && $localRequest;
            $explicitLocalOverride = getenv('KRA_ALLOW_DEFAULT_DB_ROOT') === '1' && $localRequest;
            if (!$localDevServer && !$explicitLocalOverride) return null;
            $user = 'root';
        }
        $dbname = 'kra_db';

        try {
            // First ensure database exists
            $init = new PDO("mysql:host={$host};charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $init->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

            self::$pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            self::migrate();
            return self::$pdo;
        } catch (Throwable $e) {
            // Return null if MySQL is not available; system gracefully falls back
            return null;
        }
    }

    private static function migrate(): void
    {
        if (self::$pdo === null) return;

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_agents` (
            `id` VARCHAR(64) PRIMARY KEY,
            `name` VARCHAR(128) NOT NULL,
            `role` VARCHAR(128) NOT NULL,
            `template_id` VARCHAR(64) NULL,
            `palette` TEXT NULL,
            `appearance` JSON NULL,
            `engine` JSON NULL,
            `briefing` JSON NULL,
            `workspace` JSON NULL,
            `seat_x` FLOAT NOT NULL DEFAULT 0,
            `seat_y` FLOAT NOT NULL DEFAULT 0,
            `status` VARCHAR(64) NOT NULL DEFAULT 'standing by',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("ALTER TABLE `kra_agents`
            ADD COLUMN IF NOT EXISTS `appearance` JSON NULL AFTER `palette`,
            ADD COLUMN IF NOT EXISTS `engine` JSON NULL AFTER `appearance`,
            ADD COLUMN IF NOT EXISTS `briefing` JSON NULL AFTER `engine`,
            ADD COLUMN IF NOT EXISTS `workspace` JSON NULL AFTER `briefing`");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_tasks` (
            `id` VARCHAR(64) PRIMARY KEY,
            `agent_id` VARCHAR(64) NOT NULL,
            `action_type` VARCHAR(32) NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `target_file` VARCHAR(255) NOT NULL,
            `proposed_content` MEDIUMTEXT NULL,
            `summary` TEXT NULL,
            `status` VARCHAR(32) NOT NULL DEFAULT 'WAITING_APPROVAL',
            `approved_by` VARCHAR(64) NULL,
            `rejection_reason` TEXT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `executed_at` TIMESTAMP NULL,
            `execution_provider` VARCHAR(64) NULL,
            `execution_output` MEDIUMTEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("ALTER TABLE `kra_tasks`
            ADD COLUMN IF NOT EXISTS `execution_provider` VARCHAR(64) NULL,
            ADD COLUMN IF NOT EXISTS `execution_output` MEDIUMTEXT NULL");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_chat_history` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `sender` VARCHAR(64) NOT NULL,
            `message` TEXT NOT NULL,
            `channel` VARCHAR(64) NOT NULL DEFAULT 'office',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        self::$pdo->exec("ALTER TABLE `kra_chat_history`
            MODIFY COLUMN `channel` VARCHAR(64) NOT NULL DEFAULT 'office'");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_users` (
            `id` VARCHAR(64) PRIMARY KEY,
            `username` VARCHAR(64) NOT NULL UNIQUE,
            `display_name` VARCHAR(128) NOT NULL,
            `role` VARCHAR(32) NOT NULL DEFAULT 'officer',
            `session_hash` CHAR(64) NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_user_llm` (
            `user_id` VARCHAR(128) PRIMARY KEY,
            `api_key_hash` CHAR(64) NULL,
            `token_balance` BIGINT NOT NULL DEFAULT 0,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_decorations` (
            `id` VARCHAR(128) PRIMARY KEY,
            `floor` INT NOT NULL DEFAULT 1,
            `tile_x` INT NOT NULL,
            `tile_y` INT NOT NULL,
            `item_id` VARCHAR(64) NOT NULL,
            `owner_id` VARCHAR(64) NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uk_owner_floor_xy` (`owner_id`, `floor`, `tile_x`, `tile_y`),
            INDEX `idx_owner_floor` (`owner_id`, `floor`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        self::$pdo->exec("ALTER TABLE `kra_decorations`
            MODIFY COLUMN `owner_id` VARCHAR(64) NOT NULL");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_agent_presence` (
            `agent_id` VARCHAR(64) PRIMARY KEY,
            `state` VARCHAR(32) NOT NULL DEFAULT 'idle',
            `activity` VARCHAR(128) NULL,
            `pos_x` FLOAT NOT NULL DEFAULT 0,
            `pos_y` FLOAT NOT NULL DEFAULT 0,
            `bubble_text` VARCHAR(255) NULL,
            `bubble_kind` VARCHAR(32) NULL,
            `floor_id` INT NOT NULL DEFAULT 1,
            `in_transit` TINYINT(1) NOT NULL DEFAULT 0,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("ALTER TABLE `kra_agent_presence`
            ADD COLUMN IF NOT EXISTS `floor_id` INT NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS `in_transit` TINYINT(1) NOT NULL DEFAULT 0");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_agent_events` (
            `id` VARCHAR(64) PRIMARY KEY,
            `type` VARCHAR(64) NOT NULL,
            `from_agent` VARCHAR(64) NOT NULL,
            `to_agent` VARCHAR(64) NULL,
            `payload` TEXT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_agent_skills` (
            `agent_id` VARCHAR(64) NOT NULL,
            `skill_id` VARCHAR(128) NOT NULL,
            `enabled` TINYINT(1) NOT NULL DEFAULT 1,
            `priority` INT NOT NULL DEFAULT 100,
            `updated_by` VARCHAR(64) NOT NULL DEFAULT 'Boss/User',
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`agent_id`, `skill_id`),
            INDEX `idx_agent_skill_priority` (`agent_id`, `priority`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        // --- Commercial multi-workspace foundation -------------------------
        // SIAS remains the identity source. KRA owns workspaces, project
        // registrations, subscriptions, billing events, and memory indexes.
        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_workspaces` (
            `id` VARCHAR(80) PRIMARY KEY,
            `name` VARCHAR(160) NOT NULL,
            `owner_user_id` VARCHAR(64) NOT NULL,
            `status` VARCHAR(32) NOT NULL DEFAULT 'active',
            `is_default` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_workspace_owner` (`owner_user_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_workspace_members` (
            `workspace_id` VARCHAR(80) NOT NULL,
            `user_id` VARCHAR(64) NOT NULL,
            `role` VARCHAR(32) NOT NULL DEFAULT 'member',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`workspace_id`, `user_id`),
            INDEX `idx_workspace_member_user` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_projects` (
            `id` VARCHAR(80) PRIMARY KEY,
            `workspace_id` VARCHAR(80) NOT NULL,
            `owner_user_id` VARCHAR(64) NOT NULL,
            `name` VARCHAR(160) NOT NULL,
            `root_path` TEXT NOT NULL,
            `root_hash` CHAR(64) NOT NULL,
            `status` VARCHAR(32) NOT NULL DEFAULT 'active',
            `is_default` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uk_workspace_project_root` (`workspace_id`, `root_hash`),
            INDEX `idx_project_workspace` (`workspace_id`, `status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_subscriptions` (
            `user_id` VARCHAR(64) PRIMARY KEY,
            `plan` VARCHAR(32) NOT NULL DEFAULT 'free',
            `billing_period` VARCHAR(16) NOT NULL DEFAULT 'monthly',
            `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
            `starts_at` TIMESTAMP NULL,
            `current_period_end` TIMESTAMP NULL,
            `trial_ends_at` TIMESTAMP NULL,
            `cancel_at_period_end` TINYINT(1) NOT NULL DEFAULT 0,
            `canceled_at` TIMESTAMP NULL,
            `payment_provider` VARCHAR(64) NOT NULL DEFAULT 'manual',
            `external_customer_id` VARCHAR(160) NULL,
            `external_subscription_id` VARCHAR(160) NULL,
            `last_payment_at` TIMESTAMP NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_subscription_status_end` (`status`, `current_period_end`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_billing_orders` (
            `id` VARCHAR(80) PRIMARY KEY,
            `public_code` VARCHAR(32) NOT NULL UNIQUE,
            `user_id` VARCHAR(64) NOT NULL,
            `plan` VARCHAR(32) NOT NULL,
            `billing_period` VARCHAR(16) NOT NULL DEFAULT 'monthly',
            `amount_idr` BIGINT NOT NULL DEFAULT 0,
            `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
            `payment_provider` VARCHAR(64) NOT NULL DEFAULT 'manual',
            `external_id` VARCHAR(180) NULL,
            `payment_url` TEXT NULL,
            `instructions` TEXT NULL,
            `expires_at` TIMESTAMP NULL,
            `paid_at` TIMESTAMP NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_billing_order_user` (`user_id`, `status`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_billing_events` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `external_event_id` VARCHAR(180) NULL UNIQUE,
            `user_id` VARCHAR(64) NULL,
            `event_type` VARCHAR(120) NOT NULL,
            `payload` JSON NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_billing_event_user` (`user_id`, `event_type`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_memory_notes` (
            `id` VARCHAR(80) PRIMARY KEY,
            `workspace_id` VARCHAR(80) NOT NULL,
            `user_id` VARCHAR(64) NULL,
            `channel` VARCHAR(80) NOT NULL DEFAULT 'office',
            `kind` VARCHAR(40) NOT NULL DEFAULT 'conversation',
            `title` VARCHAR(255) NOT NULL,
            `note_path` TEXT NOT NULL,
            `source_hash` CHAR(64) NOT NULL,
            `summary` TEXT NULL,
            `tags` JSON NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uk_memory_workspace_source` (`workspace_id`, `source_hash`),
            INDEX `idx_memory_workspace_channel` (`workspace_id`, `channel`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        self::$pdo->exec("CREATE TABLE IF NOT EXISTS `kra_usage_events` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `workspace_id` VARCHAR(80) NOT NULL,
            `user_id` VARCHAR(64) NULL,
            `event_type` VARCHAR(80) NOT NULL,
            `quantity` INT NOT NULL DEFAULT 1,
            `metadata` JSON NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_usage_workspace_type` (`workspace_id`, `event_type`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

        // Existing global tables become workspace-owned. Legacy rows stay
        // marked `legacy` until the exact SIAS platform admin's default
        // workspace claims them (see KraWorkspaces::ensureDefault()).
        self::$pdo->exec("ALTER TABLE `kra_agents`
            ADD COLUMN IF NOT EXISTS `owner_user_id` VARCHAR(64) NULL AFTER `id`,
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' AFTER `owner_user_id`");
        self::$pdo->exec("UPDATE `kra_agents` SET `workspace_id` = 'legacy' WHERE `workspace_id` IS NULL OR `workspace_id` = ''");
        self::ensureCompositePrimaryKey('kra_agents', ['workspace_id', 'id']);
        self::ensureIndex('kra_agents', 'idx_agent_workspace', ['workspace_id', 'created_at']);

        self::$pdo->exec("ALTER TABLE `kra_tasks`
            ADD COLUMN IF NOT EXISTS `owner_user_id` VARCHAR(64) NULL AFTER `id`,
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' AFTER `owner_user_id`,
            ADD COLUMN IF NOT EXISTS `project_id` VARCHAR(80) NULL AFTER `workspace_id`,
            ADD COLUMN IF NOT EXISTS `project_root` TEXT NULL AFTER `project_id`,
            ADD COLUMN IF NOT EXISTS `context` JSON NULL AFTER `project_root`");
        self::$pdo->exec("UPDATE `kra_tasks` SET `workspace_id` = 'legacy' WHERE `workspace_id` IS NULL OR `workspace_id` = ''");
        self::ensureIndex('kra_tasks', 'idx_task_workspace', ['workspace_id', 'created_at']);

        self::$pdo->exec("ALTER TABLE `kra_chat_history`
            ADD COLUMN IF NOT EXISTS `user_id` VARCHAR(64) NULL AFTER `sender`,
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' AFTER `user_id`");
        self::$pdo->exec("UPDATE `kra_chat_history` SET `workspace_id` = 'legacy' WHERE `workspace_id` IS NULL OR `workspace_id` = ''");
        self::ensureIndex('kra_chat_history', 'idx_chat_workspace_channel', ['workspace_id', 'channel', 'id']);

        self::$pdo->exec("ALTER TABLE `kra_agent_presence`
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' BEFORE `agent_id`");
        self::$pdo->exec("UPDATE `kra_agent_presence` SET `workspace_id` = 'legacy' WHERE `workspace_id` IS NULL OR `workspace_id` = ''");
        self::ensureCompositePrimaryKey('kra_agent_presence', ['workspace_id', 'agent_id']);

        self::$pdo->exec("ALTER TABLE `kra_agent_events`
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' AFTER `id`,
            ADD COLUMN IF NOT EXISTS `user_id` VARCHAR(64) NULL AFTER `workspace_id`");
        self::$pdo->exec("UPDATE `kra_agent_events` SET `workspace_id` = 'legacy' WHERE `workspace_id` IS NULL OR `workspace_id` = ''");
        self::ensureIndex('kra_agent_events', 'idx_event_workspace', ['workspace_id', 'created_at']);

        self::$pdo->exec("ALTER TABLE `kra_agent_skills`
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' BEFORE `agent_id`");
        self::$pdo->exec("UPDATE `kra_agent_skills` SET `workspace_id` = 'legacy' WHERE `workspace_id` IS NULL OR `workspace_id` = ''");
        self::ensureCompositePrimaryKey('kra_agent_skills', ['workspace_id', 'agent_id', 'skill_id']);

        self::$pdo->exec("ALTER TABLE `kra_decorations`
            ADD COLUMN IF NOT EXISTS `workspace_id` VARCHAR(80) NOT NULL DEFAULT 'legacy' AFTER `owner_id`");
    }

    public static function saveDecoration(
        int $floor,
        int $tileX,
        int $tileY,
        string $itemId,
        string $ownerId
    ): void {
        $db = self::connect();
        if (!$db || $ownerId === '') return;

        $id = "dec_{$ownerId}_{$floor}_{$tileX}_{$tileY}";
        if ($itemId === 'remove' || $itemId === '') {
            $stmt = $db->prepare(
                "DELETE FROM `kra_decorations` WHERE `owner_id` = :owner AND `floor` = :floor AND `tile_x` = :x AND `tile_y` = :y"
            );
            $stmt->execute([':owner' => $ownerId, ':floor' => $floor, ':x' => $tileX, ':y' => $tileY]);
            return;
        }

        $sql = "INSERT INTO `kra_decorations` (`id`, `floor`, `tile_x`, `tile_y`, `item_id`, `owner_id`)
            VALUES (:id, :floor, :x, :y, :item_id, :owner_id)
            ON DUPLICATE KEY UPDATE `item_id` = VALUES(`item_id`)";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':id' => $id,
            ':floor' => $floor,
            ':x' => $tileX,
            ':y' => $tileY,
            ':item_id' => $itemId,
            ':owner_id' => $ownerId,
        ]);
    }

    public static function getDecorations(int $floor, string $ownerId): array
    {
        $db = self::connect();
        if (!$db || $ownerId === '') return [];

        $stmt = $db->prepare(
            "SELECT `tile_x`, `tile_y`, `item_id`, `owner_id` FROM `kra_decorations` WHERE `floor` = :floor AND `owner_id` = :owner"
        );
        $stmt->execute([':floor' => $floor, ':owner' => $ownerId]);
        return $stmt->fetchAll();
    }

    public static function clearDecorations(int $floor, string $ownerId): void
    {
        $db = self::connect();
        if (!$db || $ownerId === '') return;

        $stmt = $db->prepare("DELETE FROM `kra_decorations` WHERE `floor` = :floor AND `owner_id` = :owner");
        $stmt->execute([':floor' => $floor, ':owner' => $ownerId]);
    }

    public static function savePresence(array $presence): void
    {
        $db = self::connect();
        if (!$db || empty($presence['agentId'])) return;
        $stmt = $db->prepare("INSERT INTO kra_agent_presence
            (workspace_id, agent_id, state, activity, pos_x, pos_y, bubble_text, bubble_kind, floor_id, in_transit)
            VALUES (:workspace, :id, :state, :activity, :x, :y, :text, :kind, :floor_id, :in_transit)
            ON DUPLICATE KEY UPDATE state=VALUES(state), activity=VALUES(activity),
            pos_x=VALUES(pos_x), pos_y=VALUES(pos_y), bubble_text=VALUES(bubble_text),
            bubble_kind=VALUES(bubble_kind), floor_id=VALUES(floor_id), in_transit=VALUES(in_transit)");
        $stmt->execute([
            ':workspace' => self::workspaceId(),
            ':id' => (string) $presence['agentId'], ':state' => (string) ($presence['state'] ?? 'idle'),
            ':activity' => $presence['activity'] ?? null, ':x' => (float) ($presence['x'] ?? 0),
            ':y' => (float) ($presence['y'] ?? 0), ':text' => $presence['bubbleText'] ?? null,
            ':kind' => $presence['bubbleKind'] ?? null,
            ':floor_id' => (int) ($presence['floorId'] ?? 1),
            ':in_transit' => !empty($presence['inTransit']) ? 1 : 0,
        ]);
    }

    public static function getPresence(): array
    {
        $db = self::connect();
        if (!$db) return [];
        $sql = 'SELECT workspace_id, agent_id, state, activity, pos_x, pos_y, bubble_text, bubble_kind, '
            . 'floor_id, in_transit, updated_at FROM kra_agent_presence WHERE '
            . self::workspacePredicate() . ' ORDER BY agent_id ASC';
        $rows = $db->query($sql)->fetchAll();
        // If legacy + claimed rows both exist briefly during migration, prefer current-workspace row.
        $byAgent = [];
        foreach ($rows as $row) {
            $agentId = (string) ($row['agent_id'] ?? '');
            if (!isset($byAgent[$agentId]) || (string) ($row['workspace_id'] ?? '') === self::workspaceId()) $byAgent[$agentId] = $row;
        }
        return array_values($byAgent);
    }

    public static function saveAgentEvent(array $event): void
    {
        $db = self::connect();
        if (!$db || empty($event['id']) || empty($event['type']) || empty($event['from'])) return;
        $stmt = $db->prepare("INSERT IGNORE INTO kra_agent_events
            (id, workspace_id, user_id, type, from_agent, to_agent, payload)
            VALUES (:id, :workspace, :user, :type, :from_agent, :to_agent, :payload)");
        $stmt->execute([
            ':id' => $event['id'],
            ':workspace' => (string) ($event['workspaceId'] ?? self::workspaceId()),
            ':user' => KraTenantContext::userId() !== '' ? KraTenantContext::userId() : null,
            ':type' => $event['type'],
            ':from_agent' => $event['from'],
            ':to_agent' => $event['to'] ?? null,
            ':payload' => json_encode($event['payload'] ?? [], JSON_UNESCAPED_SLASHES),
        ]);
    }

    public static function getAgentEvents(int $limit = 100): array
    {
        $db = self::connect();
        if (!$db) return [];
        $limit = max(1, min($limit, 500));
        $sql = "SELECT id, workspace_id, user_id, type, from_agent, to_agent, payload, created_at
                FROM kra_agent_events WHERE " . self::workspacePredicate() . " ORDER BY created_at DESC LIMIT {$limit}";
        $stmt = $db->query($sql);
        return array_reverse($stmt->fetchAll());
    }

    public static function saveAgent(array $agent): bool
    {
        $db = self::connect();
        if (!$db) return false;

        // The browser payload's `workspace` array describes Office/Creator
        // placement; tenant ownership always comes from the authenticated
        // request context and is never trusted from the client.
        $tenantWorkspaceId = self::workspaceId();
        $ownerUserId = KraTenantContext::workspaceOwnerId() !== '' ? KraTenantContext::workspaceOwnerId() : null;
        $sql = "INSERT INTO `kra_agents`
            (`id`, `owner_user_id`, `workspace_id`, `name`, `role`, `template_id`, `palette`, `appearance`, `engine`, `briefing`, `workspace`, `seat_x`, `seat_y`, `status`)
            VALUES (:id, :owner_user_id, :tenant_workspace, :name, :role, :template_id, :palette, :appearance, :engine, :briefing, :workspace, :seat_x, :seat_y, :status)
            ON DUPLICATE KEY UPDATE `owner_user_id`=COALESCE(`owner_user_id`, VALUES(`owner_user_id`)), `name`=VALUES(`name`), `role`=VALUES(`role`),
            `palette`=VALUES(`palette`), `appearance`=VALUES(`appearance`),
            `engine`=VALUES(`engine`), `briefing`=VALUES(`briefing`), `workspace`=VALUES(`workspace`),
            `seat_x`=VALUES(`seat_x`), `seat_y`=VALUES(`seat_y`),
            `status`=VALUES(`status`)";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':id' => $agent['id'],
            ':owner_user_id' => $ownerUserId,
            ':tenant_workspace' => $tenantWorkspaceId,
            ':name' => $agent['name'],
            ':role' => $agent['role'],
            ':template_id' => $agent['templateId'] ?? null,
            ':palette' => is_array($agent['palette'] ?? null) ? json_encode($agent['palette']) : ($agent['palette'] ?? null),
            ':appearance' => is_array($agent['appearance'] ?? null) ? json_encode($agent['appearance']) : null,
            ':engine' => is_array($agent['engine'] ?? null) ? json_encode($agent['engine']) : null,
            ':briefing' => is_array($agent['briefing'] ?? null) ? json_encode($agent['briefing']) : null,
            ':workspace' => is_array($agent['workspace'] ?? null) ? json_encode($agent['workspace']) : null,
            ':seat_x' => (float) ($agent['homeX'] ?? $agent['x'] ?? 0),
            ':seat_y' => (float) ($agent['homeY'] ?? $agent['y'] ?? 0),
            ':status' => $agent['status'] ?? 'standing by',
        ]);
        return true;
    }

    public static function getHiredAgents(): array
    {
        $db = self::connect();
        if (!$db) return [];

        $stmt = $db->query("SELECT * FROM `kra_agents` WHERE " . self::workspacePredicate() . " ORDER BY `created_at` ASC");
        $rows = $stmt->fetchAll();
        $agents = [];
        foreach ($rows as $row) {
            $agents[] = [
                'id' => $row['id'],
                'ownerUserId' => $row['owner_user_id'] ?? null,
                'workspaceId' => $row['workspace_id'] ?? self::workspaceId(),
                'name' => $row['name'],
                'role' => $row['role'],
                'templateId' => $row['template_id'],
                'x' => (float) $row['seat_x'],
                'y' => (float) $row['seat_y'],
                'homeX' => (float) $row['seat_x'],
                'homeY' => (float) $row['seat_y'],
                'status' => $row['status'],
                'badge' => 'badge-idle',
                'palette' => json_decode($row['palette'] ?: '{}', true) ?: [
                    'skin' => '#E8B98A', 'hair' => '#241A12', 'primary' => '#FF6B6B', 'accent' => '#FFF8E7'
                ],
                'appearance' => $row['appearance'] ? json_decode($row['appearance'], true) : null,
                'engine' => $row['engine'] ? json_decode($row['engine'], true) : null,
                'briefing' => $row['briefing'] ? json_decode($row['briefing'], true) : null,
                'workspace' => $row['workspace'] ? json_decode($row['workspace'], true) : null,
                'intro' => $row['name'] . ': Ready to contribute on Rama\'s floor.'
            ];
        }
        return $agents;
    }

    /**
     * JSON fallback for chat history so agent memory survives on hosts
     * without MySQL (fresh desktop installs). Tasks already persist this
     * way via KraTaskEngine; chat now behaves the same instead of silently
     * evaporating between messages.
     */
    private static function chatFallbackFile(): string
    {
        $dir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.temp';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        return $dir . DIRECTORY_SEPARATOR . 'chat-history.json';
    }

    private static function chatFallbackRead(): array
    {
        $path = self::chatFallbackFile();
        if (!is_file($path)) return [];
        $data = json_decode((string) @file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    private static function chatFallbackKey(string $channel): string
    {
        return self::workspaceId() . '|' . $channel;
    }

    private static function chatFallbackAppend(string $sender, string $message, string $channel): void
    {
        $handle = @fopen(self::chatFallbackFile(), 'c+');
        if ($handle === false) return;
        try {
            if (!flock($handle, LOCK_EX)) return;
            $raw = stream_get_contents($handle);
            $all = is_string($raw) ? json_decode($raw, true) : null;
            if (!is_array($all)) $all = [];
            $key = self::chatFallbackKey($channel);
            $rows = is_array($all[$key] ?? null) ? $all[$key] : [];
            $rows[] = [
                'sender' => $sender,
                'user_id' => KraTenantContext::userId() !== '' ? KraTenantContext::userId() : null,
                'workspace_id' => self::workspaceId(),
                'message' => $message,
                'channel' => $channel,
                'created_at' => date('Y-m-d H:i:s'),
            ];
            // Bounded like the SQL LIMIT paths: last 300 per workspace/channel.
            if (count($rows) > 300) $rows = array_slice($rows, -300);
            $all[$key] = array_values($rows);
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($all, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}');
            fflush($handle);
            flock($handle, LOCK_UN);
        } finally {
            fclose($handle);
        }
    }

    public static function logChat(string $sender, string $message, string $channel = 'office'): void
    {
        $db = self::connect();
        if (!$db) {
            self::chatFallbackAppend($sender, $message, $channel);
            return;
        }

        $stmt = $db->prepare(
            "INSERT INTO `kra_chat_history` (`sender`, `user_id`, `workspace_id`, `message`, `channel`) VALUES (:s, :u, :w, :m, :c)"
        );
        $stmt->execute([
            ':s' => $sender,
            ':u' => KraTenantContext::userId() !== '' ? KraTenantContext::userId() : null,
            ':w' => self::workspaceId(),
            ':m' => $message,
            ':c' => $channel,
        ]);
    }

    public static function getChatHistory(string $channel = 'office', int $limit = 50): array
    {
        $limit = max(1, min($limit, 100));
        $db = self::connect();
        if (!$db) {
            $all = self::chatFallbackRead();
            $rows = is_array($all[self::chatFallbackKey($channel)] ?? null) ? $all[self::chatFallbackKey($channel)] : [];
            if (KraTenantContext::canSeeLegacy()) {
                $legacy = is_array($all[$channel] ?? null) ? $all[$channel] : [];
                // Old fallback files keyed only by channel belong to the legacy owner.
                $rows = array_merge($legacy, $rows);
            }
            return array_slice($rows, -$limit);
        }
        $stmt = $db->prepare("SELECT `id`, `sender`, `user_id`, `workspace_id`, `message`, `channel`, `created_at`
            FROM `kra_chat_history`
            WHERE `channel` = :c AND " . self::workspacePredicate() . "
            ORDER BY `id` DESC
            LIMIT " . (int) $limit);
        $stmt->bindValue(':c', $channel, PDO::PARAM_STR);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        return array_reverse($rows);
    }

    public static function saveTask(array $task): void
    {
        $db = self::connect();
        if (!$db) return;
        $sql = "INSERT INTO kra_tasks
            (id, owner_user_id, workspace_id, project_id, project_root, context,
             agent_id, action_type, title, target_file, proposed_content, summary,
             status, approved_by, rejection_reason, created_at, executed_at,
             execution_provider, execution_output)
            VALUES (:id, :owner, :workspace, :project_id, :project_root, :context,
                    :agent, :type, :title, :target, :content, :summary,
                    :status, :approved, :reason, :created, :executed, :provider, :output)
            ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id), workspace_id=VALUES(workspace_id),
            project_id=VALUES(project_id), project_root=VALUES(project_root), context=VALUES(context),
            agent_id=VALUES(agent_id), action_type=VALUES(action_type),
            title=VALUES(title), target_file=VALUES(target_file), proposed_content=VALUES(proposed_content),
            summary=VALUES(summary), status=VALUES(status), approved_by=VALUES(approved_by),
            rejection_reason=VALUES(rejection_reason), executed_at=VALUES(executed_at),
            execution_provider=VALUES(execution_provider), execution_output=VALUES(execution_output)";
        $stmt = $db->prepare($sql);
        $created = (string) ($task['createdAt'] ?? gmdate(DATE_ATOM));
        $createdTs = strtotime($created);
        $executed = $task['executedAt'] ?? null;
        $executedTs = is_string($executed) && $executed !== '' ? strtotime($executed) : false;
        $stmt->execute([
            ':id' => $task['id'],
            ':owner' => (string) ($task['ownerUserId'] ?? KraTenantContext::workspaceOwnerId()) ?: null,
            ':workspace' => (string) ($task['workspaceId'] ?? self::workspaceId()),
            ':project_id' => (string) ($task['projectId'] ?? '') ?: null,
            ':project_root' => (string) ($task['projectRoot'] ?? '') ?: null,
            ':context' => isset($task['context']) ? json_encode($task['context'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
            ':agent' => $task['agentId'], ':type' => $task['actionType'],
            ':title' => $task['title'], ':target' => $task['targetFile'],
            ':content' => $task['proposedContent'], ':summary' => $task['summary'],
            ':status' => $task['status'], ':approved' => $task['approvedBy'] ?? null,
            ':reason' => $task['rejectionReason'] ?? null,
            ':created' => $createdTs !== false ? gmdate('Y-m-d H:i:s', $createdTs) : gmdate('Y-m-d H:i:s'),
            ':executed' => $executedTs !== false ? gmdate('Y-m-d H:i:s', $executedTs) : null,
            ':provider' => $task['execution']['provider'] ?? null,
            ':output' => isset($task['execution'])
                ? json_encode($task['execution'], JSON_UNESCAPED_SLASHES)
                : null,
        ]);
    }

    private static function decodeExecution(?string $provider, ?string $output): ?array
    {
        if (empty($provider)) {
            return null;
        }
        $decoded = json_decode((string) $output, true);
        if (is_array($decoded)) {
            return $decoded;
        }
        // Backward compatibility for execution rows stored before Phase 16.
        return ['provider' => $provider, 'output' => $output ?? ''];
    }

    private static function mapTaskRow(array $row): array
    {
        $context = isset($row['context']) && is_string($row['context']) ? json_decode($row['context'], true) : null;
        return [
            'id' => $row['id'],
            'ownerUserId' => $row['owner_user_id'] ?? null,
            'workspaceId' => $row['workspace_id'] ?? self::workspaceId(),
            'projectId' => $row['project_id'] ?? null,
            'projectRoot' => $row['project_root'] ?? null,
            'context' => is_array($context) ? $context : ['scope' => 'office', 'workflowId' => '', 'workflowTitle' => '', 'workflowNodeId' => ''],
            'agentId' => $row['agent_id'],
            'actionType' => $row['action_type'], 'title' => $row['title'],
            'targetFile' => $row['target_file'], 'proposedContent' => $row['proposed_content'],
            'summary' => $row['summary'], 'status' => $row['status'],
            'approvedBy' => $row['approved_by'], 'rejectionReason' => $row['rejection_reason'],
            'createdAt' => $row['created_at'], 'executedAt' => $row['executed_at'],
            'execution' => self::decodeExecution(
                $row['execution_provider'] ?? null,
                $row['execution_output'] ?? null
            ),
        ];
    }

    public static function getTasks(): array
    {
        $db = self::connect();
        if (!$db) return [];
        $rows = $db->query('SELECT * FROM kra_tasks WHERE ' . self::workspacePredicate() . ' ORDER BY created_at ASC')->fetchAll();
        return array_map([self::class, 'mapTaskRow'], $rows);
    }

    /** Internal storage-only read used by KraTaskEngine to avoid overwriting other workspaces in its JSON mirror. Never expose directly via API. */
    public static function getTasksForStorage(): array
    {
        $db = self::connect();
        if (!$db) return [];
        $rows = $db->query('SELECT * FROM kra_tasks ORDER BY created_at ASC')->fetchAll();
        return array_map([self::class, 'mapTaskRow'], $rows);
    }

    public static function saveMemoryNote(array $note): void
    {
        $db = self::connect();
        if (!$db) return;
        $stmt = $db->prepare('INSERT INTO kra_memory_notes
            (id, workspace_id, user_id, channel, kind, title, note_path, source_hash, summary, tags)
            VALUES (:id, :workspace, :user, :channel, :kind, :title, :path, :hash, :summary, :tags)
            ON DUPLICATE KEY UPDATE title=VALUES(title), note_path=VALUES(note_path), summary=VALUES(summary), tags=VALUES(tags)');
        $stmt->execute([
            ':id' => (string) ($note['id'] ?? ('mem_' . bin2hex(random_bytes(10)))),
            ':workspace' => (string) ($note['workspaceId'] ?? self::workspaceId()),
            ':user' => KraTenantContext::userId() !== '' ? KraTenantContext::userId() : null,
            ':channel' => substr((string) ($note['channel'] ?? 'office'), 0, 80),
            ':kind' => substr((string) ($note['kind'] ?? 'conversation'), 0, 40),
            ':title' => substr((string) ($note['title'] ?? 'KRA Memory'), 0, 255),
            ':path' => (string) ($note['notePath'] ?? $note['path'] ?? ''),
            ':hash' => (string) ($note['sourceHash'] ?? hash('sha256', (string) ($note['notePath'] ?? ''))),
            ':summary' => (string) ($note['summary'] ?? ''),
            ':tags' => json_encode(array_values((array) ($note['tags'] ?? [])), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);
    }

    public static function getMemoryNotes(int $limit = 50): array
    {
        $db = self::connect();
        if (!$db) return [];
        $limit = max(1, min(200, $limit));
        $rows = $db->query('SELECT * FROM kra_memory_notes WHERE ' . self::workspacePredicate() . " ORDER BY created_at DESC LIMIT {$limit}")->fetchAll();
        return array_map(static function (array $row): array {
            $tags = isset($row['tags']) && is_string($row['tags']) ? json_decode($row['tags'], true) : [];
            return [
                'id' => $row['id'], 'workspaceId' => $row['workspace_id'], 'userId' => $row['user_id'],
                'channel' => $row['channel'], 'kind' => $row['kind'], 'title' => $row['title'],
                'notePath' => $row['note_path'], 'sourceHash' => $row['source_hash'],
                'summary' => $row['summary'], 'tags' => is_array($tags) ? $tags : [], 'createdAt' => $row['created_at'],
            ];
        }, $rows);
    }

    public static function recordUsage(string $eventType, int $quantity = 1, array $metadata = []): void
    {
        try {
            $db = self::connect();
            if (!$db) return;
            $db->prepare('INSERT INTO kra_usage_events (workspace_id, user_id, event_type, quantity, metadata)
                VALUES (:workspace, :user, :type, :qty, :meta)')
                ->execute([
                    ':workspace' => self::workspaceId(),
                    ':user' => KraTenantContext::userId() !== '' ? KraTenantContext::userId() : null,
                    ':type' => substr($eventType, 0, 80),
                    ':qty' => max(1, $quantity),
                    ':meta' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ]);
        } catch (Throwable) {
            // Usage analytics must never break the user's actual work.
        }
    }

    /**
     * Sum of one usage event for the active workspace in the current calendar
     * month. The cap keeps quota checks cheap: callers only need to know
     * whether the plan ceiling has been reached.
     */
    public static function usageCount(string $eventType, int $cap = 10000): int
    {
        try {
            $db = self::connect();
            if (!$db) return 0;
            $workspaceId = self::workspaceId();
            $userId = KraTenantContext::userId();
            if ($workspaceId !== null && $workspaceId !== '') {
                $stmt = $db->prepare("SELECT COALESCE(SUM(quantity),0) AS total FROM kra_usage_events
                    WHERE workspace_id = :workspace AND event_type = :type
                    AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')");
                $stmt->execute([':workspace' => $workspaceId, ':type' => substr($eventType, 0, 80)]);
            } elseif ($userId !== '') {
                $stmt = $db->prepare("SELECT COALESCE(SUM(quantity),0) AS total FROM kra_usage_events
                    WHERE user_id = :user AND event_type = :type
                    AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')");
                $stmt->execute([':user' => $userId, ':type' => substr($eventType, 0, 80)]);
            } else {
                return 0;
            }
            $total = (int) ($stmt->fetchColumn() ?: 0);
            return min(max(0, $cap), $total);
        } catch (Throwable) {
            return 0;
        }
    }
}
