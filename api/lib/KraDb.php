<?php
declare(strict_types=1);

final class KraDb
{
    private static ?PDO $pdo = null;

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
            (agent_id, state, activity, pos_x, pos_y, bubble_text, bubble_kind, floor_id, in_transit)
            VALUES (:id, :state, :activity, :x, :y, :text, :kind, :floor_id, :in_transit)
            ON DUPLICATE KEY UPDATE state=VALUES(state), activity=VALUES(activity),
            pos_x=VALUES(pos_x), pos_y=VALUES(pos_y), bubble_text=VALUES(bubble_text),
            bubble_kind=VALUES(bubble_kind), floor_id=VALUES(floor_id), in_transit=VALUES(in_transit)");
        $stmt->execute([
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
        $sql = 'SELECT agent_id, state, activity, pos_x, pos_y, bubble_text, bubble_kind, '
            . 'floor_id, in_transit, updated_at FROM kra_agent_presence ORDER BY agent_id ASC';
        return $db->query($sql)->fetchAll();
    }

    public static function saveAgentEvent(array $event): void
    {
        $db = self::connect();
        if (!$db || empty($event['id']) || empty($event['type']) || empty($event['from'])) return;
        $stmt = $db->prepare("INSERT IGNORE INTO kra_agent_events
            (id, type, from_agent, to_agent, payload)
            VALUES (:id, :type, :from_agent, :to_agent, :payload)");
        $stmt->execute([
            ':id' => $event['id'],
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
        $sql = "SELECT id, type, from_agent, to_agent, payload, created_at
                FROM kra_agent_events ORDER BY created_at DESC LIMIT {$limit}";
        $stmt = $db->query($sql);
        return array_reverse($stmt->fetchAll());
    }

    public static function saveAgent(array $agent): void
    {
        $db = self::connect();
        if (!$db) return;

        $sql = "INSERT INTO `kra_agents`
            (`id`, `name`, `role`, `template_id`, `palette`, `appearance`, `engine`, `briefing`, `workspace`, `seat_x`, `seat_y`, `status`)
            VALUES (:id, :name, :role, :template_id, :palette, :appearance, :engine, :briefing, :workspace, :seat_x, :seat_y, :status)
            ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `role`=VALUES(`role`),
            `palette`=VALUES(`palette`), `appearance`=VALUES(`appearance`),
            `engine`=VALUES(`engine`), `briefing`=VALUES(`briefing`), `workspace`=VALUES(`workspace`),
            `seat_x`=VALUES(`seat_x`), `seat_y`=VALUES(`seat_y`),
            `status`=VALUES(`status`)";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':id' => $agent['id'],
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
    }

    public static function getHiredAgents(): array
    {
        $db = self::connect();
        if (!$db) return [];

        $stmt = $db->query("SELECT * FROM `kra_agents` ORDER BY `created_at` ASC");
        $rows = $stmt->fetchAll();
        $agents = [];
        foreach ($rows as $row) {
            $agents[] = [
                'id' => $row['id'],
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

    public static function logChat(string $sender, string $message, string $channel = 'office'): void
    {
        $db = self::connect();
        if (!$db) return;

        $stmt = $db->prepare(
            "INSERT INTO `kra_chat_history` (`sender`, `message`, `channel`) VALUES (:s, :m, :c)"
        );
        $stmt->execute([':s' => $sender, ':m' => $message, ':c' => $channel]);
    }

    public static function getChatHistory(string $channel = 'office', int $limit = 50): array
    {
        $db = self::connect();
        if (!$db) return [];

        $limit = max(1, min($limit, 100));
        $stmt = $db->prepare("SELECT `id`, `sender`, `message`, `channel`, `created_at`
            FROM `kra_chat_history`
            WHERE `channel` = :c
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
            (id, agent_id, action_type, title, target_file, proposed_content, summary,
             status, approved_by, rejection_reason, created_at, executed_at,
             execution_provider, execution_output)
            VALUES (:id, :agent, :type, :title, :target, :content, :summary,
                    :status, :approved, :reason, :created, :executed, :provider, :output)
            ON DUPLICATE KEY UPDATE agent_id=VALUES(agent_id), action_type=VALUES(action_type),
            title=VALUES(title), target_file=VALUES(target_file), proposed_content=VALUES(proposed_content),
            summary=VALUES(summary), status=VALUES(status), approved_by=VALUES(approved_by),
            rejection_reason=VALUES(rejection_reason), executed_at=VALUES(executed_at),
            execution_provider=VALUES(execution_provider), execution_output=VALUES(execution_output)";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':id' => $task['id'], ':agent' => $task['agentId'], ':type' => $task['actionType'],
            ':title' => $task['title'], ':target' => $task['targetFile'],
            ':content' => $task['proposedContent'], ':summary' => $task['summary'],
            ':status' => $task['status'], ':approved' => $task['approvedBy'] ?? null,
            ':reason' => $task['rejectionReason'] ?? null, ':created' => $task['createdAt'],
            ':executed' => $task['executedAt'] ?? null,
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

    public static function getTasks(): array
    {
        $db = self::connect();
        if (!$db) return [];
        $rows = $db->query('SELECT * FROM kra_tasks ORDER BY created_at ASC')->fetchAll();
        return array_map(static function (array $row): array {
            return [
                'id' => $row['id'], 'agentId' => $row['agent_id'],
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
        }, $rows);
    }
}
