<?php
declare(strict_types=1);

/**
 * Skill evaluation harness.
 *
 * Scores known slop and clean fixtures, checks governance state, verifies
 * routing, and enforces the prompt digest budget. Exit code 1 on any failure.
 */

require_once __DIR__ . '/../api/lib/KraSkillLock.php';
require_once __DIR__ . '/../api/lib/KraSkillEngine.php';
require_once __DIR__ . '/../api/lib/KraSlopScorer.php';

function evalCheck(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

function evalFixture(string $dir, string $file, string $kind): array
{
    $path = $dir . DIRECTORY_SEPARATOR . $file;
    if (!is_file($path)) {
        fwrite(STDERR, "[FAIL] Missing fixture: {$file}\n");
        exit(1);
    }
    return KraSlopScorer::score((string) file_get_contents($path), $kind);
}

function evalRules(array $result): array
{
    return array_values(array_unique(array_column($result['violations'], 'rule')));
}

$fixtureDir = __DIR__ . DIRECTORY_SEPARATOR . 'fixtures' . DIRECTORY_SEPARATOR . 'skills';
$cases = [
    ['file' => 'slop-copy.md', 'kind' => 'copy'],
    ['file' => 'clean-copy.md', 'kind' => 'copy'],
    ['file' => 'slop-code.php', 'kind' => 'code'],
    ['file' => 'clean-code.php', 'kind' => 'code'],
];
$results = [];
fwrite(STDOUT, "KRA SKILL EVALUATION\n");
fwrite(STDOUT, str_repeat('-', 64) . "\n");
foreach ($cases as $case) {
    $result = evalFixture($fixtureDir, $case['file'], $case['kind']);
    $results[$case['file']] = $result;
    $passed = $result['passed'] ? 'yes' : 'no';
    $rules = implode(', ', evalRules($result));
    fwrite(STDOUT, sprintf(
        "%-16s score=%3d grade=%-5s passed=%-3s violations=%d\n",
        $case['file'],
        $result['score'],
        $result['grade'],
        $passed,
        count($result['violations'])
    ));
    if ($rules !== '') {
        fwrite(STDOUT, '  rules: ' . $rules . "\n");
    }
}
fwrite(STDOUT, str_repeat('-', 64) . "\n");

$slopCopy = $results['slop-copy.md'];
$cleanCopy = $results['clean-copy.md'];
$slopCode = $results['slop-code.php'];
$cleanCode = $results['clean-code.php'];
$slopRules = evalRules($slopCopy);
$codeRules = evalRules($slopCode);

evalCheck($slopCopy['passed'] === false, 'Slop copy fixture fails the gate.');
evalCheck($slopCopy['score'] <= 40, 'Slop copy scores 40 or lower.');
foreach (['EM_DASH', 'FILLER_OPENER', 'APOLOGY', 'DEAD_CONTROL', 'UNSOURCED_STAT',
    'UNSOURCED_TESTIMONIAL', 'BUZZWORD'] as $rule) {
    evalCheck(in_array($rule, $slopRules, true), "Slop copy triggers {$rule}.");
}
evalCheck($cleanCopy['passed'] === true, 'Clean copy fixture passes the gate.');
evalCheck($cleanCopy['score'] >= 90, 'Clean copy scores 90 or higher.');
evalCheck($cleanCopy['violations'] === [], 'Clean copy has zero violations.');
evalCheck($slopCode['passed'] === false, 'Slop code fixture fails the gate.');
evalCheck(in_array('SLOP_COMMENT', $codeRules, true), 'Slop code triggers SLOP_COMMENT.');
evalCheck($cleanCode['passed'] === true, 'Clean code fixture passes the gate.');
evalCheck($cleanCode['score'] >= 90, 'Clean code scores 90 or higher.');
$delta = $cleanCopy['score'] - $slopCopy['score'];
evalCheck($delta >= 50, "Copy rewrite improves the score by {$delta} points.");

$critical = KraSlopScorer::score('Halo ' . "\u{2014}" . ' dunia', 'copy');
evalCheck($critical['passed'] === false, 'A critical rule fails even with a high score.');

$lock = KraSkillLock::verify();
evalCheck($lock['ok'] === true, 'Lockfile verification passes.');
$catalog = KraSkillEngine::catalog();
$unapproved = [];
foreach ($catalog as $id => $skill) {
    if (($skill['approved'] ?? false) !== true) {
        $unapproved[] = $id;
    }
}
evalCheck($unapproved === [], 'Every installed skill is approved and drift-free.');
$core = $catalog['antislop'] ?? [];
evalCheck(($core['source'] ?? '') === 'miqdadbadjuber/anti-slop', 'Core skill source is pinned.');
evalCheck(
    preg_match('/^[0-9a-f]{40}$/', (string) ($core['commit'] ?? '')) === 1,
    'Core skill is pinned to a full commit SHA.'
);
evalCheck(KraSkillLock::isApproved('missing-skill') === false, 'Unknown skills are never approved.');
evalCheck(KraSkillEngine::read('antislop') !== null, 'Approved skill text is readable.');
evalCheck(KraSkillEngine::read('../api/index.php') === null, 'Skill reader blocks path traversal.');
evalCheck(KraSkillEngine::read('missing-skill') === null, 'Skill reader blocks unknown ids.');

$visual = KraSkillEngine::digest('budi', 'buat landing page baru');
$nonVisual = KraSkillEngine::digest('budi', 'perbaiki query builder');
evalCheck(str_contains($visual, 'antislop-ui'), 'Visual task activates the UI family.');
evalCheck(!str_contains($nonVisual, 'antislop-ui'), 'Non-visual task withholds the UI family.');
evalCheck(strlen($visual) <= 1600, 'Prompt digest stays under 1600 bytes.');
evalCheck(KraSkillEngine::mode('audit halaman lama') === 'after', 'Audit maps to after mode.');
evalCheck(KraSkillEngine::mode('buat modul baru') === 'during', 'Build maps to during mode.');

$route = KraSkillEngine::route('budi', 'buat landing page baru');
evalCheck($route['active'] !== [] && $route['withheld'] === [], 'Routing activates approved skills.');

fwrite(STDOUT, str_repeat('-', 64) . "\n");
fwrite(STDOUT, "Fixtures: 4  Copy delta: +{$delta}  Skills: "
    . count($catalog) . "  Digest: " . strlen($visual) . " bytes\n");
fwrite(STDOUT, "SKILL EVALUATION PASSED\n");
exit(0);
