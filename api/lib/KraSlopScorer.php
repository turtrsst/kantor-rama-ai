<?php
declare(strict_types=1);

/**
 * KRA Slop Scorer
 *
 * Deterministic, dependency-free scoring of generated copy and code against
 * the anti-slop hard gate. The score starts at 100 and loses points for each
 * violation. A critical violation always fails the text, even at a high score.
 */
final class KraSlopScorer
{
    private const CRITICAL = [
        'EM_DASH',
        'FILLER_OPENER',
        'DEAD_CONTROL',
        'UNSOURCED_STAT',
        'UNSOURCED_TESTIMONIAL',
    ];

    private const BUZZWORDS = [
        'seamless', 'revolutionary', 'game-changing', 'game changer', 'cutting-edge',
        'world-class', 'next-generation', 'state-of-the-art', 'synergy', 'paradigm shift',
        'leverage', 'unleash', 'empower', 'delve', 'tapestry', 'robust solution',
        "in today's fast-paced world", 'unlock the power', 'take it to the next level',
        'solusi terbaik', 'terdepan', 'revolusioner', 'mulus tanpa cela',
    ];

    private const FILLERS = [
        'tentu', 'tentu saja', 'sebagai ai', 'halo, saya akan membantu',
        'semoga membantu', 'certainly', 'sure, i can help', 'as an ai',
        'great question', 'of course',
    ];

    private const APOLOGIES = [
        'maaf atas kekeliruan', 'maaf atas kesalahan', 'mohon maaf atas',
        'i apologize for the confusion', "i'm sorry for the confusion", 'my apologies',
    ];

    private const PLACEHOLDERS = [
        'lorem ipsum', 'coming soon', 'placeholder text', 'insert text here',
        'your text here', 'isi teks di sini', 'teks contoh',
    ];

    public static function score(string $text, string $kind = 'copy'): array
    {
        $kind = in_array($kind, ['copy', 'code', 'mixed'], true) ? $kind : 'copy';
        $lines = preg_split('/\R/', $text) ?: [];
        $violations = [];
        $counts = [];
        $add = static function (
            string $rule,
            string $severity,
            int $line,
            string $evidence,
            int $penalty
        ) use (&$violations, &$counts): void {
            $counts[$rule] = ($counts[$rule] ?? 0) + 1;
            $violations[] = [
                'rule' => $rule,
                'severity' => $severity,
                'line' => $line,
                'evidence' => mb_substr(trim($evidence), 0, 90),
                'penalty' => $penalty,
            ];
        };

        $head = mb_substr(trim($text), 0, 320);
        $headLower = mb_strtolower($head);
        foreach (self::FILLERS as $filler) {
            $pattern = '/^(?:[#>*\-\s]*)(?:' . preg_quote($filler, '/') . ')\b/iu';
            if (preg_match($pattern, $headLower) === 1) {
                $add('FILLER_OPENER', 'high', 1, $filler, 15);
                break;
            }
        }

        foreach ($lines as $index => $line) {
            $lineNo = $index + 1;
            $lower = mb_strtolower($line);
            $dashCount = substr_count($line, "\u{2014}") + substr_count($line, '&mdash;');
            if ($dashCount > 0) {
                $add('EM_DASH', 'high', $lineNo, 'em dash x' . $dashCount, 20);
            }
            foreach (self::APOLOGIES as $apology) {
                if (str_contains($lower, $apology)) {
                    $add('APOLOGY', 'medium', $lineNo, $apology, 8);
                    break;
                }
            }
            $dead = '/(?:href\s*=\s*["\']#["\']|href\s*=\s*["\']javascript:void\(0\)["\']'
                . '|onclick\s*=\s*["\']return\s+false;?["\'])/i';
            if (preg_match($dead, $line) === 1) {
                $add('DEAD_CONTROL', 'high', $lineNo, $line, 20);
            }
            if ($kind !== 'code') {
                foreach (self::BUZZWORDS as $word) {
                    if (str_contains($lower, $word)) {
                        $add('BUZZWORD', 'low', $lineNo, $word, 4);
                    }
                }
                $stat = '/(?<![\w.])(?:\d{1,3}(?:[.,]\d+)?\s?%|\d+(?:\.\d+)?x\b'
                    . '|(?:ribuan|jutaan|millions|thousands)\s+(?:of\s+)?'
                    . '(?:users|pengguna|customers|pelanggan))/iu';
                if (preg_match($stat, $line, $match) === 1
                    && preg_match('/\b(?:width|height|opacity|scale|translate|margin|padding)'
                        . '\s*:\s*[\d.]+%/i', $line) !== 1) {
                    $context = ($lines[$index - 1] ?? '') . ' ' . $line;
                    $cited = '/(?:https?:\/\/|sumber|source|sitasi|citation|\[\^|\[source\])/i';
                    if (preg_match($cited, $context) !== 1) {
                        $add('UNSOURCED_STAT', 'high', $lineNo, $match[0], 10);
                    }
                }
                $quote = '/["“][^"”]{20,}["”]\s*[—–-]\s*[A-Z][A-Za-z.\s]{2,40},\s*'
                    . '(?:CEO|CTO|CFO|COO|Founder|Manager|Director|Head of)\b/u';
                if (preg_match($quote, $line) === 1) {
                    $add('UNSOURCED_TESTIMONIAL', 'high', $lineNo, $line, 15);
                }
            }
            foreach (self::PLACEHOLDERS as $placeholder) {
                if (str_contains($lower, $placeholder)) {
                    $add('PLACEHOLDER', 'medium', $lineNo, $placeholder, 8);
                    break;
                }
            }
        }

        if ($kind !== 'copy') {
            self::scanComments($lines, $add);
        }

        $penalty = 0;
        $critical = false;
        foreach ($violations as $violation) {
            $penalty += (int) $violation['penalty'];
            if (in_array($violation['rule'], self::CRITICAL, true)) {
                $critical = true;
            }
        }
        $score = max(0, 100 - $penalty);
        $grade = $score >= 90 ? 'clean' : ($score >= 70 ? 'watch' : 'slop');
        return [
            'score' => $score,
            'grade' => $grade,
            'passed' => $score >= 80 && !$critical,
            'kind' => $kind,
            'bytes' => strlen($text),
            'violations' => $violations,
            'counts' => $counts,
        ];
    }

    /**
     * Detect comments that restate the next line or open with a generic AI verb.
     *
     * @param array<int, string> $lines
     * @param callable $add
     */
    private static function scanComments(array $lines, callable $add): void
    {
        $total = count($lines);
        foreach ($lines as $index => $line) {
            $commentPattern = '~^\s*(?://|/\*|\*|#)\s*(.+?)\s*(?:\*/)?$~';
            if (preg_match($commentPattern, $line, $match) !== 1) {
                continue;
            }
            $comment = trim($match[1]);
            if ($comment === '' || str_starts_with($comment, 'php')) {
                continue;
            }
            $next = '';
            for ($cursor = $index + 1; $cursor < $total; $cursor++) {
                if (trim($lines[$cursor]) !== '') {
                    $next = trim($lines[$cursor]);
                    break;
                }
            }
            if ($next === '' || preg_match('~^\s*(?://|/\*|\*|#)~', $next) === 1) {
                continue;
            }
            $generic = '/^(?:this|here|we|the following|initialize|initialise|loop through|'
                . 'iterate|check if|return the|set the|create a|handle the|define the|'
                . 'import the|update the|get the|call the|use the|ensure|make sure|'
                . 'increment|decrement)\b/i';
            if (preg_match($generic, $comment) === 1 || self::restates($comment, $next)) {
                $add('SLOP_COMMENT', 'medium', $index + 1, $comment, 6);
            }
        }
    }

    private static function restates(string $comment, string $code): bool
    {
        $stop = ['this', 'that', 'with', 'from', 'will', 'have', 'into', 'then', 'else',
            'return', 'function', 'the', 'and', 'for', 'are', 'was', 'were', 'when',
            'what', 'which', 'your', 'our', 'its', 'it'];
        $words = preg_split('/[^a-z0-9_]+/', strtolower($comment)) ?: [];
        $words = array_values(array_filter(
            $words,
            static function (string $word) use ($stop): bool {
                return strlen($word) >= 4 && !in_array($word, $stop, true);
            }
        ));
        if (count($words) < 2) {
            return false;
        }
        $codeLower = strtolower($code);
        foreach ($words as $word) {
            if (!str_contains($codeLower, $word)) {
                return false;
            }
        }
        return true;
    }
}
