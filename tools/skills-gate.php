<?php
declare(strict_types=1);

/**
 * CI gate for skill governance.
 *
 * Runs the lockfile check, the evaluation harness, the routing suite, and the
 * executive audit. Any failing step blocks the build.
 *
 * Usage: php tools/skills-gate.php [--skip-audit]
 */

require_once __DIR__ . '/../api/lib/KraSkillLock.php';

$skipAudit = in_array('--skip-audit', array_slice($argv, 1), true);

function gateStep(string $label, string $script, array $args = []): bool
{
    $command = escapeshellarg(PHP_BINARY) . ' '
        . escapeshellarg(__DIR__ . DIRECTORY_SEPARATOR . $script);
    foreach ($args as $arg) {
        $command .= ' ' . escapeshellarg($arg);
    }
    $lines = [];
    $code = 0;
    exec($command . ' 2>&1', $lines, $code);
    $ok = $code === 0;
    fwrite(STDOUT, ($ok ? '[PASS] ' : '[FAIL] ') . $label . "\n");
    foreach ($lines as $line) {
        fwrite(STDOUT, '  ' . $line . "\n");
    }
    return $ok;
}

fwrite(STDOUT, "KRA SKILL GATE\n");
fwrite(STDOUT, str_repeat('=', 64) . "\n");

$ok = true;
$lock = KraSkillLock::verify();
if ($lock['ok']) {
    fwrite(STDOUT, "[PASS] Lockfile: {$lock['checked']} skills checked, "
        . "{$lock['approved']} approved.\n");
} else {
    $ok = false;
    fwrite(STDOUT, "[FAIL] Lockfile verification.\n");
    foreach ($lock['issues'] as $issue) {
        fwrite(STDOUT, "  {$issue['id']}: {$issue['issue']}\n");
    }
}

$ok = gateStep('Evaluation harness', 'eval-skills.php') && $ok;
$ok = gateStep('Routing and governance suite', 'verify-skills.php') && $ok;
if (!$skipAudit) {
    $ok = gateStep('Executive audit', 'audit-cli.php') && $ok;
}

fwrite(STDOUT, str_repeat('=', 64) . "\n");
if (!$ok) {
    fwrite(STDERR, "SKILL GATE FAILED\n");
    exit(1);
}
fwrite(STDOUT, "SKILL GATE PASSED\n");
exit(0);
