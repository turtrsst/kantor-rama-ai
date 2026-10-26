<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraSkillLock.php';
require_once __DIR__ . '/../api/lib/KraSkillHub.php';
require_once __DIR__ . '/../api/lib/KraSkillEngine.php';

function checkP3(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

$db = KraDb::connect();
checkP3($db !== null, 'Database connection is established.');

// 1. Verify schema
$stmt = $db->query("SHOW TABLES LIKE 'kra_agent_skills'");
checkP3($stmt->fetch() !== false, 'Table kra_agent_skills exists.');

// 2. Alias normalization
checkP3(KraSkillHub::normalizeAgent('creator') === 'budi', 'Alias creator -> budi.');
checkP3(KraSkillHub::normalizeAgent('MODIFIER') === 'maya', 'Alias MODIFIER -> maya.');
checkP3(KraSkillHub::normalizeAgent('auditor ') === 'dimas', 'Alias auditor -> dimas.');
checkP3(KraSkillHub::normalizeAgent('ops') === 'siti', 'Alias ops -> siti.');
checkP3(KraSkillHub::normalizeAgent('unknown') === null, 'Unknown agent returns null.');

// 3. Catalog & Hub state
$catalog = KraSkillEngine::catalog();
$hub = KraSkillEngine::hubState();
checkP3(count($hub['agents']) === 5, 'Hub state contains 5 agents.');

// 4. Core antislop cannot be disabled
$previewCore = KraSkillHub::preview([
    'agentId' => 'budi',
    'skillId' => 'antislop',
    'enabled' => false,
], $catalog);
checkP3(!$previewCore['ok'] && str_contains($previewCore['error'], 'mandatory'),
    'Core antislop cannot be disabled.');

// 5. Unapproved skill cannot be configured
$previewUnapproved = KraSkillHub::preview([
    'agentId' => 'budi',
    'skillId' => 'non-existent-skill',
    'enabled' => true,
], $catalog);
checkP3(!$previewUnapproved['ok'], 'Unknown/unapproved skill rejected.');

// 6. Preview generates approval request
$preview = KraSkillHub::preview([
    'agentId' => 'creator',
    'skillId' => 'security-threat-model',
    'enabled' => true,
    'priority' => 40,
], $catalog);
checkP3($preview['ok'] === true && $preview['requiresApproval'] === true,
    'Preview flags proposal requiring approval.');
checkP3($preview['proposal']['agentId'] === 'budi',
    'Proposal agentId normalized to budi.');

// 7. Apply without approval fails
$applyNoApproval = KraSkillHub::apply([
    'agentId' => 'creator',
    'skillId' => 'security-threat-model',
    'enabled' => true,
], $catalog);
checkP3(!$applyNoApproval['ok'] && str_contains($applyNoApproval['error'], 'approval'),
    'Apply without approved:true fails.');

// 8. Apply with approval succeeds and routes with priority
$applyOk = KraSkillHub::apply([
    'agentId' => 'creator',
    'skillId' => 'security-threat-model',
    'enabled' => true,
    'priority' => 40,
    'approved' => true,
    'updatedBy' => 'TestRunner',
], $catalog);
checkP3($applyOk['ok'] === true, 'Apply with approval succeeds.');

$activeBudi = KraSkillEngine::activeFor('budi', 'regular code task');
checkP3(in_array('security-threat-model', $activeBudi, true),
    'Enabled skill now active for budi.');
checkP3($activeBudi[0] === 'antislop', 'Core antislop is at front.');
checkP3($activeBudi[1] === 'security-threat-model',
    'Priority 40 places security-threat-model before default priority 100.');

// 9. Disable a skill
$disableOk = KraSkillHub::apply([
    'agentId' => 'budi',
    'skillId' => 'clean-scaffolder',
    'enabled' => false,
    'approved' => true,
    'updatedBy' => 'TestRunner',
], $catalog);
checkP3($disableOk['ok'] === true, 'Disabling clean-scaffolder succeeds.');
$activeBudiAfter = KraSkillEngine::activeFor('budi', 'regular code task');
checkP3(!in_array('clean-scaffolder', $activeBudiAfter, true),
    'Disabled skill omitted from active set.');

// 10. Check event logged in kra_agent_events
$events = KraDb::getAgentEvents(5);
$foundEvent = false;
foreach ($events as $evt) {
    if (($evt['type'] ?? '') === 'skill.toggle.applied') {
        $foundEvent = true;
        break;
    }
}
checkP3($foundEvent, 'skill.toggle.applied event logged in database.');

// Cleanup test rows
$cleanStmt = $db->prepare("DELETE FROM `kra_agent_skills` WHERE `updated_by` = 'TestRunner'");
$cleanStmt->execute();

$cleanEvt = $db->prepare("DELETE FROM `kra_agent_events` WHERE `from_agent` = 'TestRunner'");
$cleanEvt->execute();

// Verify defaults restored
$restored = KraSkillEngine::activeFor('budi', 'regular code task');
checkP3(in_array('clean-scaffolder', $restored, true),
    'Defaults restored after test row cleanup.');

if (is_file(__DIR__ . '/test-phase3-quick.php')) {
    @unlink(__DIR__ . '/test-phase3-quick.php');
}

fwrite(STDOUT, "ALL PHASE 3 SKILL HUB AND ROUTING CHECKS PASSED\n");
