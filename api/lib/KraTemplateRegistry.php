<?php
declare(strict_types=1);

final class KraTemplateRegistry
{
    private static function getResourceRoot(): string
    {
        $local = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'resources';
        if (is_dir($local)) {
            return $local;
        }

        $env = getenv('MUNDER_DIFFLIN_RESOURCES');
        if ($env && is_dir($env)) {
            return $env;
        }

        foreach (range('A', 'Z') as $letter) {
            $candidate = $letter . ':' . DIRECTORY_SEPARATOR . 'munder difflin'
                . DIRECTORY_SEPARATOR . 'resources';
            if (is_dir($candidate)) {
                return $candidate;
            }
        }

        return '';
    }

    public static function listTemplates(): array
    {
        $resRoot = self::getResourceRoot();
        if ($resRoot === '') {
            return [];
        }

        $templateDir = $resRoot . DIRECTORY_SEPARATOR . 'agent-templates';
        if (!is_dir($templateDir)) {
            return [];
        }

        $templates = [];
        $files = glob($templateDir . DIRECTORY_SEPARATOR . '*.agent.json') ?: [];
        foreach ($files as $filePath) {
            $raw = @file_get_contents($filePath);
            if ($raw === false) {
                continue;
            }
            $data = json_decode($raw, true);
            if (!is_array($data) || empty($data['name'])) {
                continue;
            }

            $id = basename($filePath, '.agent.json');
            $configs = $data['configs'] ?? [];

            $templates[$id] = [
                'id' => $id,
                'name' => $data['name'],
                'description' => $data['description'] ?? '',
                'role' => $configs['role'] ?? ($data['description'] ?? $data['name']),
                'goal' => $configs['goal'] ?? '',
                'accent' => $configs['accent'] ?? 'slate',
                'character' => $configs['character'] ?? '',
                'capabilities' => $configs['capabilities'] ?? [],
                'connections' => $configs['connections'] ?? [],
                'skills' => $data['skills']['catalog'] ?? [],
            ];
        }

        uasort($templates, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        return $templates;
    }

    public static function getTemplate(string $templateId): ?array
    {
        $templates = self::listTemplates();
        return $templates[strtolower(trim($templateId))] ?? null;
    }

    public static function getTemplateForAgent(string $agentId): ?array
    {
        $agentId = strtolower(trim($agentId));
        $template = self::getTemplate($agentId);
        if ($template !== null) return $template;
        if (class_exists('KraDb')) {
            foreach (KraDb::getHiredAgents() as $agent) {
                if (strtolower((string) ($agent['id'] ?? '')) === $agentId) {
                    return self::getTemplate((string) ($agent['templateId'] ?? ''));
                }
            }
        }
        return null;
    }

    public static function promptForAgent(string $agentId): string
    {
        $template = self::getTemplateForAgent($agentId);
        if ($template === null) return '';
        return "Template role: {$template['role']}\n"
            . "Template goal: {$template['goal']}\n"
            . "Capabilities: " . implode(', ', $template['capabilities']) . "\n"
            . "Connections: " . implode(', ', $template['connections']) . "\n"
            . "Approved template skills: " . implode(', ', $template['skills']);
    }

    public static function listSkills(): array
    {
        $resRoot = self::getResourceRoot();
        if ($resRoot === '') {
            return [];
        }

        $skillDir = $resRoot . DIRECTORY_SEPARATOR . 'skills';
        if (!is_dir($skillDir)) {
            return [];
        }

        $skills = [];
        $entries = glob($skillDir . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) ?: [];
        foreach ($entries as $dir) {
            $skillFile = $dir . DIRECTORY_SEPARATOR . 'SKILL.md';
            if (!is_file($skillFile)) {
                continue;
            }
            $content = (string) @file_get_contents($skillFile);
            $name = basename($dir);
            $description = '';
            if (preg_match('/' . 'description:' . '\s*\|\s*\n\s*([^\n\r]+)/', $content, $m)) {
                $description = trim($m[1]);
            } elseif (preg_match('/' . 'description:' . '\s*([^\n\r]+)/', $content, $m)) {
                $description = trim(trim($m[1]), '"\'');
            }
            $source = [];
            $sourceFile = $dir . DIRECTORY_SEPARATOR . 'SOURCE.json';
            if (is_file($sourceFile)) {
                $decoded = json_decode((string) @file_get_contents($sourceFile), true);
                if (is_array($decoded)) {
                    $source = $decoded;
                }
            }
            $skills[$name] = [
                'id' => $name,
                'name' => $name,
                'description' => $description,
                'source' => (string) ($source['repo'] ?? 'local'),
                'sha256' => (string) ($source['sha256'] ?? ''),
            ];
        }

        return $skills;
    }
}
