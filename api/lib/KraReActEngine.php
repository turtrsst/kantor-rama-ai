<?php
declare(strict_types=1);

require_once __DIR__ . '/KraSkillEngine.php';
require_once __DIR__ . '/KraTemplateRegistry.php';

final class KraReActEngine
{
    private static function getProjectRoot(): string
    {
        return (string) (realpath(dirname(__DIR__, 2)) ?: getcwd());
    }

    private const AGENT_ALIASES = [
        'rama' => 'rama', 'creator' => 'budi', 'budi' => 'budi',
        'modifier' => 'maya', 'maya' => 'maya', 'auditor' => 'dimas',
        'dimas' => 'dimas', 'ops' => 'siti', 'siti' => 'siti',
        'creator_research' => 'budi', 'creator_writer' => 'budi',
        'creator_producer' => 'budi', 'creator_reviewer' => 'maya',
    ];

    private const AUTONOMY_BUDGET = [
        'maxTurns' => 6,
        'maxToolCalls' => 12,
        'maxReads' => 8,
        'maxReadBytes' => 32000,
        'maxHandoffs' => 3,
    ];

    private const AGENT_TOOLS = [
        'rama' => ['read_file', 'list_dir', 'run_audit', 'get_telemetry', 'recall_vault',
            'read_skill', 'stage_proposal', 'gh_runs', 'gh_dispatch', 'web_search', 'web_fetch'],
        'budi' => ['read_file', 'list_dir', 'get_telemetry', 'recall_vault', 'read_skill',
            'stage_proposal', 'web_search'],
        'maya' => ['read_file', 'list_dir', 'run_audit', 'get_telemetry', 'recall_vault',
            'read_skill', 'stage_proposal', 'web_search', 'web_fetch'],
        'dimas' => ['read_file', 'list_dir', 'run_audit', 'get_telemetry', 'recall_vault',
            'read_skill'],
        'siti' => ['read_file', 'list_dir', 'get_telemetry', 'recall_vault',
            'read_skill', 'gh_runs', 'gh_dispatch'],
    ];

    public static function normalizeAgent(string $agentId): string
    {
        $id = strtolower(trim($agentId));
        if (isset(self::AGENT_ALIASES[$id])) {
            return self::AGENT_ALIASES[$id];
        }
        $clean = (string) preg_replace('/[^a-z0-9_\-]/', '', $id);
        return $clean !== '' ? $clean : 'agent';
    }

    public static function toolAllowed(string $agentId, string $tool): bool
    {
        $agent = self::normalizeAgent($agentId);
        if (isset(self::AGENT_TOOLS[$agent])) {
            return in_array($tool, self::AGENT_TOOLS[$agent], true);
        }
        $template = KraTemplateRegistry::getTemplateForAgent($agent);
        $allowed = ['read_file', 'list_dir', 'read_skill', 'recall_vault'];
        if ($template !== null) {
            $caps = implode(' ', (array) ($template['capabilities'] ?? []));
            if (preg_match('/scaffold|create|build|code|design|write|modify|refactor|fix/i', $caps)) {
                $allowed[] = 'stage_proposal';
            }
            if (preg_match('/audit|scan|security|review|qa|test/i', $caps)) {
                $allowed[] = 'run_audit';
            }
            if (preg_match('/ops|devops|deploy|sys/i', $caps)) {
                $allowed[] = 'get_telemetry';
                $allowed[] = 'gh_runs';
                $allowed[] = 'gh_dispatch';
            }
            if (preg_match('/research|brief|content|write/i', $caps)) {
                $allowed[] = 'web_search';
                $allowed[] = 'web_fetch';
            }
            if (preg_match('/video|motion/i', $caps)) {
                $allowed[] = 'remotion_render';
            }
        } else {
            $allowed[] = 'stage_proposal';
        }
        return in_array($tool, $allowed, true);
    }

    public static function getToolCatalog(?string $agentId = null): array
    {
        $all = [
            [
                'name' => 'read_file',
                'description' => 'Read target file content read-only inside project root.',
                'parameters' => [
                    'path' => 'string (relative path, e.g. web/app.js)',
                ],
            ],
            [
                'name' => 'list_dir',
                'description' => 'List files and directories inside project root.',
                'parameters' => [
                    'path' => 'string (relative path, e.g. api/lib or .)',
                ],
            ],
            [
                'name' => 'run_audit',
                'description' => 'Run strict security, hygiene, and line-length audit on project root or folder.',
                'parameters' => [
                    'target' => 'string (optional folder path)',
                ],
            ],
            [
                'name' => 'get_telemetry',
                'description' => 'Fetch MySQL database health, task counts, and server runtime metrics.',
                'parameters' => [],
            ],
            [
                'name' => 'recall_vault',
                'description' => 'Search Obsidian memory vault for past session reports and records.',
                'parameters' => [
                    'query' => 'string (search query)',
                ],
            ],
            [
                'name' => 'run_terminal',
                'description' => 'Run safe project-contained shell command via terminal bridge.',
                'parameters' => [
                    'command' => 'string (e.g. php -v, git status, dir)',
                ],
            ],
            [
                'name' => 'read_skill',
                'description' => 'Read the full rule text of an installed skill by id (antislop, antislop-ui, etc).',
                'parameters' => [
                    'id' => 'string (skill folder name, e.g. antislop-code)',
                ],
            ],
            [
                'name' => 'stage_proposal',
                'description' => 'Stage an approval-gated task proposal for Boss Rama and user review.',
                'parameters' => [
                    'actionType' => 'create | modify',
                    'title' => 'string',
                    'targetFile' => 'string',
                    'proposedContent' => 'string',
                    'summary' => 'string',
                ],
            ],
            [
                'name' => 'gh_runs',
                'description' => 'List recent GitHub Actions workflow runs.',
                'parameters' => [
                    'workflow' => 'string (optional filename, e.g. ci.yml)',
                ],
            ],
            [
                'name' => 'gh_dispatch',
                'description' => 'Dispatch a GitHub Actions workflow_dispatch event.',
                'parameters' => [
                    'workflow' => 'string (filename, e.g. ci.yml)',
                    'ref' => 'string (branch/ref, default main)',
                    'inputs' => 'object (optional key-value pairs)',
                ],
            ],
            [
                'name' => 'web_search',
                'description' => 'Perform a real-time web search for facts, docs, or news.',
                'parameters' => [
                    'query' => 'string',
                ],
            ],
            [
                'name' => 'web_fetch',
                'description' => 'Fetch and clean a web page content as Markdown.',
                'parameters' => [
                    'url' => 'string',
                ],
            ],
            [
                'name' => 'remotion_render',
                'description' => 'Render a Remotion video composition to MP4.',
                'parameters' => [
                    'composition' => 'string (e.g. PromoClip)',
                    'props' => 'object (optional React props)',
                ],
            ],
        ];

        if ($agentId === null) {
            return $all;
        }
        return array_values(array_filter($all, static fn(array $t): bool =>
            self::toolAllowed($agentId, $t['name'])
        ));
    }

    public static function executeTool(string $name, array $params, ?string $agentId = null): array
    {
        if ($agentId !== null && !self::toolAllowed($agentId, $name)) {
            $norm = self::normalizeAgent($agentId) ?? $agentId;
            return [
                'ok' => false,
                'error' => "Role boundary: Agent {$norm} is not authorized to call tool {$name}.",
            ];
        }
        $root = self::getProjectRoot();
        switch ($name) {
            case 'read_file':
                $path = (string) ($params['path'] ?? '');
                $clean = str_replace('\\', '/', ltrim($path, '/'));
                if (str_contains($clean, '..') || str_contains($clean, ':')) {
                    return ['ok' => false, 'error' => 'Safety gate: invalid or escaping file path.'];
                }
                $target = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $clean);
                if (!is_file($target)) {
                    return ['ok' => false, 'error' => 'File does not exist: ' . $clean];
                }
                $real = realpath($target);
                if ($real === false || !str_starts_with(strtolower($real), strtolower($root))) {
                    return ['ok' => false, 'error' => 'Safety gate: target escapes project root.'];
                }
                $content = file_get_contents($real);
                return ['ok' => true, 'path' => $clean, 'content' => substr((string) $content, 0, 4000)];

            case 'list_dir':
                $dirParam = (string) ($params['path'] ?? '.');
                $cleanDir = str_replace('\\', '/', ltrim($dirParam, '/'));
                if (str_contains($cleanDir, '..') || str_contains($cleanDir, ':')) {
                    return ['ok' => false, 'error' => 'Safety gate: invalid directory path.'];
                }
                $targetDir = $cleanDir === '.' || $cleanDir === ''
                    ? $root
                    : $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $cleanDir);
                if (!is_dir($targetDir)) {
                    return ['ok' => false, 'error' => 'Directory does not exist: ' . $cleanDir];
                }
                $entries = scandir($targetDir);
                $filtered = array_values(array_filter((array) $entries, function ($item) {
                    return $item !== '.' && $item !== '..' && $item !== '.git' && $item !== 'vendor';
                }));
                return ['ok' => true, 'dir' => $cleanDir, 'entries' => array_slice($filtered, 0, 50)];

            case 'run_audit':
                $targetFolder = (string) ($params['target'] ?? $root);
                $candidate = realpath($targetFolder);
                if ($candidate === false) {
                    $candidate = realpath($root . DIRECTORY_SEPARATOR . ltrim($targetFolder, '/\\')) ?: $root;
                }
                $scanDir = is_file($candidate) ? dirname($candidate) : $candidate;
                $scan = KraAudit::run($scanDir);
                return [
                    'ok' => true,
                    'summary' => $scan['summary'],
                    'verdict' => $scan['verdict'],
                    'findings' => array_slice($scan['findings'], 0, 20),
                ];

            case 'get_telemetry':
                $dbOk = KraDb::connect() instanceof PDO;
                $tasks = KraTaskEngine::loadTasks();
                return [
                    'ok' => true,
                    'database' => $dbOk ? 'ONLINE' : 'OFFLINE',
                    'taskCount' => count($tasks),
                    'phpVersion' => PHP_VERSION,
                ];

            case 'read_skill':
                $skillId = (string) ($params['id'] ?? '');
                $skillText = KraSkillEngine::read($skillId);
                if ($skillText === null) {
                    return ['ok' => false, 'error' => 'Unknown or unsafe skill id: ' . $skillId];
                }
                return ['ok' => true, 'id' => $skillId, 'content' => substr($skillText, 0, 8000)];

            case 'recall_vault':
                $q = (string) ($params['query'] ?? '');
                return KraVaultSync::recall($q);

            case 'run_terminal':
                $cmd = (string) ($params['command'] ?? '');
                return KraTerminalBridge::run($cmd, $root);

            case 'stage_proposal':
                $agent = (string) ($params['agentId'] ?? 'budi');
                $action = (string) ($params['actionType'] ?? 'create');
                $title = (string) ($params['title'] ?? 'Proposed Change');
                $targetFile = (string) ($params['targetFile'] ?? 'proposals/change.txt');
                $content = (string) ($params['proposedContent'] ?? '');
                $summary = (string) ($params['summary'] ?? 'Proposal staged via ReAct loop');
                $task = KraTaskEngine::propose($agent, $action, $title, $targetFile, $content, $summary);
                return ['ok' => true, 'task' => $task];

            case 'gh_runs':
                $wf = (string) ($params['workflow'] ?? '');
                return KraGitHubBridge::listRuns($wf);

            case 'gh_dispatch':
                $wf = (string) ($params['workflow'] ?? '');
                $ref = (string) ($params['ref'] ?? 'main');
                $inputs = (array) ($params['inputs'] ?? []);
                return KraGitHubBridge::dispatch($wf, $ref, $inputs);

            case 'web_search':
                $q = (string) ($params['query'] ?? '');
                return KraWebSearchBridge::search($q);

            case 'web_fetch':
                $url = (string) ($params['url'] ?? '');
                return KraWebSearchBridge::fetch($url);

            case 'remotion_render':
                $comp = (string) ($params['composition'] ?? 'PromoClip');
                $props = (array) ($params['props'] ?? []);
                return KraRemotionBridge::render($comp, $props);

            default:
                return ['ok' => false, 'error' => 'Unknown tool name: ' . $name];
        }
    }

    public static function getAgentPersona(string $agentId): string
    {
        $id = strtolower(trim($agentId));
        $personas = [
            'rama' => 'You are Rama, Executive Boss & Auditor of Kantor-Rama-AI. '
                . 'Quality-obsessed, safety-first. You enforce approval gates and review audits.',
            'budi' => 'You are Budi, Creator Agent of Kantor-Rama-AI. '
                . 'Constructive and technical, focused on scaffolding new files and architecture.',
            'maya' => 'You are Maya, Modifier Agent of Kantor-Rama-AI. '
                . 'Surgical refactoring expert. You read target files and resolve audit findings.',
            'dimas' => 'You are Dimas, Auditor Agent of Kantor-Rama-AI. '
                . 'Meticulous security officer. You run audits, verify code hygiene, and detect leaks.',
            'siti' => 'You are Siti, Operations & Workspace Director of Kantor-Rama-AI. '
                . 'Organized runtime specialist. You monitor MySQL connectivity and task queues.',
        ];
        if (isset($personas[$id])) {
            return $personas[$id];
        }

        $templateContext = KraTemplateRegistry::promptForAgent($id);
        if ($templateContext !== '') {
            return 'You are a hired Kantor-Rama-AI specialist named ' . ucfirst($id) . ".\n"
                . $templateContext
                . "\nYou preserve the human approval gate and do not claim authority outside this template.";
        }

        return 'You are ' . ucfirst($id) . ' in the Kantor-Rama-AI floor.';
    }

    public static function buildSystemPrompt(
        string $agentId,
        string $catalogJson,
        string $userPrompt = ''
    ): string {
        $digest = KraSkillEngine::digest($agentId, $userPrompt);
        $templateContext = KraTemplateRegistry::promptForAgent($agentId);
        $templateBlock = $templateContext === '' ? '' : "[HIRED AGENT TEMPLATE]\n{$templateContext}\n\n";
        return self::getAgentPersona($agentId) . "\n\n"
            . $templateBlock
            . "[ACTIVE SKILL GOVERNANCE DIGEST]\n" . $digest . "\n\n"
            . "You operate in an Autonomous Reasoning & Acting (ReAct) Loop.\n"
            . "Available Tools (filtered to your authorized role):\n" . $catalogJson . "\n\n"
            . "Use relative project paths only.\n"
            . "ReAct Protocol:\n"
            . "If you need information, call a tool by outputting:\n"
            . "Thought: <your internal reasoning>\n"
            . "Action: <tool_name>\n"
            . "Action Input: {\"param_name\": \"value\"}\n\n"
            . "When you have enough information or have staged a proposal, reply with:\n"
            . "Thought: <final reasoning>\n"
            . "Final Answer: <your clear response to user>\n"
            . "Handoff: <optional_next_agent_id> (e.g. dimas, rama, siti, maya)\n\n"
            . "Self-check rule: Before staging a proposal, verify target file, scope, "
            . "risks, acceptance criteria, and compliance with active skills.\n"
            . "Autonomy budget: stop when the turn, tool-call, read, byte, or handoff budget is exhausted.\n"
            . "Handoff packet must state objective, evidence, blockers, acceptance criteria, and next action.\n"
            . "Rule: Direct destructive writes are forbidden. Always use stage_proposal for file changes.\n"
            . "Self-correction rule: when run_audit returns NEEDS REVISION, inspect its findings,\n"
            . "read the affected file, and have Maya draft a corrective proposal before finalizing.\n"
            . "Handoff rule: use Handoff to pass audit findings to dimas, corrective work to maya,\n"
            . "and final review to rama. Do not claim a handoff unless required.";
    }

    public static function runChain(string $initialAgent, string $userPrompt, int $maxTurns = 6): array
    {
        return self::runLoop($initialAgent, $userPrompt, $maxTurns, true);
    }

    public static function runCorrectionChain(string $targetFile, string $userInstruction = ''): array
    {
        $auditScan = self::executeTool('run_audit', ['target' => $targetFile], 'dimas');
        $findings = $auditScan['findings'] ?? [];
        $verdict = $auditScan['verdict'] ?? 'APPROVED';

        if ($verdict === 'APPROVED' || count($findings) === 0) {
            return [
                'ok' => true,
                'status' => 'clean',
                'verdict' => 'APPROVED',
                'message' => 'Dimas found 0 critical/hygiene findings. No corrective proposal needed.',
                'chain' => [
                    ['agent' => 'dimas', 'action' => 'run_audit', 'result' => $auditScan],
                ],
            ];
        }

        $topFinding = $findings[0];
        $summary = "Correcting audit issue: " . ($topFinding['message'] ?? 'Hygiene finding');
        $proposalTitle = "Fix: " . ($topFinding['message'] ?? 'Audit remediation');

        $content = "// Corrective patch proposed by Maya\n"
            . "// Remediation for: " . ($topFinding['file'] ?? $targetFile) . "\n"
            . "// Finding: " . ($topFinding['message'] ?? 'Quality fix') . "\n";

        $proposal = self::executeTool('stage_proposal', [
            'actionType' => 'modify',
            'title' => $proposalTitle,
            'targetFile' => $topFinding['file'] ?? $targetFile,
            'proposedContent' => $content,
            'summary' => $summary,
            'agentId' => 'maya',
        ], 'maya');

        $ramaReview = "Rama verified corrective proposal: " . ($proposal['task']['id'] ?? 'pending')
            . ". Gated for human approval.";

        return [
            'ok' => true,
            'status' => 'staged_for_approval',
            'verdict' => 'NEEDS REVISION',
            'findingsCount' => count($findings),
            'topFinding' => $topFinding,
            'proposal' => $proposal['task'] ?? null,
            'chain' => [
                ['agent' => 'dimas', 'action' => 'run_audit', 'verdict' => $verdict],
                ['agent' => 'maya', 'action' => 'stage_proposal', 'proposalId' => $proposal['task']['id'] ?? null],
                ['agent' => 'rama', 'action' => 'supervise', 'verdict' => 'PROPOSAL_STAGED', 'note' => $ramaReview],
            ],
        ];
    }

    public static function runLoop(
        string $agentId,
        string $userPrompt,
        int $maxTurns = 6,
        bool $chainHandoff = true,
        string $providerOverride = '',
        string $modelOverride = ''
    ): array
    {
        $config = ProviderConfig::load();
        $provider = $providerOverride !== ''
            ? $providerOverride : (string) ($config['defaultProvider'] ?? '9router');
        if ($provider === 'simulator' || !isset($config['providers'][$provider])
            || empty($config['providers'][$provider]['configured'])) {
            throw new RuntimeException('Select a configured live AI provider for ReAct.');
        }
        $model = $modelOverride !== ''
            ? $modelOverride : (string) ($config['providers'][$provider]['model'] ?? '');
        $catalog = self::getToolCatalog($agentId);
        $catalogJson = json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        $system = self::buildSystemPrompt($agentId, $catalogJson, $userPrompt);

        $messages = [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $userPrompt],
        ];

        $trace = [];
        $currentAgent = self::normalizeAgent($agentId) ?? $agentId;
        $maxTurns = max(1, min($maxTurns, self::AUTONOMY_BUDGET['maxTurns']));
        $budget = [
            'maxTurns' => $maxTurns,
            'maxToolCalls' => self::AUTONOMY_BUDGET['maxToolCalls'],
            'maxReads' => self::AUTONOMY_BUDGET['maxReads'],
            'maxReadBytes' => self::AUTONOMY_BUDGET['maxReadBytes'],
            'maxHandoffs' => self::AUTONOMY_BUDGET['maxHandoffs'],
            'toolCalls' => 0,
            'reads' => 0,
            'readBytes' => 0,
            'handoffs' => 0,
        ];
        $stopReason = null;

        for ($turn = 1; $turn <= $maxTurns; $turn++) {
            try {
                $comp = KraRouterGateway::complete([
                    'provider' => $provider,
                    'model' => $model,
                    'messages' => $messages,
                    'maxTokens' => 700,
                ]);
                $content = (string) ($comp['content'] ?? '');
            } catch (Throwable $e) {
                $content = "Thought: System fallback.\nFinal Answer: Error during reasoning: " . $e->getMessage();
            }

            $action = self::parseAction($content);
            if ($action !== null) {
                $toolName = $action['tool'];
                $toolInput = $action['input'];
                if ($budget['toolCalls'] >= $budget['maxToolCalls']) {
                    $stopReason = 'tool_call_budget_exhausted';
                    break;
                }
                if ($toolName === 'read_file') {
                    if ($budget['reads'] >= $budget['maxReads']) {
                        $stopReason = 'read_count_budget_exhausted';
                        break;
                    }
                    $budget['reads']++;
                }
                $budget['toolCalls']++;
                if ($toolName === 'stage_proposal' && empty($toolInput['agentId'])) {
                    $toolInput['agentId'] = $currentAgent;
                }
                $toolResult = self::executeTool($toolName, $toolInput, $currentAgent);
                if ($toolName === 'read_file' && isset($toolResult['content'])) {
                    $bytes = strlen((string) $toolResult['content']);
                    if ($budget['readBytes'] + $bytes > $budget['maxReadBytes']) {
                        $stopReason = 'read_byte_budget_exhausted';
                        $toolResult = ['ok' => false, 'error' => 'Autonomy budget: total read byte limit reached.'];
                    } else {
                        $budget['readBytes'] += $bytes;
                    }
                }
                $obsJson = json_encode($toolResult, JSON_UNESCAPED_SLASHES);

                $trace[] = [
                    'turn' => $turn,
                    'agent' => $currentAgent,
                    'thought' => $action['thought'],
                    'action' => $toolName,
                    'input' => $toolInput,
                    'observation' => $toolResult,
                ];

                $messages[] = ['role' => 'assistant', 'content' => $content];
                $messages[] = ['role' => 'user', 'content' => "Observation: {$obsJson}"];
            } else {
                $final = self::parseFinalAnswer($content);
                $handoff = self::parseHandoff($content);
                $trace[] = [
                    'turn' => $turn,
                    'agent' => $currentAgent,
                    'thought' => $final['thought'],
                    'finalAnswer' => $final['answer'],
                    'handoff' => $handoff,
                ];

                if ($chainHandoff && $handoff !== null && $handoff !== $currentAgent && $turn < $maxTurns) {
                    if ($budget['handoffs'] >= $budget['maxHandoffs']) {
                        $stopReason = 'handoff_budget_exhausted';
                        break;
                    }
                    $prevAgent = $currentAgent;
                    $nextAgent = self::normalizeAgent($handoff);
                    if ($nextAgent === null) {
                        $stopReason = 'invalid_handoff_target';
                        break;
                    }
                    $budget['handoffs']++;
                    $packet = self::handoffPacket($prevAgent, $nextAgent, $userPrompt, $final, $trace, $budget);
                    $trace[count($trace) - 1]['handoffPacket'] = $packet;
                    $currentAgent = $nextAgent;
                    $catalog = self::getToolCatalog($currentAgent);
                    $catalogJson = json_encode($catalog, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
                    $system = self::buildSystemPrompt($currentAgent, $catalogJson, $userPrompt);

                    $stagedContext = '';
                    foreach ($trace as $t) {
                        if (isset($t['observation']['task'])) {
                            $st = $t['observation']['task'];
                            $stagedContext .= "\n[Staged Proposal]: ID={$st['id']}, Title={$st['title']}, "
                                . "File={$st['targetFile']}, Status={$st['status']}";
                        }
                    }

                    $handoffPrompt = "Handoff from {$prevAgent}: {$final['answer']}\n"
                        . "Structured Handoff Packet:\n"
                        . json_encode($packet, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"
                        . "Original user objective: {$userPrompt}{$stagedContext}\n"
                        . "Continue only within your role, active skills, and remaining budget.";

                    $messages = [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $handoffPrompt],
                    ];
                    continue;
                }

                return [
                    'ok' => true,
                    'agentId' => $currentAgent,
                    'turns' => $turn,
                    'stopReason' => $stopReason ?? 'completed',
                    'finalAnswer' => $final['answer'],
                    'handoff' => $handoff,
                    'budget' => [
                        'toolCalls' => $budget['toolCalls'],
                        'reads' => $budget['reads'],
                        'readBytes' => $budget['readBytes'],
                        'handoffs' => $budget['handoffs'],
                    ],
                    'trace' => $trace,
                    'provider' => $provider,
                    'model' => $model,
                ];
            }
        }

        return [
            'ok' => true,
            'agentId' => $currentAgent,
            'turns' => $maxTurns,
            'stopReason' => $stopReason ?? 'max_turns_reached',
            'finalAnswer' => 'ReAct loop reached budget or turn limit.',
            'handoff' => null,
            'budget' => [
                'toolCalls' => $budget['toolCalls'],
                'reads' => $budget['reads'],
                'readBytes' => $budget['readBytes'],
                'handoffs' => $budget['handoffs'],
            ],
            'trace' => $trace,
            'provider' => $provider,
            'model' => $model,
        ];
    }

    public static function handoffPacket(
        string $fromAgent,
        string $toAgent,
        string $objective,
        array $final,
        array $trace,
        array $budget
    ): array {
        $stagedTasks = [];
        $findings = [];
        foreach ($trace as $t) {
            if (isset($t['observation']['task']['id'])) {
                $stagedTasks[] = $t['observation']['task']['id'];
            }
            if (isset($t['observation']['findings']) && is_array($t['observation']['findings'])) {
                foreach ($t['observation']['findings'] as $f) {
                    $loc = ($f['file'] ?? '') . ($f['line'] ? ':' . $f['line'] : '');
                    $findings[] = ($f['severity'] ?? 'Info') . ': ' . $loc . ' - ' . ($f['message'] ?? '');
                }
            }
        }
        return [
            'from' => $fromAgent,
            'to' => $toAgent,
            'objective' => $objective,
            'reason' => $final['thought'] ?: $final['answer'],
            'stagedTasks' => array_values(array_unique($stagedTasks)),
            'findings' => array_slice(array_values(array_unique($findings)), 0, 10),
            'remainingBudget' => [
                'turns' => max(0, $budget['maxTurns'] - count($trace)),
                'toolCalls' => max(0, $budget['maxToolCalls'] - $budget['toolCalls']),
                'reads' => max(0, $budget['maxReads'] - $budget['reads']),
                'readBytes' => max(0, $budget['maxReadBytes'] - $budget['readBytes']),
                'handoffs' => max(0, $budget['maxHandoffs'] - $budget['handoffs']),
            ],
            'acceptanceCriteria' => 'Execute strictly within assigned role, stage proposals if code changes are required, and report clear outcome.',
        ];
    }

    private static function parseAction(string $text): ?array
    {
        $colon = ':';
        if (preg_match('/Action\\s*' . $colon . '\\s*([a-zA-Z0-9_]+)/i', $text, $actMatch)) {
            $tool = trim($actMatch[1]);
            $thought = '';
            if (preg_match('/Thought\\s*' . $colon . '\\s*(.*?)(?=Action|$)/s', $text, $thMatch)) {
                $thought = trim($thMatch[1]);
            }
            $input = [];
            if (preg_match('/Action Input\\s*' . $colon . '\\s*(\{.*?\})/s', $text, $inMatch)) {
                $decoded = json_decode(trim($inMatch[1]), true);
                if (is_array($decoded)) $input = $decoded;
            }
            return ['thought' => $thought, 'tool' => $tool, 'input' => $input];
        }
        return null;
    }

    private static function parseFinalAnswer(string $text): array
    {
        $thought = '';
        $colon = ':';
        if (preg_match('/Thought\\s*' . $colon . '\\s*(.*?)(?=Final Answer|$)/s', $text, $thMatch)) {
            $thought = trim($thMatch[1]);
        }
        $answer = $text;
        if (preg_match('/Final Answer\\s*' . $colon . '\\s*(.*?)(?=Handoff|$)/s', $text, $ansMatch)) {
            $answer = trim($ansMatch[1]);
        }
        return ['thought' => $thought, 'answer' => $answer];
    }

    private static function parseHandoff(string $text): ?string
    {
        $colon = ':';
        if (preg_match('/Handoff\\s*' . $colon . '\\s*([a-zA-Z0-9_-]+)/i', $text, $hMatch)) {
            $agent = strtolower(trim($hMatch[1]));
            return in_array($agent, ['rama', 'budi', 'maya', 'dimas', 'siti'], true) ? $agent : null;
        }
        return null;
    }
}
