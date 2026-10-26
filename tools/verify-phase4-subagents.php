<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraSkillEngine.php';
require_once __DIR__ . '/../api/lib/KraAudit.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/lib/KraReActEngine.php';

function checkSub(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

fwrite(STDOUT, "SUBAGENT INDEPENDENT LAYER VERIFICATION\n");
fwrite(STDOUT, str_repeat('=', 64) . "\n");

// 1. Role-specific tool catalogs
$budiTools = array_column(KraReActEngine::getToolCatalog('budi'), 'name');
checkSub(in_array('stage_proposal', $budiTools, true), 'Budi catalog has stage_proposal.');
checkSub(!in_array('run_audit', $budiTools, true), 'Budi catalog does not include run_audit.');
checkSub(!in_array('run_terminal', $budiTools, true), 'Budi catalog does not include run_terminal.');

$dimasTools = array_column(KraReActEngine::getToolCatalog('dimas'), 'name');
checkSub(in_array('run_audit', $dimasTools, true), 'Dimas catalog has run_audit.');
checkSub(!in_array('stage_proposal', $dimasTools, true), 'Dimas catalog does not include stage_proposal.');
checkSub(!in_array('run_terminal', $dimasTools, true), 'Dimas catalog does not include run_terminal.');

$sitiTools = array_column(KraReActEngine::getToolCatalog('siti'), 'name');
checkSub(in_array('run_terminal', $sitiTools, true), 'Siti catalog has run_terminal.');
checkSub(!in_array('stage_proposal', $sitiTools, true), 'Siti catalog does not include stage_proposal.');

$mayaTools = array_column(KraReActEngine::getToolCatalog('maya'), 'name');
checkSub(in_array('stage_proposal', $mayaTools, true), 'Maya catalog has stage_proposal.');
checkSub(in_array('run_audit', $mayaTools, true), 'Maya catalog has run_audit.');

$ramaTools = array_column(KraReActEngine::getToolCatalog('rama'), 'name');
checkSub(count($ramaTools) >= 8, 'Rama (Boss) retains full supervisory tool catalog.');

// 2. Capability enforcement in executeTool
$dimasWriteAttempt = KraReActEngine::executeTool('stage_proposal', [
    'title' => 'Unauthorized write',
    'targetFile' => 'scratch.txt',
    'proposedContent' => 'test',
], 'dimas');
checkSub($dimasWriteAttempt['ok'] === false, 'Dimas cannot call stage_proposal directly.');
checkSub(str_contains($dimasWriteAttempt['error'] ?? '', 'Role boundary'),
    'Dimas blocked by role boundary enforcement.');

$budiAuditAttempt = KraReActEngine::executeTool('run_audit', [], 'budi');
checkSub($budiAuditAttempt['ok'] === false, 'Budi cannot execute run_audit.');
checkSub(str_contains($budiAuditAttempt['error'] ?? '', 'Role boundary'),
    'Budi blocked by role boundary enforcement.');

$sitiWriteAttempt = KraReActEngine::executeTool('stage_proposal', [
    'title' => 'Unauthorized ops proposal',
], 'siti');
checkSub($sitiWriteAttempt['ok'] === false, 'Siti cannot stage file proposals.');

// 3. Authorized tool calls succeed
$mayaRead = KraReActEngine::executeTool('read_file', ['path' => 'web/index.html'], 'maya');
checkSub($mayaRead['ok'] === true, 'Maya is authorized to read project files.');

$dimasAudit = KraReActEngine::executeTool('run_audit', [], 'dimas');
checkSub($dimasAudit['ok'] === true, 'Dimas is authorized to run audit scans.');

// 4. System prompt skill digest injection
$promptBudi = KraReActEngine::buildSystemPrompt('budi', '[]', 'buat modul baru');
checkSub(str_contains($promptBudi, 'You are Budi, Creator Agent'), 'Budi persona present in prompt.');
checkSub(str_contains($promptBudi, '[ACTIVE SKILL GOVERNANCE DIGEST]'), 'Skill digest present in prompt.');
checkSub(str_contains($promptBudi, 'Self-check rule'), 'Self-check rule enforced in prompt.');

$promptDimas = KraReActEngine::buildSystemPrompt('dimas', '[]', 'audit keamanan api');
checkSub(str_contains($promptDimas, 'You are Dimas, Auditor Agent'), 'Dimas persona present in prompt.');
checkSub(str_contains($promptDimas, 'ANTISLOP ACTIVE: after'), 'Dimas audit prompt switches to after mode.');

// 5. Alias normalization in engine
checkSub(KraReActEngine::toolAllowed('creator', 'stage_proposal') === true, 'creator alias maps to budi.');
checkSub(KraReActEngine::toolAllowed('auditor', 'stage_proposal') === false, 'auditor alias maps to dimas.');
checkSub(KraReActEngine::toolAllowed('modifier', 'stage_proposal') === true, 'modifier alias maps to maya.');
checkSub(KraReActEngine::toolAllowed('ops', 'run_terminal') === true, 'ops alias maps to siti.');

fwrite(STDOUT, str_repeat('=', 64) . "\n");
fwrite(STDOUT, "ALL SUBAGENT INDEPENDENT LAYER CHECKS PASSED\n");
