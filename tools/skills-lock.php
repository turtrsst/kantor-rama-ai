<?php
declare(strict_types=1);

/**
 * Skill lockfile CLI.
 *
 * Usage:
 *   php tools/skills-lock.php build
 *   php tools/skills-lock.php verify
 *   php tools/skills-lock.php approve <skill-id|--all> [--by=rama]
 *   php tools/skills-lock.php status
 */

require_once __DIR__ . '/../api/lib/KraSkillLock.php';

$args = array_slice($argv, 1);
$command = $args[0] ?? 'status';
$by = 'rama';
$positional = [];
foreach (array_slice($args, 1) as $arg) {
    if (str_starts_with($arg, '--by=')) {
        $by = substr($arg, 5);
        continue;
    }
    if (str_starts_with($arg, '--')) {
        $positional[] = $arg;
        continue;
    }
    $positional[] = $arg;
}
if (!preg_match('/^[A-Za-z0-9_.-]+$/', $by)) {
    fwrite(STDERR, "Invalid reviewer id. Use letters, digits, dot, underscore, or hyphen.\n");
    exit(1);
}

if ($command === 'build') {
    $result = KraSkillLock::build();
    fwrite(STDOUT, "Lockfile written: resources/skills/SKILLS_LOCK.json\n");
    fwrite(STDOUT, "Registered: {$result['count']}  Pending review: "
        . count($result['pending']) . "\n");
    if ($result['pending'] !== []) {
        fwrite(STDOUT, 'Pending: ' . implode(', ', $result['pending']) . "\n");
    }
    exit(0);
}

if ($command === 'verify') {
    $result = KraSkillLock::verify();
    foreach ($result['issues'] as $issue) {
        fwrite(STDERR, "[FAIL] {$issue['id']}: {$issue['issue']}\n");
    }
    if (!$result['ok']) {
        fwrite(STDERR, "SKILL LOCK VERIFICATION FAILED ({$result['checked']} skills checked).\n");
        exit(1);
    }
    fwrite(STDOUT, "SKILL LOCK VERIFICATION PASSED ({$result['checked']} skills, "
        . "{$result['approved']} approved).\n");
    exit(0);
}

if ($command === 'approve') {
    $target = $positional[0] ?? '';
    if ($target === '') {
        fwrite(STDERR, "Usage: php tools/skills-lock.php approve <skill-id|--all> [--by=rama]\n");
        exit(1);
    }
    if ($target === '--all') {
        $result = KraSkillLock::approveAll($by);
        fwrite(STDOUT, "Approved {$result['count']} skill(s) as {$by}.\n");
        exit(0);
    }
    $result = KraSkillLock::approve($target, $by);
    if (!$result['ok']) {
        fwrite(STDERR, $result['error'] . "\n");
        exit(1);
    }
    fwrite(STDOUT, "Approved {$target} as {$by}.\n");
    exit(0);
}

if ($command === 'status') {
    $lock = KraSkillLock::load();
    $entries = $lock['skills'] ?? [];
    fwrite(STDOUT, "Schema: {$lock['schema']}  Generated: "
        . (string) ($lock['generatedAt'] ?? 'never') . "\n");
    foreach ($entries as $id => $entry) {
        $status = str_pad((string) ($entry['status'] ?? 'unknown'), 15);
        $source = (string) ($entry['source'] ?? 'local');
        $commit = (string) ($entry['commit'] ?? '');
        $pin = $commit !== '' ? substr($commit, 0, 12) : '-';
        fwrite(STDOUT, "{$id} | {$status} | {$source} | {$pin}\n");
    }
    fwrite(STDOUT, 'Total: ' . count($entries) . "\n");
    exit(0);
}

fwrite(STDERR, "Unknown command: {$command}\n");
fwrite(STDERR, "Usage: php tools/skills-lock.php build|verify|approve|status\n");
exit(1);
