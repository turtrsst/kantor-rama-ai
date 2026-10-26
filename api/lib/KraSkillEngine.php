<?php
declare(strict_types=1);

require_once __DIR__ . '/KraSkillLock.php';
require_once __DIR__ . '/KraSkillHub.php';

/**
 * KRA Skill Engine
 *
 * Resolves the active skill family per agent and per task, then produces a
 * compact runtime digest for the model prompt. Full rule text stays on disk
 * so prompts stay small and the upstream sources remain the single truth.
 *
 * Governance: a skill only activates when KraSkillLock approves its current
 * checksum. Drift or an unapproved import is withheld automatically.
 */
final class KraSkillEngine
{
    private const CORE_SKILL = 'antislop';

    private const AGENT_SKILLS = [
        'rama' => ['antislop', 'antislop-copywriting'],
        'budi' => ['antislop', 'antislop-code', 'clean-scaffolder'],
        'maya' => ['antislop', 'antislop-code', 'surgical-refactor'],
        'dimas' => ['antislop', 'security-threat-model', 'differential-review'],
        'siti' => ['antislop', 'antislop-copywriting', 'ops-memory-steward'],
    ];

    private const VISUAL_SKILLS = ['antislop-ui', 'antislop-human', 'antislop-layoutmobile'];

    private const VISUAL_KEYWORDS = [
        'frontend', 'front-end', 'layout', 'css', 'html', 'design', 'desain',
        'sprite', 'canvas', 'mobile', 'responsive', 'accessibility', 'contrast',
        'copywriting', 'landing', 'hero', 'navbar', 'typography', 'palette',
        'button', 'modal', 'dashboard', 'interface', 'antarmuka', 'warna',
    ];

    public static function root(): string
    {
        return KraSkillLock::root();
    }

    public static function catalog(): array
    {
        $dirs = glob(self::root() . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) ?: [];
        $skills = [];
        foreach ($dirs as $dir) {
            $file = $dir . DIRECTORY_SEPARATOR . 'SKILL.md';
            if (!is_file($file)) {
                continue;
            }
            $id = basename($dir);
            $content = (string) @file_get_contents($file);
            $hash = hash('sha256', $content);
            $meta = self::parseFrontmatter($content);
            $source = self::readSource($dir);
            $lock = KraSkillLock::entry($id);
            $drift = $lock !== [] && (string) ($lock['sha256'] ?? '') !== $hash;
            $approved = KraSkillLock::isApproved($id);
            $skills[$id] = [
                'id' => $id,
                'name' => $meta['name'] !== '' ? $meta['name'] : $id,
                'description' => mb_substr($meta['description'], 0, 240),
                'bytes' => strlen($content),
                'source' => (string) ($source['repo'] ?? 'local'),
                'path' => (string) ($source['path'] ?? ''),
                'sha256' => (string) ($source['sha256'] ?? ''),
                'reviewState' => (string) ($source['reviewState'] ?? 'local'),
                'ref' => (string) ($lock['ref'] ?? ''),
                'commit' => (string) ($lock['commit'] ?? ''),
                'status' => (string) ($lock['status'] ?? 'unlocked'),
                'approved' => $approved,
                'drift' => $drift,
            ];
        }
        ksort($skills);
        return $skills;
    }

    public static function agents(): array
    {
        return KraSkillHub::agents();
    }

    public static function hubState(): array
    {
        return KraSkillHub::state(self::catalog(), self::AGENT_SKILLS);
    }

    public static function route(string $agentId, string $message): array
    {
        $requested = self::requestedFor($agentId, $message);
        $active = [];
        $withheld = [];
        foreach ($requested as $skill) {
            if (KraSkillLock::isApproved($skill)) {
                $active[] = $skill;
            } else {
                $withheld[] = $skill;
            }
        }
        return [
            'requested' => $requested,
            'active' => $active,
            'withheld' => $withheld,
            'mode' => self::mode($message),
        ];
    }

    public static function activeFor(string $agentId, string $message): array
    {
        return self::route($agentId, $message)['active'];
    }

    public static function mode(string $message): string
    {
        $lower = strtolower($message);
        $afterSignals = ['audit', 'review', 'bersihkan', 'cleanup', 'clean up', 'existing',
            'sudah ada', 'perbaiki yang ada', 'refactor output', 'hapus slop'];
        foreach ($afterSignals as $signal) {
            if (str_contains($lower, $signal)) {
                return 'after';
            }
        }
        return 'during';
    }

    public static function digest(string $agentId, string $message, array $limitTo = []): string
    {
        $route = self::route($agentId, $message);
        $active = $route['active'];
        if ($limitTo !== []) {
            $active = array_intersect($active, $limitTo);
        }
        $list = $active !== [] ? implode(', ', $active) : 'none (governance hold or router limit)';
        $lines = [
            'ANTISLOP ACTIVE: ' . $route['mode'] . ' (KRA default).',
            'Active skills: ' . $list . '.',
        ];
        if ($route['withheld'] !== []) {
            $lines[] = 'Governance hold: ' . implode(', ', $route['withheld'])
                . ' awaiting lock approval.';
        }
        $lines = array_merge($lines, [
            'Hard gate: no em dash; no unsourced numbers or testimonials; no dead controls or links;',
            'WCAG AA contrast; mobile without overflow; empty, loading, and error states; real content',
            'or an honest placeholder; no fabricated claims; no AI comment that restates the code.',
            'Purpose gate: gradients, glassmorphism, glow, pills, and badges need a written reason.',
            self::gate($message),
            'Full rules: resources/skills/antislop/SKILL.md',
        ]);
        return implode("\n", $lines);
    }

    public static function gate(string $message): string
    {
        if (!self::isVisualTask($message)) {
            return 'Delivery gate: state test or audit evidence, or say "not run" and why.';
        }
        return 'Delivery gate: report PASS or FAIL for Hard Gate, Purpose-Gate, Liveliness, and '
            . 'Quality Locks, with one evidence line each. Any FAIL blocks delivery.';
    }

    public static function read(string $id, bool $requireApproval = true): ?string
    {
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $id)) {
            return null;
        }
        if ($requireApproval && !KraSkillLock::isApproved($id)) {
            return null;
        }
        $root = realpath(self::root());
        $file = self::root() . DIRECTORY_SEPARATOR . $id . DIRECTORY_SEPARATOR . 'SKILL.md';
        $real = realpath($file);
        if ($root === false || $real === false) {
            return null;
        }
        if (!str_starts_with(strtolower($real), strtolower($root))) {
            return null;
        }
        return (string) @file_get_contents($real);
    }

    private static function requestedFor(string $agentId, string $message): array
    {
        $normalized = KraSkillHub::normalizeAgent($agentId) ?? strtolower(trim($agentId));
        $base = self::AGENT_SKILLS[$normalized] ?? null;
        if ($base === null) {
            $base = [self::CORE_SKILL];
            if (class_exists('KraTemplateRegistry')) {
                $template = KraTemplateRegistry::getTemplateForAgent($agentId);
                if ($template !== null) {
                    foreach ((array) ($template['skills'] ?? []) as $s) {
                        $clean = (string) preg_replace('/^skill:/', '', trim((string) $s));
                        if ($clean !== '' && !in_array($clean, $base, true)) {
                            $base[] = $clean;
                        }
                    }
                }
            }
        }
        if (self::isVisualTask($message)) {
            foreach (self::VISUAL_SKILLS as $skill) {
                if (!in_array($skill, $base, true)) {
                    $base[] = $skill;
                }
            }
        }

        $overrides = KraSkillHub::overridesFor($normalized);
        $skillMap = [];
        foreach ($base as $skill) {
            $skillMap[$skill] = [
                'enabled' => true,
                'priority' => 100,
            ];
        }
        foreach ($overrides as $skill => $meta) {
            $skillMap[$skill] = [
                'enabled' => (bool) ($meta['enabled'] ?? false),
                'priority' => (int) ($meta['priority'] ?? 100),
            ];
        }

        $skillMap[self::CORE_SKILL]['enabled'] = true;
        $skillMap[self::CORE_SKILL]['priority'] = 1;

        $filtered = [];
        foreach ($skillMap as $skill => $conf) {
            if ($conf['enabled']) {
                $filtered[] = [
                    'id' => $skill,
                    'priority' => $conf['priority'],
                ];
            }
        }

        usort($filtered, static function (array $a, array $b): int {
            return $a['priority'] <=> $b['priority'] ?: strcmp($a['id'], $b['id']);
        });

        return array_column($filtered, 'id');
    }

    private static function isVisualTask(string $message): bool
    {
        $lower = strtolower($message);
        if (preg_match('/\b(ui|ux)\b/', $lower) === 1) {
            return true;
        }
        foreach (self::VISUAL_KEYWORDS as $keyword) {
            if (str_contains($lower, $keyword)) {
                return true;
            }
        }
        return false;
    }

    private static function parseFrontmatter(string $content): array
    {
        $meta = ['name' => '', 'description' => ''];
        if (preg_match('/^---\s*\R(.*?)\R---/s', $content, $match) !== 1) {
            return $meta;
        }
        $block = $match[1];
        if (preg_match('/^name:\s*(.+)$/m', $block, $name) === 1) {
            $meta['name'] = trim($name[1], " \t\"'");
        }
        if (preg_match('/^description:\s*\|\s*\R\s*(.+)$/m', $block, $desc) === 1) {
            $meta['description'] = trim($desc[1]);
        } elseif (preg_match('/^description:\s*(.+)$/m', $block, $desc) === 1) {
            $meta['description'] = trim($desc[1], " \t\"'");
        }
        return $meta;
    }

    private static function readSource(string $dir): array
    {
        $file = $dir . DIRECTORY_SEPARATOR . 'SOURCE.json';
        if (!is_file($file)) {
            return [];
        }
        $decoded = json_decode((string) @file_get_contents($file), true);
        return is_array($decoded) ? $decoded : [];
    }
}
