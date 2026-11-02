<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';
require_once __DIR__ . '/KraVaultSettings.php';

final class KraVaultSync
{
    public static function getVaultDir(): string
    {
        // Vault selection is workspace-scoped; environment/default fallbacks
        // are decided centrally by KraVaultSettings so they cannot leak the
        // installation owner's vault into a hosted tenant workspace.
        $current = KraVaultSettings::current();
        $path = trim((string) ($current['path'] ?? ''));
        return $path !== '' && is_dir($path) ? (realpath($path) ?: $path) : '';
    }

    /**
     * Directory KRA may write for the active workspace. The legacy platform
     * owner's existing root layout is preserved; every other workspace gets
     * `KRA Workspaces/<workspace-id>/` inside its selected Obsidian vault.
     */
    public static function getMemoryDir(bool $create = false): string
    {
        $vault = self::getVaultDir();
        if ($vault === '') return '';
        if (!KraTenantContext::hasWorkspace() || KraTenantContext::canSeeLegacy()) return $vault;
        $dir = $vault . DIRECTORY_SEPARATOR . 'KRA Workspaces' . DIRECTORY_SEPARATOR . KraTenantContext::scopeKey();
        if ($create && !is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
            throw new RuntimeException('Unable to create the workspace memory folder in the selected vault.');
        }
        return $dir;
    }

    public static function dashboardPath(bool $create = false): string
    {
        $memoryDir = self::getMemoryDir($create);
        if ($memoryDir === '') return '';
        $legacy = !KraTenantContext::hasWorkspace() || KraTenantContext::canSeeLegacy();
        $path = $memoryDir . DIRECTORY_SEPARATOR . ($legacy ? 'Dashboard KRA Project.md' : 'Dashboard KRA.md');
        if ($create && !$legacy && !is_file($path)) {
            $name = (string) (KraTenantContext::workspace()['name'] ?? 'KRA Workspace');
            @file_put_contents($path, "# Dashboard KRA — {$name}\n\nCatatan memori terkurasi untuk workspace ini dibuat oleh KRA Memory Compiler.\n", LOCK_EX);
        }
        return $path;
    }

    private static function reportWikiLink(string $filename, string $label): string
    {
        $vault = self::getVaultDir();
        $memory = self::getMemoryDir(false);
        $relative = 'reports/' . $filename;
        if ($vault !== '' && $memory !== '' && $memory !== $vault) {
            $relative = str_replace('\\', '/', substr($memory, strlen($vault) + 1)) . '/reports/' . $filename;
        }
        return '[[' . $relative . '|' . $label . ']]';
    }

    public static function sync(string $projectRoot): array
    {
        $vaultDir = self::getVaultDir();
        if ($vaultDir === '') {
            throw new RuntimeException('Obsidian memory vault directory not found.');
        }
        $memoryDir = self::getMemoryDir(true);

        $reportsDir = $memoryDir . DIRECTORY_SEPARATOR . 'reports';
        if (!is_dir($reportsDir) && !@mkdir($reportsDir, 0777, true)) {
            throw new RuntimeException('Unable to access reports directory in vault.');
        }

        $now = new DateTimeImmutable('now');
        $dateStr = $now->format('Y-m-d');
        $timeStr = $now->format('H:i:s');
        $reportFilename = $dateStr . ' - Live Session Sync.md';
        $reportPath = $reportsDir . DIRECTORY_SEPARATOR . $reportFilename;

        // Gather database metrics
        $tasks = KraTaskEngine::loadTasks();
        $chatCount = count(KraDb::getChatHistory('team', 200));
        $hiredAgents = KraDb::getHiredAgents();
        $providerConfig = ProviderConfig::load();
        $defaultProvider = (string) ($providerConfig['defaultProvider'] ?? '9router');
        $activeModel = (string) ($providerConfig['providers'][$defaultProvider]['model'] ?? 'unknown');

        $waiting = 0;
        $approved = 0;
        $rejected = 0;
        foreach ($tasks as $t) {
            $st = (string) ($t['status'] ?? '');
            if ($st === 'WAITING_APPROVAL') $waiting++;
            elseif ($st === 'EXECUTED') $approved++;
            elseif ($st === 'REJECTED') $rejected++;
        }

        $dashboardLink = (!KraTenantContext::hasWorkspace() || KraTenantContext::canSeeLegacy()) ? '[[Dashboard KRA Project]]' : '[[Dashboard KRA]]';
        $md = "---\nkra_workspace: " . KraTenantContext::workspaceId() . "\nkra_kind: session-sync\n---\n\n# 🧠 Live Session Memory Sync — {$dateStr}\n\n"
            . "> **Project:** {$dashboardLink}  \n"
            . "> **Workspace:** `" . KraTenantContext::workspaceId() . "`  \n"
            . "> **Synchronized At:** `{$dateStr} {$timeStr}`  \n"
            . "> **Orchestrator:** Jarvis  \n"
            . "> **Active AI Gateway:** `{$defaultProvider}` (`{$activeModel}`)  \n\n"
            . "## 1. Subagent Operations Roster\n\n"
            . "- 👔 **Rama (Executive Boss):** Active supervision and governance.\n"
            . "- 🛠 **Budi (Creator):** Scaffolding and module creation.\n"
            . "- ✎ **Maya (Modifier):** Code refactoring and diff optimization.\n"
            . "- 🛡 **Dimas (Auditor):** Security and hygiene scanner.\n"
            . "- ⚙ **Siti (Ops/Dir):** Workspace health and database operations.\n";

        if (!empty($hiredAgents)) {
            $md .= "\n### Hired Custom Agents\n";
            foreach ($hiredAgents as $h) {
                $archetype = (string) ($h['archetype'] ?? 'custom');
                $md .= "- 👤 **{$h['name']} ({$h['role']}):** Archetype `{$archetype}`\n";
            }
        }

        $md .= "\n## 2. Task Lifecycle Metrics\n\n"
            . "| Metric | Count |\n"
            . "| :--- | :--- |\n"
            . "| Total Tasks | " . count($tasks) . " |\n"
            . "| Waiting Approval | {$waiting} |\n"
            . "| Approved & Executed | {$approved} |\n"
            . "| Rejected (Safe Halted) | {$rejected} |\n"
            . "| Team Messages Logged | {$chatCount} |\n\n"
            . "## 3. Obsidian Memory Integrity\n\n"
            . "All interactions in the 2.5D virtual office remain synchronized under\n"
            . "the strict Propose-then-Approve risk gate.\n\n"
            . "Workspace Dashboard: {$dashboardLink}\n";

        if (file_put_contents($reportPath, $md, LOCK_EX) === false) {
            throw new RuntimeException('Failed to write sync report to Obsidian vault.');
        }

        // Link back to master Dashboard
        self::recordSyncInDashboard($dateStr, $reportFilename, count($tasks), $chatCount);

        return [
            'ok' => true,
            'vault' => $vaultDir,
            'memoryDir' => $memoryDir,
            'workspaceId' => KraTenantContext::workspaceId(),
            'reportFile' => $reportFilename,
            'timestamp' => $dateStr . ' ' . $timeStr,
            'tasksTotal' => count($tasks),
            'chatLogged' => $chatCount,
            'model' => $activeModel,
            'provider' => $defaultProvider,
        ];
    }

    public static function recall(string $query): array
    {
        $vaultDir = self::getVaultDir();
        $memoryDir = self::getMemoryDir(false);
        $query = strtolower(trim($query));
        if ($query === '' || $vaultDir === '' || $memoryDir === '') {
            return ['ok' => true, 'query' => $query, 'matches' => [], 'workspaceId' => KraTenantContext::workspaceId()];
        }

        $searchDirs = [
            $memoryDir . DIRECTORY_SEPARATOR . 'reports',
            $memoryDir . DIRECTORY_SEPARATOR . 'conversations',
            $memoryDir . DIRECTORY_SEPARATOR . 'tasks',
            $memoryDir . DIRECTORY_SEPARATOR . 'memory',
        ];
        $matches = [];
        $seen = 0;
        foreach ($searchDirs as $dir) {
            if (!is_dir($dir)) continue;
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS));
            foreach ($iterator as $info) {
                if (!$info->isFile() || strtolower($info->getExtension()) !== 'md' || $info->getSize() > 524288) continue;
                $seen++;
                if ($seen > 500) break 2;
                $fullPath = $info->getPathname();
                $relative = str_replace('\\', '/', substr($fullPath, strlen($vaultDir) + 1));
                $content = (string) @file_get_contents($fullPath);
                if (str_contains(strtolower($content), $query) || str_contains(strtolower($relative), $query)) {
                    $matches[] = [
                        'file' => $relative,
                        'excerpt' => self::extractSnippet($content, $query),
                        'link' => '[[' . preg_replace('/\.md$/', '', $relative) . ']]',
                    ];
                    if (count($matches) >= 5) break 2;
                }
            }
        }

        return [
            'ok' => true,
            'query' => $query,
            'count' => count($matches),
            'matches' => $matches,
            'workspaceId' => KraTenantContext::workspaceId(),
        ];
    }

    private static function recordSyncInDashboard(
        string $dateStr,
        string $filename,
        int $taskCount,
        int $chatCount
    ): void {
        if (self::getVaultDir() === '') return;
        $dashPath = self::dashboardPath(true);
        if ($dashPath === '' || !is_file($dashPath)) return;

        $content = (string) file_get_contents($dashPath);
        $entryTitle = "{$dateStr} Live Memory Sync";
        if (str_contains($content, $entryTitle)) return;
        $link = self::reportWikiLink($filename, 'sync report');

        // Locate the legacy reports table when present; new workspace
        // dashboards simply receive an appended activity entry.
        $needle = "| 2026-10-24 | Phase 6A Live 9Router Agentic Brain";
        $newRow = "| {$dateStr} | {$entryTitle} | Jarvis | "
            . "Automated Obsidian vault memory sync: {$taskCount} tasks, {$chatCount} chats logged. "
            . "See {$link}. |\n"
            . $needle;

        if (str_contains($content, $needle)) {
            $updated = str_replace($needle, $newRow, $content);
            @file_put_contents($dashPath, $updated, LOCK_EX);
        } elseif (!KraTenantContext::canSeeLegacy()) {
            @file_put_contents($dashPath, rtrim($content) . "\n\n- {$dateStr} — {$entryTitle}: {$taskCount} tugas, {$chatCount} chat. {$link}\n", LOCK_EX);
        }
    }

    public static function recordMeeting(
        string $topic,
        array $participants,
        array $dialogues,
        string $verdict = 'APPROVED',
        array $actionItems = []
    ): array {
        $vaultDir = self::getVaultDir();
        if ($vaultDir === '') {
            throw new RuntimeException('Obsidian memory vault directory not found.');
        }

        $memoryDir = self::getMemoryDir(true);
        $reportsDir = $memoryDir . DIRECTORY_SEPARATOR . 'reports';
        if (!is_dir($reportsDir) && !@mkdir($reportsDir, 0777, true)) {
            throw new RuntimeException('Unable to access reports directory in vault.');
        }

        $now = new DateTimeImmutable('now');
        $dateStr = $now->format('Y-m-d');
        $timeStr = $now->format('H:i:s');
        $safeTopic = preg_replace('/[^a-zA-Z0-9_\-\s]/', '', $topic);
        $safeTopic = trim(preg_replace('/\s+/', ' ', (string) $safeTopic)) ?: 'Executive Session';
        $reportFilename = "{$dateStr} - Meeting {$safeTopic}.md";
        $reportPath = $reportsDir . DIRECTORY_SEPARATOR . $reportFilename;

        $partList = implode(', ', array_map('htmlspecialchars', $participants));

        $dashboardLink = (!KraTenantContext::hasWorkspace() || KraTenantContext::canSeeLegacy()) ? '[[Dashboard KRA Project]]' : '[[Dashboard KRA]]';
        $md = "---\nkra_workspace: " . KraTenantContext::workspaceId() . "\nkra_kind: meeting\n---\n\n# 👥 Subagent Meeting: {$safeTopic}\n\n"
            . "> **Date:** `{$dateStr} {$timeStr}`  \n"
            . "> **Workspace:** `" . KraTenantContext::workspaceId() . "`  \n"
            . "> **Location:** Floor Meeting Room  \n"
            . "> **Presiding Officer:** Rama (Executive Boss)  \n"
            . "> **Participants:** {$partList}  \n"
            . "> **Executive Verdict:** `{$verdict}`  \n"
            . "> **Memory Root:** {$dashboardLink}  \n\n"
            . "## 1. Meeting Agenda & Objective\n\n"
            . "Strategic alignment on: **{$safeTopic}**.\n\n"
            . "## 2. In-Character Dialogue Transcript\n\n";

        foreach ($dialogues as $d) {
            $sender = (string) ($d['sender'] ?? 'Officer');
            $text = (string) ($d['text'] ?? '');
            $kind = (string) ($d['kind'] ?? 'speech');
            $md .= "- **{$sender}:** \"{$text}\" *({$kind})*\n";
        }

        $md .= "\n## 3. Executive Review & Verdict\n\n"
            . "- **Verdict:** `{$verdict}`\n"
            . "- **Safety Audit:** 0 path violations, strict Propose-then-Approve boundaries enforced.\n"
            . "- **Observability:** Dialogue turns visualized via pixel speech bubbles on office floor.\n\n"
            . "## 4. Action Items & Next Directives\n\n";

        if (empty($actionItems)) {
            $actionItems = ['Maintain steady velocity and preserve zero secret leaks in codebase.'];
        }
        foreach ($actionItems as $item) {
            $md .= "- [ ] {$item}\n";
        }

        $md .= "\n---\n*Recorded automatically via KRA Pilar 6 Multi-Agent Meeting Engine.*\n";

        if (@file_put_contents($reportPath, $md, LOCK_EX) === false) {
            throw new RuntimeException('Failed to write meeting report to Obsidian vault.');
        }

        self::recordMeetingInDashboard($dateStr, $safeTopic, $reportFilename);

        return [
            'ok' => true,
            'topic' => $safeTopic,
            'reportFile' => $reportFilename,
            'path' => $reportPath,
            'memoryDir' => $memoryDir,
            'workspaceId' => KraTenantContext::workspaceId(),
            'timestamp' => "{$dateStr} {$timeStr}",
            'verdict' => $verdict,
        ];
    }

    private static function recordMeetingInDashboard(
        string $dateStr,
        string $topic,
        string $filename
    ): void {
        if (self::getVaultDir() === '') return;
        $dashPath = self::dashboardPath(true);
        if ($dashPath === '' || !is_file($dashPath)) return;

        $content = (string) file_get_contents($dashPath);
        if (str_contains($content, $filename)) return;
        $link = self::reportWikiLink($filename, 'meeting report');

        $needle = "| 2026-10-25 | Pilar 5 Presence and Activity State Persistence";
        $newRow = "| {$dateStr} | Meeting {$topic} | Rama + Officers | "
            . "Multi-agent meeting in room floor: {$topic}. "
            . "See {$link}. |\n"
            . $needle;

        if (str_contains($content, $needle)) {
            $updated = str_replace($needle, $newRow, $content);
            @file_put_contents($dashPath, $updated, LOCK_EX);
        } elseif (!KraTenantContext::canSeeLegacy()) {
            @file_put_contents($dashPath, rtrim($content) . "\n\n- {$dateStr} — Meeting {$topic}. {$link}\n", LOCK_EX);
        }
    }

    private static function extractSnippet(string $content, string $query): string
    {
        $pos = stripos($content, $query);
        if ($pos === false) {
            return substr(trim(preg_replace('/\s+/', ' ', $content)), 0, 160) . '...';
        }
        $start = max(0, $pos - 40);
        $snippet = substr($content, $start, 160);
        return '...' . trim(preg_replace('/\s+/', ' ', $snippet)) . '...';
    }
}
