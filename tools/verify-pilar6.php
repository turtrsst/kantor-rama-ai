<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraTaskEngine.php';
require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraVaultSync.php';

function checkP6(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

$result = KraVaultSync::recordMeeting(
    'Pilar 6 Verification',
    ['Rama', 'Budi', 'Dimas'],
    [
        ['sender' => 'Budi', 'text' => 'Prototype summary ready.', 'kind' => 'speech'],
        ['sender' => 'Dimas', 'text' => 'Security review requested.', 'kind' => 'speech'],
        ['sender' => 'Rama', 'text' => 'Proceed through approval gate.', 'kind' => 'system'],
    ],
    'APPROVED',
    ['Verify proposal evidence before execution.']
);

checkP6(($result['ok'] ?? false) === true, 'Meeting report creation returns ok=true.');
$reportPath = (string) ($result['path'] ?? '');
checkP6($reportPath !== '' && is_file($reportPath), 'Meeting report exists in Obsidian reports directory.');
$content = (string) file_get_contents($reportPath);
checkP6(str_contains($content, 'Pilar 6 Verification'), 'Meeting report contains topic.');
checkP6(str_contains($content, 'Executive Verdict'), 'Meeting report contains executive verdict.');
checkP6(str_contains($content, 'Budi'), 'Meeting report contains dialogue participants.');

$dashboard = KraVaultSync::getVaultDir() . DIRECTORY_SEPARATOR . 'Dashboard KRA Project.md';
checkP6(is_file($dashboard), 'Dashboard KRA Project exists.');
$dashboardContent = (string) file_get_contents($dashboard);
checkP6(str_contains($dashboardContent, (string) $result['reportFile']), 'Dashboard links the meeting report.');

fwrite(STDOUT, "PILAR 6 MEETING MEMORY VERIFICATION PASSED\n");
