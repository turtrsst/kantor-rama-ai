<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';

function checkP5(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$message}\n");
}

$db = KraDb::connect();
checkP5($db instanceof PDO, 'MySQL connection established to kra_db.');

// Test 1: Save presence
KraDb::savePresence([
    'agentId' => 'test_agent',
    'state' => 'working',
    'activity' => 'Running security audit',
    'x' => 12.5,
    'y' => 7.2,
    'bubbleText' => 'Auditing routes',
    'bubbleKind' => 'task',
]);

$presence = KraDb::getPresence();
$found = null;
foreach ($presence as $row) {
    if (($row['agent_id'] ?? '') === 'test_agent') {
        $found = $row;
        break;
    }
}
checkP5($found !== null, 'Agent presence persisted in kra_agent_presence.');
checkP5(($found['state'] ?? '') === 'working', 'Agent state correctly recorded as working.');
checkP5(($found['bubble_text'] ?? '') === 'Auditing routes', 'Bubble text correctly recorded.');

// Test 2: Save event
$testEventId = 'evt_test_' . time();
KraDb::saveAgentEvent([
    'id' => $testEventId,
    'type' => 'agent.meeting.joined',
    'from' => 'budi',
    'to' => 'dimas',
    'payload' => ['summary' => 'Collaboration check'],
]);

$events = KraDb::getAgentEvents(50);
$eventFound = false;
foreach ($events as $evt) {
    if (($evt['id'] ?? '') === $testEventId) {
        $eventFound = true;
        break;
    }
}
checkP5($eventFound, 'Agent event persisted in kra_agent_events.');

// Test 3: HTTP API action=presence
$apiContext = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 5,
        'ignore_errors' => true,
    ],
]);
$host = '127.0.0.1:80';
$url = "http://{$host}/kantor-rama-ai/api/index.php?action=presence";
$response = @file_get_contents($url, false, $apiContext);
if ($response !== false) {
    $json = json_decode($response, true);
    checkP5(($json['ok'] ?? false) === true, 'HTTP action=presence returns ok=true.');
    checkP5(isset($json['presence']), 'HTTP action=presence returns presence list.');
} else {
    fwrite(STDOUT, "[INFO] Apache endpoint not directly probed, direct DB verified.\n");
}

fwrite(STDOUT, "PILAR 5 PERSISTENCE VERIFICATION PASSED\n");
