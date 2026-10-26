<?php
declare(strict_types=1);

final class KraAgentRegistry
{
    public static function all(): array
    {
        return [
            'rama' => [
                'id' => 'rama',
                'name' => 'Rama',
                'title' => 'Executive Boss & Lead Auditor',
                'role' => 'Supervisor',
                'desk' => 'Desk 01 (Corner Office)',
                'badge' => 'badge-boss',
                'capabilities' => ['work-audit', 'executive-verdict', 'agent-delegation'],
                'spec' => 'agents/rama.agent.json',
            ],
            'creator' => [
                'id' => 'creator',
                'name' => 'Budi',
                'title' => 'Scaffolding & Module Builder',
                'role' => 'Creator',
                'desk' => 'Desk 02 (Bullpen North)',
                'badge' => 'badge-active-sub',
                'capabilities' => ['scaffold', 'boilerplate-gen', 'file-creation'],
                'spec' => 'agents/creator.agent.json',
            ],
            'modifier' => [
                'id' => 'modifier',
                'name' => 'Maya',
                'title' => 'Refactoring & Bugfix Specialist',
                'role' => 'Modifier',
                'desk' => 'Desk 03 (Bullpen East)',
                'badge' => 'badge-active-sub',
                'capabilities' => ['targeted-edit', 'refactor', 'diff-generation'],
                'spec' => 'agents/modifier.agent.json',
            ],
            'auditor' => [
                'id' => 'auditor',
                'name' => 'Dimas',
                'title' => 'Code Quality & Security Reviewer',
                'role' => 'Auditor',
                'desk' => 'Desk 04 (Bullpen South)',
                'badge' => 'badge-active-sub',
                'capabilities' => ['security-scan', 'quality-check', 'debt-analysis'],
                'spec' => 'agents/auditor.agent.json',
            ],
            'ops' => [
                'id' => 'ops',
                'name' => 'Siti',
                'title' => 'Filesystem & Workspace Custodian',
                'role' => 'Ops / Dir',
                'desk' => 'Desk 05 (Bullpen West)',
                'badge' => 'badge-idle',
                'capabilities' => ['dir-cleanup', 'backup', 'structure-validation'],
                'spec' => 'agents/ops.agent.json',
            ],
        ];
    }

    public static function get(string $id): ?array
    {
        $all = self::all();
        return $all[$id] ?? null;
    }
}
