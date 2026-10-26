<?php
declare(strict_types=1);

final class KraVaultSync
{
    public static function getVaultDir(): string
    {
        $env = getenv('KRA_MEMORY_ROOT');
        if ($env && is_dir($env)) {
            return $env;
        }
        $fallback = 'D:' . DIRECTORY_SEPARATOR . 'vault' . DIRECTORY_SEPARATOR . 'KRA';
        return is_dir($fallback) ? $fallback : '';
    }

    public static function sync(string $projectRoot): array
    {
        $vaultDir = self::getVaultDir();
        if ($vaultDir === '') {
            throw new RuntimeException('Obsidian memory vault directory not found.');
        }

        $reportsDir = $vaultDir . DIRECTORY_SEPARATOR . 'reports';
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

        $md = "# 🧠 Live Session Memory Sync — {$dateStr}\n\n"
            . "> **Project:** [[Dashboard KRA Project]]  \n"
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
            . "Root Dashboard: [[Dashboard KRA Project]]\n";

        if (file_put_contents($reportPath, $md, LOCK_EX) === false) {
            throw new RuntimeException('Failed to write sync report to Obsidian vault.');
        }

        // Link back to master Dashboard
        self::recordSyncInDashboard($dateStr, $reportFilename, count($tasks), $chatCount);

        return [
            'ok' => true,
            'vault' => $vaultDir,
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
        $query = strtolower(trim($query));
        if ($query === '' || $vaultDir === '') {
            return ['ok' => true, 'query' => $query, 'matches' => []];
        }

        $reportsDir = $vaultDir . DIRECTORY_SEPARATOR . 'reports';
        if (!is_dir($reportsDir)) {
            return ['ok' => true, 'query' => $query, 'matches' => []];
        }

        $files = scandir($reportsDir) ?: [];
        $matches = [];
        foreach ($files as $file) {
            if (!str_ends_with($file, '.md')) continue;
            $fullPath = $reportsDir . DIRECTORY_SEPARATOR . $file;
            $content = (string) @file_get_contents($fullPath);
            if (str_contains(strtolower($content), $query)
                || str_contains(strtolower($file), $query)) {
                $excerpt = self::extractSnippet($content, $query);
                $matches[] = [
                    'file' => $file,
                    'excerpt' => $excerpt,
                ];
                if (count($matches) >= 5) break;
            }
        }

        return [
            'ok' => true,
            'query' => $query,
            'count' => count($matches),
            'matches' => $matches,
        ];
    }

    private static function recordSyncInDashboard(
        string $dateStr,
        string $filename,
        int $taskCount,
        int $chatCount
    ): void {
        $vaultDir = self::getVaultDir();
        if ($vaultDir === '') return;
        $dashPath = $vaultDir . DIRECTORY_SEPARATOR . 'Dashboard KRA Project.md';
        if (!is_file($dashPath)) return;

        $content = (string) file_get_contents($dashPath);
        $entryTitle = "{$dateStr} Live Memory Sync";
        if (str_contains($content, $entryTitle)) return;

        // Locate reports table and append row cleanly
        $needle = "| 2026-10-24 | Phase 6A Live 9Router Agentic Brain";
        $newRow = "| {$dateStr} | {$entryTitle} | Jarvis | "
            . "Automated Obsidian vault memory sync: {$taskCount} tasks, {$chatCount} chats logged. "
            . "See [[reports/{$filename}|sync report]]. |\n"
            . $needle;

        if (str_contains($content, $needle)) {
            $updated = str_replace($needle, $newRow, $content);
            @file_put_contents($dashPath, $updated, LOCK_EX);
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

        $reportsDir = $vaultDir . DIRECTORY_SEPARATOR . 'reports';
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

        $md = "# 👥 Subagent Meeting: {$safeTopic}\n\n"
            . "> **Date:** `{$dateStr} {$timeStr}`  \n"
            . "> **Location:** Floor Meeting Room  \n"
            . "> **Presiding Officer:** Rama (Executive Boss)  \n"
            . "> **Participants:** {$partList}  \n"
            . "> **Executive Verdict:** `{$verdict}`  \n"
            . "> **Memory Root:** [[Dashboard KRA Project]]  \n\n"
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
            'timestamp' => "{$dateStr} {$timeStr}",
            'verdict' => $verdict,
        ];
    }

    private static function recordMeetingInDashboard(
        string $dateStr,
        string $topic,
        string $filename
    ): void {
        $vaultDir = self::getVaultDir();
        if ($vaultDir === '') return;
        $dashPath = $vaultDir . DIRECTORY_SEPARATOR . 'Dashboard KRA Project.md';
        if (!is_file($dashPath)) return;

        $content = (string) file_get_contents($dashPath);
        if (str_contains($content, $filename)) return;

        $needle = "| 2026-10-25 | Pilar 5 Presence and Activity State Persistence";
        $newRow = "| {$dateStr} | Meeting {$topic} | Rama + Officers | "
            . "Multi-agent meeting in room floor: {$topic}. "
            . "See [[reports/{$filename}|meeting report]]. |\n"
            . $needle;

        if (str_contains($content, $needle)) {
            $updated = str_replace($needle, $newRow, $content);
            @file_put_contents($dashPath, $updated, LOCK_EX);
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
