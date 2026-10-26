<?php
declare(strict_types=1);

require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraSkillLock.php';

/**
 * Approval-gated persistence for each officer's approved skill configuration.
 * This never approves or unlocks a skill; the lockfile remains authoritative.
 */
final class KraSkillHub
{
    private const AGENT_ALIASES = [
        'rama' => 'rama',
        'budi' => 'budi',
        'creator' => 'budi',
        'maya' => 'maya',
        'modifier' => 'maya',
        'dimas' => 'dimas',
        'auditor' => 'dimas',
        'siti' => 'siti',
        'ops' => 'siti',
    ];

    private const AGENT_NAMES = [
        'rama' => 'Rama',
        'budi' => 'Budi',
        'maya' => 'Maya',
        'dimas' => 'Dimas',
        'siti' => 'Siti',
    ];

    public static function normalizeAgent(string $agentId): ?string
    {
        $id = strtolower(trim($agentId));
        return self::AGENT_ALIASES[$id] ?? null;
    }

    public static function agents(): array
    {
        $agents = [];
        foreach (self::AGENT_NAMES as $id => $name) {
            $agents[] = ['id' => $id, 'name' => $name];
        }
        return $agents;
    }

    public static function overridesFor(string $agentId): array
    {
        $agentId = self::normalizeAgent($agentId);
        if ($agentId === null) {
            return [];
        }
        $db = KraDb::connect();
        if ($db === null) {
            return [];
        }
        $stmt = $db->prepare('SELECT skill_id, enabled, priority, updated_by, updated_at
            FROM kra_agent_skills WHERE agent_id = :agent ORDER BY priority ASC, skill_id ASC');
        $stmt->execute([':agent' => $agentId]);
        $overrides = [];
        foreach ($stmt->fetchAll() as $row) {
            $overrides[(string) $row['skill_id']] = [
                'enabled' => (bool) $row['enabled'],
                'priority' => (int) $row['priority'],
                'updatedBy' => (string) $row['updated_by'],
                'updatedAt' => (string) $row['updated_at'],
            ];
        }
        return $overrides;
    }

    public static function state(array $catalog, array $defaults): array
    {
        $agents = [];
        foreach (self::AGENT_NAMES as $agentId => $name) {
            $overrides = self::overridesFor($agentId);
            $defaultSkills = $defaults[$agentId] ?? [];
            $skills = [];
            foreach ($catalog as $skillId => $skill) {
                $defaultEnabled = in_array($skillId, $defaultSkills, true);
                $override = $overrides[$skillId] ?? null;
                $skills[] = [
                    'id' => $skillId,
                    'name' => (string) ($skill['name'] ?? $skillId),
                    'approved' => ($skill['approved'] ?? false) === true,
                    'defaultEnabled' => $defaultEnabled,
                    'enabled' => $override['enabled'] ?? $defaultEnabled,
                    'priority' => $override['priority'] ?? 100,
                    'updatedBy' => $override['updatedBy'] ?? null,
                    'updatedAt' => $override['updatedAt'] ?? null,
                ];
            }
            usort($skills, static fn(array $a, array $b): int =>
                $a['priority'] <=> $b['priority'] ?: strcmp($a['id'], $b['id'])
            );
            $agents[] = ['id' => $agentId, 'name' => $name, 'skills' => $skills];
        }
        return ['agents' => $agents];
    }

    public static function preview(array $payload, array $catalog): array
    {
        $change = self::validateChange($payload, $catalog);
        if (isset($change['error'])) {
            return ['ok' => false, 'error' => $change['error']];
        }
        $verb = $change['enabled'] ? 'enable' : 'disable';
        return [
            'ok' => true,
            'requiresApproval' => true,
            'proposal' => $change + [
                'id' => 'skill_' . bin2hex(random_bytes(6)),
                'summary' => 'Request to ' . $verb . ' ' . $change['skillId'] . ' for '
                    . self::AGENT_NAMES[$change['agentId']] . '.',
            ],
        ];
    }

    public static function apply(array $payload, array $catalog): array
    {
        if (($payload['approved'] ?? false) !== true) {
            return ['ok' => false, 'error' => 'Skill changes require explicit approval.'];
        }
        $change = self::validateChange($payload, $catalog);
        if (isset($change['error'])) {
            return ['ok' => false, 'error' => $change['error']];
        }
        $db = KraDb::connect();
        if ($db === null) {
            return ['ok' => false, 'error' => 'Skill Hub requires an online database.'];
        }
        $updatedBy = trim((string) ($payload['updatedBy'] ?? 'Boss/User'));
        $updatedBy = $updatedBy !== '' ? mb_substr($updatedBy, 0, 64) : 'Boss/User';
        $stmt = $db->prepare('INSERT INTO kra_agent_skills
            (agent_id, skill_id, enabled, priority, updated_by)
            VALUES (:agent, :skill, :enabled, :priority, :updated_by)
            ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), priority = VALUES(priority),
                updated_by = VALUES(updated_by)');
        $stmt->execute([
            ':agent' => $change['agentId'],
            ':skill' => $change['skillId'],
            ':enabled' => $change['enabled'] ? 1 : 0,
            ':priority' => $change['priority'],
            ':updated_by' => $updatedBy,
        ]);
        self::logChange($change, $updatedBy);
        return ['ok' => true, 'change' => $change, 'updatedBy' => $updatedBy];
    }

    private static function validateChange(array $payload, array $catalog): array
    {
        $agentId = self::normalizeAgent((string) ($payload['agentId'] ?? ''));
        $skillId = trim((string) ($payload['skillId'] ?? ''));
        if ($agentId === null) {
            return ['error' => 'Unknown agent id.'];
        }
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $skillId) || !isset($catalog[$skillId])) {
            return ['error' => 'Unknown skill id.'];
        }
        if (!KraSkillLock::isApproved($skillId)) {
            return ['error' => 'Only lock-approved skills may be configured.'];
        }
        if ($skillId === 'antislop' && empty($payload['enabled'])) {
            return ['error' => 'The core antislop skill is mandatory and cannot be disabled.'];
        }
        $priority = filter_var($payload['priority'] ?? 100, FILTER_VALIDATE_INT);
        if ($priority === false || $priority < 1 || $priority > 10000) {
            return ['error' => 'Priority must be an integer from 1 to 10000.'];
        }
        return [
            'agentId' => $agentId,
            'skillId' => $skillId,
            'enabled' => (bool) ($payload['enabled'] ?? false),
            'priority' => $priority,
        ];
    }

    private static function logChange(array $change, string $updatedBy): void
    {
        KraDb::saveAgentEvent([
            'id' => 'evt_skill_' . bin2hex(random_bytes(8)),
            'type' => 'skill.toggle.applied',
            'from' => $updatedBy,
            'to' => $change['agentId'],
            'payload' => $change,
        ]);
    }
}
