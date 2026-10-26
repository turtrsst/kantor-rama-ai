<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraSkillEngine.php';
require_once __DIR__ . '/../api/lib/KraAgentChat.php';

function checkSkills(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

$catalog = KraSkillEngine::catalog();
$expected = ['antislop', 'antislop-code', 'antislop-ui', 'antislop-copywriting',
    'antislop-human', 'antislop-layoutmobile', 'clean-scaffolder', 'surgical-refactor',
    'security-threat-model', 'ops-memory-steward', 'differential-review'];
foreach ($expected as $id) {
    checkSkills(isset($catalog[$id]), "Skill registered: {$id}.");
}
checkSkills(!isset($catalog['anti-slop-code']), 'Legacy anti-slop-code removed.');

$upstream = $catalog['antislop']['source'] ?? '';
checkSkills($upstream === 'miqdadbadjuber/anti-slop', 'Core antislop provenance is pinned.');
checkSkills(($catalog['antislop']['sha256'] ?? '') !== '', 'Core antislop checksum recorded.');

$lock = KraSkillLock::verify();
checkSkills($lock['ok'] === true, 'Skill lockfile verification passes.');
$commit = (string) ($catalog['antislop']['commit'] ?? '');
checkSkills(preg_match('/^[0-9a-f]{40}$/', $commit) === 1, 'Core antislop pinned to a commit.');
checkSkills(($catalog['antislop']['approved'] ?? false) === true, 'Core antislop is approved.');
checkSkills(KraSkillLock::isApproved('missing-skill') === false, 'Unknown skill is not approved.');
$route = KraSkillEngine::route('budi', 'buat landing page baru');
checkSkills($route['withheld'] === [], 'No approved skill is withheld for Budi.');

$budiSkills = KraSkillEngine::activeFor('budi', 'buat landing page baru');
checkSkills(in_array('antislop-ui', $budiSkills, true), 'UI task adds antislop-ui for Budi.');
checkSkills(in_array('antislop-code', $budiSkills, true), 'Budi keeps antislop-code.');
checkSkills(!in_array('antislop-ui', KraSkillEngine::activeFor('budi', 'fix query'), true),
    'Non-UI task does not load UI skills.');

checkSkills(KraSkillEngine::mode('audit halaman yang sudah ada') === 'after', 'Audit request maps to after mode.');
checkSkills(KraSkillEngine::mode('buat modul baru') === 'during', 'Build request maps to during mode.');

$digest = KraSkillEngine::digest('dimas', 'audit keamanan api');
checkSkills(str_contains($digest, 'ANTISLOP ACTIVE: after'), 'Digest announces after mode.');
checkSkills(str_contains($digest, 'Delivery gate'), 'Digest includes the delivery gate.');

$core = KraSkillEngine::read('antislop');
checkSkills(is_string($core) && str_contains((string) $core, 'R-01'), 'Full core rule text readable.');
checkSkills(KraSkillEngine::read('../api/index.php') === null, 'Skill reader blocks path traversal.');

$chat = KraAgentChat::dispatch([
    'channel' => 'budi',
    'message' => 'Buatkan scaffold module baru',
]);
checkSkills(($chat['ok'] ?? false) === true, 'KraAgentChat dispatch succeeded.');
$reply = (string) ($chat['message'] ?? '');
checkSkills(!str_starts_with($reply, 'Tentu'), 'Response does not start with AI slop "Tentu".');
checkSkills(!str_starts_with($reply, 'Sebagai AI'), 'Response does not start with "Sebagai AI".');

fwrite(STDOUT, "ANTISLOP FAMILY & SKILL ROUTING VERIFICATION PASSED\n");
