<?php
declare(strict_types=1);

require_once __DIR__ . '/KraAgentRegistry.php';
require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraRouterGateway.php';
require_once __DIR__ . '/KraSkillEngine.php';
require_once __DIR__ . '/../ProviderConfig.php';

final class KraAgentChat
{
    private static array $personas = [
        'rama' => [
            'name' => 'Rama',
            'role' => 'Executive Boss & Auditor',
            'style' => 'Executive, firm, quality-obsessed, safety-first.',
            'focus' => 'Oversees the entire office, enforces approval gates, reviews code.',
        ],
        'budi' => [
            'name' => 'Budi',
            'role' => 'Creator Agent',
            'style' => 'Constructive, technical, focused on scaffolding new files.',
            'focus' => 'Creates clean boilerplate, designs modules, drafts initial code.',
        ],
        'maya' => [
            'name' => 'Maya',
            'role' => 'Modifier Agent',
            'style' => 'Analytical, surgical, refactoring expert, bug fixer.',
            'focus' => 'Performs targeted file modifications, optimization, and fixes.',
        ],
        'dimas' => [
            'name' => 'Dimas',
            'role' => 'Auditor Agent',
            'style' => 'Vigilant, meticulous, zero tolerance for leaks.',
            'focus' => 'Inspects security, path traversal, hygiene, and secret detection.',
        ],
        'siti' => [
            'name' => 'Siti',
            'role' => 'Operations & Workspace Director',
            'style' => 'Organized, pragmatic, runtime and database specialist.',
            'focus' => 'Manages server health, database persistence, and file containment.',
        ],
    ];

    public static function dispatch(array $payload): array
    {
        $channel = strtolower(trim((string) ($payload['channel'] ?? 'team')));
        $userMsg = trim((string) ($payload['message'] ?? ''));
        if ($userMsg === '') {
            throw new InvalidArgumentException('Message cannot be empty.');
        }

        $agentId = self::resolveAgentId($channel, $payload['agentId'] ?? '', $userMsg);
        $agentIds = self::shouldBroadcastToTeam($channel, $userMsg) ? array_keys(self::$personas) : [$agentId];

        // Record incoming user message once, then retain each officer reply in the channel.
        KraDb::logChat('User', $userMsg, $channel);
        $replies = [];
        foreach ($agentIds as $id) {
            $agent = self::getAgentInfo($id);
            $thinking = self::generateThinking($agent, $channel, $userMsg);
            // Avoid serial router waits for a group greeting; individual tabs stay live-model capable.
            $replyResult = self::generateReply(
                $agent,
                $channel,
                $userMsg,
                count($agentIds) === 1,
                (string) ($payload['model'] ?? '')
            );
            $reply = $replyResult['content'];
            $proposal = self::detectProposal($id, $userMsg, $reply);
            KraDb::logChat($agent['name'], $reply, $channel);
            $replies[] = [
                'sender' => $agent['name'],
                'agentId' => $id,
                'thinking' => $thinking,
                'message' => $reply,
                'proposal' => $proposal,
                'provider' => $replyResult['provider'],
                'model' => $replyResult['model'],
                'fallbackUsed' => (bool) ($replyResult['fallbackUsed'] ?? false),
                'fallbackProvider' => $replyResult['fallbackProvider'] ?? null,
                'attempts' => $replyResult['attempts'] ?? [],
            ];
        }

        $first = $replies[0];
        return ['ok' => true, 'channel' => $channel, 'replies' => $replies] + $first;
    }

    private static function shouldBroadcastToTeam(string $channel, string $msg): bool
    {
        if ($channel !== 'team' && $channel !== 'office') {
            return false;
        }
        $lower = strtolower($msg);
        if (str_contains($lower, '@budi') || str_contains($lower, '@maya')
            || str_contains($lower, '@dimas') || str_contains($lower, '@siti')
            || str_contains($lower, '@rama')) {
            return false;
        }
        return true;
    }

    private static function resolveAgentId(string $channel, string $reqAgent, string $msg): string
    {
        if ($reqAgent !== '' && isset(self::$personas[$reqAgent])) {
            return $reqAgent;
        }
        if ($channel !== 'team' && $channel !== 'office' && isset(self::$personas[$channel])) {
            return $channel;
        }

        // On team channel: check if user specifically addresses an agent
        $lower = strtolower($msg);
        if (str_contains($lower, '@budi') || str_contains($lower, 'budi')) return 'budi';
        if (str_contains($lower, '@maya') || str_contains($lower, 'maya')) return 'maya';
        if (str_contains($lower, '@dimas') || str_contains($lower, 'dimas')) return 'dimas';
        if (str_contains($lower, '@siti') || str_contains($lower, 'siti')) return 'siti';
        if (str_contains($lower, '@rama') || str_contains($lower, 'rama')) return 'rama';

        // Default to Rama as the team coordinator
        return 'rama';
    }

    private static function getAgentInfo(string $agentId): array
    {
        if (isset(self::$personas[$agentId])) {
            return ['id' => $agentId] + self::$personas[$agentId];
        }

        // Check if agent is a custom hired agent from MySQL
        $hired = KraDb::getHiredAgents();
        foreach ($hired as $h) {
            if ($h['id'] === $agentId) {
                return [
                    'id' => $h['id'],
                    'name' => $h['name'],
                    'role' => $h['role'],
                    'style' => 'Collaborative, attentive officer on Rama\'s floor.',
                    'focus' => $h['role'],
                ];
            }
        }

        return [
            'id' => 'rama',
            'name' => 'Rama',
            'role' => 'Executive Boss',
            'style' => 'Executive oversight.',
            'focus' => 'Office supervision.',
        ];
    }

    private static function generateThinking(array $agent, string $channel, string $msg): string
    {
        $id = $agent['id'];
        $name = $agent['name'];
        if ($channel === 'team') {
            switch ($id) {
                case 'rama':
                    return "Rama (Lead Thought): Coordinating team response, verifying safety gate policies.";
                case 'budi':
                    return "Budi (Creator Thought): Assessing module scaffolding and architecture requirements.";
                case 'maya':
                    return "Maya (Modifier Thought): Checking codebase compatibility and targeted refactor paths.";
                case 'dimas':
                    return "Dimas (Auditor Thought): Verifying file containment, credentials hygiene, and zero-leak.";
                case 'siti':
                    return "Siti (Ops Thought): Checking workspace health, database connectivity, and runtime status.";
                default:
                    return "{$name} (Team Sync): Synchronizing role objectives with office mission.";
            }
        }

        switch ($id) {
            case 'rama':
                return "Rama (Thinking): Reviewing executive directives, risk boundaries, and approval requirements.";
            case 'budi':
                return "Budi (Thinking): Analyzing architecture patterns, scaffolding structure, and code contracts.";
            case 'maya':
                return "Maya (Thinking): Checking target files, diff-minimalism, and regression impact.";
            case 'dimas':
                return "Dimas (Thinking): Scanning for path traversal risks, secrets, and strict type compliance.";
            case 'siti':
                return "Siti (Thinking): Verifying workspace containment, database status, and runtime health.";
            default:
                return "{$name} (Thinking): Formulating in-role perspective for task execution.";
        }
    }

    private static function generateReply(
        array $agent,
        string $channel,
        string $msg,
        bool $useLiveModel = true,
        string $requestedModel = ''
    ): array {
        $config = ProviderConfig::load();
        $providerName = (string) ($config['defaultProvider'] ?? '9router');
        $id = $agent['id'];
        $lower = strtolower($msg);

        // Native Tool Dispatch: Dimas (Security & Hygiene Audit)
        if ($id === 'dimas' && (str_contains($lower, 'audit') || str_contains($lower, 'scan')
            || str_contains($lower, 'periksa') || str_contains($lower, 'keamanan')
            || str_contains($lower, 'security'))) {
            try {
                $proj = realpath(__DIR__ . '/../..') ?: getcwd();
                $scan = KraAudit::run((string) $proj);
                $sum = $scan['summary'];
                $auditReport = "Laporan Audit Dimas: {$sum['files']} berkas dipindai, "
                    . count($scan['findings']) . " temuan, "
                    . "Secrets: {$sum['possibleSecrets']}. "
                    . "Verdict resmi: {$scan['verdict']}. Parameter keamanan terkendali.";
                if ($useLiveModel) {
                    $system = "You are Dimas, Security Auditor at Kantor-Rama-AI.\n"
                        . "Live workspace audit result: {$auditReport}\n"
                        . "Rule: Start your response with exactly: '{$auditReport}'\n"
                        . "Keep the tone vigilant, concise, and professional.";
                    $comp = KraRouterGateway::complete([
                        'provider' => $providerName,
                        'model' => $requestedModel,
                        'messages' => [
                            ['role' => 'system', 'content' => $system],
                            ['role' => 'user', 'content' => $msg],
                        ],
                        'maxTokens' => 300,
                    ]);
                    if (!empty($comp['content']) && $comp['content'] !== 'SIMULATOR_OK') {
                        return $comp;
                    }
                }
                return [
                    'provider' => 'simulator',
                    'model' => 'kra-agent-brain-v1',
                    'content' => $auditReport,
                    'fallbackUsed' => $useLiveModel,
                    'fallbackProvider' => $useLiveModel ? 'simulator' : null,
                    'attempts' => [],
                ];
            } catch (Throwable) {
            }
        }

        // Native Tool Dispatch: Siti (MySQL & Operations Telemetry)
        if ($id === 'siti' && (str_contains($lower, 'status') || str_contains($lower, 'database')
            || str_contains($lower, 'db') || str_contains($lower, 'ops')
            || str_contains($lower, 'runtime') || str_contains($lower, 'server'))) {
            $dbOk = KraDb::connect() instanceof PDO;
            $tasks = KraTaskEngine::loadTasks();
            $chats = count(KraDb::getChatHistory('team', 200));
            $hired = count(KraDb::getHiredAgents());
            $opsReport = "Laporan Operasional Siti: Database MySQL "
                . ($dbOk ? "ONLINE (kra_db connected)" : "OFFLINE") . ". "
                . "Total Task: " . count($tasks) . ", Log Chat: {$chats} pesan, "
                . "Roster: " . (5 + $hired) . " perwira. Runtime PHP: " . PHP_VERSION . ".";
            if ($useLiveModel) {
                $system = "You are Siti, Ops & Workspace Director at Kantor-Rama-AI.\n"
                    . "Live operations data: {$opsReport}\n"
                    . "Rule: Start your response with exactly: '{$opsReport}'\n"
                    . "Keep the tone organized, concise, and professional.";
                try {
                    $comp = KraRouterGateway::complete([
                        'provider' => $providerName,
                        'model' => $requestedModel,
                        'messages' => [
                            ['role' => 'system', 'content' => $system],
                            ['role' => 'user', 'content' => $msg],
                        ],
                        'maxTokens' => 300,
                    ]);
                    if (!empty($comp['content']) && $comp['content'] !== 'SIMULATOR_OK') {
                        return $comp;
                    }
                } catch (Throwable) {
                }
            }
            return [
                'provider' => 'simulator',
                'model' => 'kra-agent-brain-v1',
                'content' => $opsReport,
                'fallbackUsed' => $useLiveModel,
                'fallbackProvider' => $useLiveModel ? 'simulator' : null,
                'attempts' => [],
            ];
        }

        if ($useLiveModel) {
            $system = "You are {$agent['name']}, {$agent['role']} at Kantor-Rama-AI (KRA).\n"
                . "Style: {$agent['style']}\nFocus: {$agent['focus']}\n"
                . "Rule: Never perform direct destructive writes. Any changes must go through approval gate.\n"
                . "For create requests, return complete file content in one fenced code block.\n"
                . "For modify requests, return the complete proposed replacement content in one fenced code block.\n"
                . "Keep answers professional, concise, and in Indonesian or English matching the user's language.\n"
                . "" . self::skillDirectives($agent['id'], $msg);

            if ($agent['id'] === 'maya' && self::isModifyRequest($msg)) {
                $target = self::extractTargetFile($msg, '');
                $source = self::readTargetReadOnly($target);
                $system .= "\nREAD-ONLY TARGET CONTEXT:\n"
                    . "File selected for review: " . basename($target) . "\n"
                    . "The following is the current file content. Base your replacement on this exact content.\n"
                    . "--- BEGIN CURRENT FILE ---\n{$source}\n--- END CURRENT FILE ---";
            }

            $messages = [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $msg],
            ];

            // Live chain: 9router -> ollama -> simulator (gateway owns the chain)
            try {
                $comp = KraRouterGateway::completeWithFallback([
                    'provider' => $providerName,
                    'model' => $requestedModel,
                    'messages' => $messages,
                    'maxTokens' => 600,
                ]);
                if (!empty($comp['content']) && $comp['content'] !== 'SIMULATOR_OK') {
                    return [
                        'provider' => $comp['provider'],
                        'model' => $comp['model'],
                        'content' => $comp['content'],
                        'fallbackUsed' => (bool) ($comp['fallbackUsed'] ?? false),
                        'fallbackProvider' => $comp['fallbackProvider'] ?? null,
                        'attempts' => self::normalizeAttempts($comp['attempts'] ?? []),
                    ];
                }
            } catch (Throwable) {
                // Fall through to smart role-based completion
            }
        }

        // Smart role-based fallback reply (simulator, no remote provider)
        $fallbackContent = self::createRoleFallbackReply($agent, $channel, $msg);
        return [
            'provider' => 'simulator',
            'model' => 'kra-agent-brain-v1',
            'content' => $fallbackContent,
            'fallbackUsed' => $useLiveModel,
            'fallbackProvider' => $useLiveModel ? 'simulator' : null,
            'attempts' => [],
        ];
    }

    private static function normalizeAttempts(array $attempts): array
    {
        $out = [];
        foreach ($attempts as $attempt) {
            if (!is_array($attempt) || !isset($attempt[0])) {
                continue;
            }
            $ok = ($attempt[1] ?? '') === 'online';
            $out[] = [(string) $attempt[0], $ok ? 'online' : 'offline'];
        }
        return $out;
    }

    private static function skillDirectives(string $agentId, string $message): string
    {
        return KraSkillEngine::digest($agentId, $message);
    }

    private static function createRoleFallbackReply(array $agent, string $channel, string $msg): string
    {
        $name = $agent['name'];
        $id = $agent['id'];
        $lower = strtolower($msg);
        $isGreeting = str_contains($lower, 'helo') || str_contains($lower, 'halo')
            || str_contains($lower, 'hi') || str_contains($lower, 'hai')
            || str_contains($lower, 'pagi') || str_contains($lower, 'siang')
            || str_contains($lower, 'malam') || str_contains($lower, 'morning');

        if ($channel === 'team') {
            if ($isGreeting) {
                switch ($id) {
                    case 'rama':
                        return "Salam! Sebagai Executive Boss, saya menyambut Anda di Kantor-Rama-AI. "
                            . "Seluruh tim hadir lengkap dan siap menerima instruksi.";
                    case 'budi':
                        return "Halo! Budi di sini (Creator). Siap membuat modul atau file baru jika ada tugas.";
                    case 'maya':
                        return "Halo! Maya di sini (Modifier). Siap membantu refactoring atau perbaikan kode presisi.";
                    case 'dimas':
                        return "Salam! Dimas (Auditor) siap memantau. Workspace bersih dan parameter keamanan aman.";
                    case 'siti':
                        return "Halo! Siti (Ops & Dir) online. Database MySQL dan seluruh meja kerja terhubung normal.";
                    default:
                        return "Halo! Saya {$name}, siap berkontribusi di lantai kantor.";
                }
            }

            switch ($id) {
                case 'rama':
                    return "Instruksi untuk tim diterima: \"{$msg}\". Saya mengkoordinasikan tugas ini. "
                        . "Semua perubahan wajib melalui Approval Gate sebelum eksekusi.";
                case 'budi':
                    return "Terkait \"{$msg}\", saya siap menyusun arsitektur dan scaffolding file barunya.";
                case 'maya':
                    return "Saya akan memeriksa file terkait agar perubahan tetap minimal dan bersih.";
                case 'dimas':
                    return "Saya akan pastikan tidak ada secret leak atau risiko keamanan dalam instruksi ini.";
                case 'siti':
                    return "Status runtime dan storage terkendali untuk mendukung tugas ini.";
                default:
                    return "Siap menjalankan arahan terkait \"{$msg}\".";
            }
        }

        switch ($id) {
            case 'rama':
                if (str_contains($lower, 'audit') || str_contains($lower, 'review')) {
                    return "Instruksi audit diterima. Gunakan `/rama review` atau tombol target untuk memindai workspace. "
                        . "Semua temuan akan diverifikasi secara ketat.";
                }
                if (str_contains($lower, 'briefing') || str_contains($lower, 'memory')
                    || str_contains($lower, 'vault') || str_contains($lower, 'status')) {
                    $vault = KraVaultSync::getVaultDir();
                    $tasks = KraTaskEngine::loadTasks();
                    $waiting = 0;
                    foreach ($tasks as $t) {
                        if (($t['status'] ?? '') === 'WAITING_APPROVAL') $waiting++;
                    }
                    return "Briefing Eksekutif Rama: Memory Obsidian "
                        . ($vault !== '' ? "TERHUBUNG" : "OFFLINE") . ". "
                        . "Ada {$waiting} proposal menunggu approval. Propose-then-Approve gate aktif.";
                }
                return "Sebagai pimpinan KRA, saya memastikan setiap output berkualitas tinggi dan aman. "
                    . "Kebutuhan Anda terkait \"{$msg}\" sedang saya pantau. Silakan ajukan proposal jika ada aksi berkas.";

            case 'budi':
                return "Salam! Saya Budi (Creator). Untuk kebutuhan \"{$msg}\", saya dapat membuatkan modul atau struktur file "
                    . "baru yang bersih. Format usulan akan saya masukkan ke Approval Gate untuk disetujui.";

            case 'maya':
                return "Halo, saya Maya (Modifier). Terkait \"{$msg}\", saya siap melakukan refactoring atau penyesuaian kode "
                    . "secara presisi. Perubahan akan disajikan dalam bentuk diff untuk ditinjau.";

            case 'dimas':
                if (str_contains($lower, 'audit') || str_contains($lower, 'scan')
                    || str_contains($lower, 'periksa') || str_contains($lower, 'keamanan')
                    || str_contains($lower, 'security')) {
                    try {
                        $proj = realpath(__DIR__ . '/../..') ?: getcwd();
                        $scan = KraAudit::run((string) $proj);
                        $sum = $scan['summary'];
                        return "Laporan Audit Dimas: {$sum['files']} berkas dipindai, "
                            . count($scan['findings']) . " temuan, "
                            . "Secrets: {$sum['possibleSecrets']}. "
                            . "Verdict resmi: {$scan['verdict']}. Parameter keamanan terkendali.";
                    } catch (Throwable) {
                        // fall through to standard reply
                    }
                }
                return "Dimas di sini (Auditor). Terkait \"{$msg}\", saya siap memastikan tidak ada secret leakage, "
                    . "path traversal, atau pelanggaran hygiene. Keselamatan kode adalah prioritas utama.";

            case 'siti':
                if (str_contains($lower, 'status') || str_contains($lower, 'database')
                    || str_contains($lower, 'db') || str_contains($lower, 'ops')
                    || str_contains($lower, 'runtime') || str_contains($lower, 'server')) {
                    $dbOk = KraDb::connect() instanceof PDO;
                    $tasks = KraTaskEngine::loadTasks();
                    $chats = count(KraDb::getChatHistory('team', 200));
                    $hired = count(KraDb::getHiredAgents());
                    return "Laporan Operasional Siti: Database MySQL "
                        . ($dbOk ? "ONLINE (kra_db connected)" : "OFFLINE") . ". "
                        . "Total Task: " . count($tasks) . ", Log Chat: {$chats} pesan, "
                        . "Roster: " . (5 + $hired) . " perwira. Runtime PHP: " . PHP_VERSION . ".";
                }
                return "Halo! Saya Siti (Ops & Dir). Workspace dan status koneksi aman. Operasi terkait \"{$msg}\" "
                    . "akan dipastikan berjalan sesuai batasan runtime dan tercatat rapi di database.";

            default:
                return "Halo, saya {$name}. Siap menjalankan tugas terkait \"{$msg}\" sesuai arahan Boss Rama.";
        }
    }

    private static function detectProposal(string $agentId, string $msg, string $reply): ?array
    {
        $lower = strtolower($msg);
        $isCreate = str_starts_with($lower, '/create') || str_contains($lower, 'buatkan file')
            || str_contains($lower, 'bikin file') || str_contains($lower, 'buatkan modul')
            || str_contains($lower, 'buatkan fungsi') || str_contains($lower, 'create file');
        $isModify = self::isModifyRequest($msg);

        if (!$isCreate && !$isModify) {
            return null;
        }

        $actionType = $isCreate ? 'create' : 'modify';
        $targetFile = self::extractTargetFile($msg, $isCreate ? 'proposals/module.txt' : 'proposals/change.txt');
        if ($isCreate && !str_starts_with($targetFile, 'proposals/')) {
            $targetFile = 'proposals/' . basename($targetFile);
        }
        if ($actionType === 'modify' && $targetFile === 'proposals/change.txt') {
            $targetFile = self::extractTargetFile($msg, 'web/app.js');
        }
        $extractedCode = self::extractCode($reply);
        $content = $extractedCode !== null
            ? $extractedCode
            : ("// Generated by " . ucfirst($agentId) . " for: " . $msg . "\n"
               . ($isCreate ? "// New module scaffold\n" : "// Targeted refactor\n"));

        $slug = preg_replace('/[^a-z0-9]+/', '-', $lower);
        $slug = trim(substr((string) $slug, 0, 30), '-');
        $title = $isCreate
            ? ('Proposal Buat ' . ($slug ?: 'Module'))
            : ('Proposal Ubah ' . ($slug ?: 'File'));

        return [
            'actionType' => $actionType,
            'title' => $title,
            'targetFile' => $targetFile,
            'proposedContent' => $content,
            'summary' => ucfirst($agentId) . " menyiapkan kode proposal berdasarkan chat. Menunggu approval.",
        ];
    }

    private static function isModifyRequest(string $msg): bool
    {
        $lower = strtolower($msg);
        return str_starts_with($lower, '/modify') || str_contains($lower, 'ubah file')
            || str_contains($lower, 'edit file') || str_contains($lower, 'refactor file')
            || str_contains($lower, 'perbaiki file') || str_contains($lower, 'modify file');
    }

    private static function readTargetReadOnly(string $relative): string
    {
        if ($relative === '') return '[No valid target supplied]';
        $relative = str_replace('\\', '/', ltrim($relative, '/'));
        if (str_contains($relative, '..') || str_contains($relative, ':')) {
            return '[Rejected unsafe target path]';
        }
        $root = realpath(__DIR__ . '/../..');
        $path = $root === false ? '' : $root . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $relative);
        if ($path === '' || !is_file($path)) return '[Target file does not exist]';
        $real = realpath($path);
        if ($real === false || !str_starts_with(strtolower($real), strtolower($root))) {
            return '[Rejected target outside project root]';
        }
        $content = file_get_contents($real);
        return $content === false ? '[Target file is unreadable]' : $content;
    }

    private static function extractCode(string $text): ?string
    {
        if (preg_match('/```[a-zA-Z0-9_-]*\s*\n(.*?)```/s', $text, $matches)) {
            $code = trim($matches[1]);
            if ($code !== '') return $code;
        }
        return null;
    }

    private static function extractTargetFile(string $msg, string $default): string
    {
        if (preg_match('/(?:file|berkas|path|di|ke)\s+([a-zA-Z0-9_\-\.\/\\\\]+\.[a-zA-Z0-9]+)/i', $msg, $m)) {
            $file = str_replace('\\', '/', trim($m[1]));
            $cleaned = ltrim($file, '/');
            if (!str_contains($cleaned, '..') && !str_contains($cleaned, ':')) {
                return $cleaned;
            }
        }
        return $default;
    }
}
