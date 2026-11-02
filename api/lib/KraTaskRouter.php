<?php
declare(strict_types=1);

require_once __DIR__ . '/KraSkillEngine.php';

/**
 * KraTaskRouter
 *
 * Pure-function, zero-LLM task classifier.
 * Chooses the cheapest execution path per agent+message:
 *   native  → existing tool dispatch, no LLM (audit/ops reports)
 *   single  → one LLM call via completeWithFallback
 *   react   → KraReActEngine::runLoop (read-only, proposals await approval)
 *
 * ponytail: skill-keyword matching uses simple substr; upgrade to TF-IDF
 * if false positives accumulate.
 */
final class KraTaskRouter
{
    // Keywords that activate native Dimas tool (KraAudit)
    private const NATIVE_DIMAS = [
        'audit', 'scan', 'periksa', 'keamanan', 'security', 'inspeksi', 'hygiene',
    ];

    // Keywords that activate native Siti tool (ops report)
    private const NATIVE_SITI = [
        'status', 'database', 'db', 'ops', 'runtime', 'server', 'uptime', 'health',
    ];

    // Multi-step signals that require ReAct. Deliberately phrase-based:
    // bare conjunctions ("lalu", "then") appear in casual chat ("halo, lalu
    // agenda hari ini?") and must not escalate small talk into a ReAct loop.
    private const REACT_SIGNALS = [
        'setelah itu', 'after that', 'audit lalu',
        'lalu perbaiki', 'lalu buat', 'lalu deploy', 'kemudian perbaiki',
        'then fix', 'then create', 'refactor', 'buat modul',
        'perbaiki bug', 'perbaiki error', 'perbaiki kode', 'perbaiki fungsi',
        'fix bug', 'fix error',
    ];

    // Generic skill-id fragments that never count as a keyword hit alone
    // ("creator" is part of every Creator skill id AND of casual text).
    private const SKILL_PART_STOPWORDS = ['creator', 'antislop', 'kra', 'the', 'dan', 'untuk', 'skill'];

    // Indonesian phrasing for skills whose ids are English, so "cek fakta"
    // activates creator-fact-check exactly like "fact check" does.
    private const SKILL_KEYWORD_ALIASES = [
        'creator-fact-check' => ['cek fakta', 'periksa fakta', 'verifikasi klaim'],
        'creator-hook-smith' => ['kalimat pembuka', 'pembuka video'],
        'creator-retention-script' => ['naskah', 'skrip', 'retensi penonton'],
        'creator-seo-metadata' => ['seo', 'deskripsi video', 'tag video'],
        'creator-trend-radar' => ['tren', 'trending', 'topik viral', 'riset topik'],
        'creator-shot-list' => ['storyboard', 'daftar shot', 'jadwal syuting'],
        'creator-concat-edit-brief' => ['concat', 'brief edit'],
        'creator-policy-guard' => ['kebijakan youtube', 'pelanggaran', 'hak cipta', 'copyright', 'monetisasi'],
        'creator-prepublish-qa' => ['sebelum publish', 'sebelum tayang', 'siap publish', 'cek akhir'],
        'creator-repurpose-shorts' => ['shorts', 'klip pendek', 'potong jadi shorts'],
        'creator-analytics-review' => ['analitik', 'analytics', 'performa channel', 'statistik channel'],
    ];

    // ReAct budget defaults (mirrors KraReActEngine::AUTONOMY_BUDGET)
    private const BUDGET_FULL = [
        'maxTurns' => 6, 'maxToolCalls' => 12,
        'maxReads' => 8, 'maxReadBytes' => 32000, 'maxHandoffs' => 3,
    ];

    // Tight budget for short react tasks (< 120 chars, one trigger signal)
    private const BUDGET_TIGHT = [
        'maxTurns' => 3, 'maxToolCalls' => 6,
        'maxReads' => 4, 'maxReadBytes' => 16000, 'maxHandoffs' => 1,
    ];

    // Token overhead estimates per mode
    private const TOKEN_OVERHEAD = ['native' => 0, 'single' => 600, 'react' => 600];

    /**
     * Route a single agent+message to an execution mode and minimal skill set.
     *
     * @param string $agentId  Agent ID (rama, budi, maya, dimas, siti, or hired)
     * @param string $message  Raw user message
     * @return array{mode:string, skills:string[], budget:array, estTokens:int, reason:string}
     * @throws InvalidArgumentException on empty message
     */
    public static function route(string $agentId, string $message): array
    {
        if (trim($message) === '') {
            throw new InvalidArgumentException('Message cannot be empty.');
        }

        $lower = strtolower($message);
        $len   = strlen($message);

        [$mode, $reason] = self::classify($agentId, $lower, $len);
        $budget = self::pickBudget($mode, $lower, $len);
        $skills = self::pickSkills($agentId, $message, $lower, $mode);
        $estTokens = intval($len / 4) + self::TOKEN_OVERHEAD[$mode];

        return [
            'mode'      => $mode,
            'skills'    => $skills,
            'budget'    => $budget,
            'estTokens' => $estTokens,
            'reason'    => $reason,
        ];
    }

    // Private helpers

    /**
     * @return array{string, string}  [mode, reason]
     */
    private static function classify(string $agentId, string $lower, int $len): array
    {
        $reactSignalCount = 0;
        foreach (self::REACT_SIGNALS as $sig) {
            if (str_contains($lower, $sig)) {
                $reactSignalCount++;
            }
        }

        // Count @agent mentions
        $atMentions = preg_match_all('/@\w+/', $lower);

        // react: multi-step signal OR multiple @agent mentions OR very long
        if ($reactSignalCount > 0 || ($atMentions !== false && $atMentions > 1) || $len > 400) {
            return ['react', 'multi-step signal or long message'];
        }

        // native: agent-specific tool keyword match
        if ($agentId === 'dimas' && self::matchesAny($lower, self::NATIVE_DIMAS)) {
            return ['native', 'dimas native audit tool'];
        }
        if ($agentId === 'siti' && self::matchesAny($lower, self::NATIVE_SITI)) {
            return ['native', 'siti native ops tool'];
        }

        return ['single', 'default single LLM call'];
    }

    private static function pickBudget(string $mode, string $lower, int $len): array
    {
        if ($mode !== 'react') {
            return [];
        }

        // tight budget for short messages; full budget for long or complex
        if ($len < 120) {
            return self::BUDGET_TIGHT;
        }

        return self::BUDGET_FULL;
    }

    /**
     * Pick at most 2 relevant extra skills (excluding 'antislop' which is always implicit).
     * Only selects from approved active skills via KraSkillEngine.
     */
    private static function pickSkills(
        string $agentId,
        string $message,
        string $lower,
        string $mode
    ): array {
        $active = KraSkillEngine::activeFor($agentId, $message);

        $extras = [];
        foreach ($active as $skill) {
            if ($skill === 'antislop') {
                continue; // core, always implicit
            }
            // Indonesian aliases first (skill ids are English).
            $hit = false;
            foreach (self::SKILL_KEYWORD_ALIASES[$skill] ?? [] as $alias) {
                if (str_contains($lower, $alias)) {
                    $hit = true;
                    break;
                }
            }
            // Then skill-name keywords, minus generic id fragments.
            if (!$hit) {
                $parts = preg_split('/[-_]/', $skill) ?: [$skill];
                foreach ($parts as $part) {
                    $part = strtolower($part);
                    if ($part !== '' && strlen($part) > 2
                        && !in_array($part, self::SKILL_PART_STOPWORDS, true)
                        && str_contains($lower, $part)) {
                        $hit = true;
                        break;
                    }
                }
            }
            if ($hit) $extras[] = $skill;
        }

        // Deduplicate and cap at 2
        $extras = array_values(array_unique($extras));
        return array_slice($extras, 0, 2);
    }

    private static function matchesAny(string $lower, array $keywords): bool
    {
        foreach ($keywords as $kw) {
            if (str_contains($lower, $kw)) {
                return true;
            }
        }
        return false;
    }
}
