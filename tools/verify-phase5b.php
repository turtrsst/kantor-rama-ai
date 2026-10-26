<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';
require_once __DIR__ . '/../api/lib/KraAgentChat.php';

function check5b(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

$pdo = KraDb::connect();
check5b($pdo instanceof PDO, 'MySQL chat persistence is available.');

$team = KraAgentChat::dispatch([
    'channel' => 'team',
    'message' => 'Phase 5B team channel health probe',
]);
check5b($team['ok'] === true, 'Team agent dispatch returns ok=true.');
check5b($team['agentId'] === 'rama', 'Team channel defaults to Rama coordination.');
check5b($team['message'] !== '', 'Team agent dispatch returns a reply.');

$budi = KraAgentChat::dispatch([
    'channel' => 'budi',
    'message' => 'Buatkan file phase 5b probe',
]);
check5b($budi['agentId'] === 'budi', 'Private Budi channel selects Budi.');
check5b(is_array($budi['proposal']), 'Create request produces an approval-gated proposal.');
check5b(str_starts_with($budi['proposal']['targetFile'], 'proposals/'), 'Chat proposal targets proposals directory.');

$teamHistory = KraDb::getChatHistory('team', 10);
check5b(count($teamHistory) >= 2, 'Team messages persist in channel history.');
$budiHistory = KraDb::getChatHistory('budi', 10);
check5b(count($budiHistory) >= 2, 'Private agent messages persist in channel history.');

$base = rtrim((string) (getenv('KRA_API_BASE') ?: 'http://100.76.172.67:8088/api/index.php'), '/');
$historyRaw = file_get_contents($base . '?action=chat-history&channel=team&limit=10');
$history = json_decode((string) $historyRaw, true);
check5b(is_array($history) && $history['ok'] === true, 'HTTP chat-history returns ok=true.');
check5b(is_array($history['messages'] ?? null), 'HTTP chat-history returns message collection.');

$body = json_encode(['channel' => 'dimas', 'message' => 'Audit Phase 5B chat flow']);
$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $body,
        'timeout' => 30,
        'ignore_errors' => true,
    ],
]);
$chatRaw = file_get_contents($base . '?action=chat-agent', false, $context);
$chat = json_decode((string) $chatRaw, true);
check5b(is_array($chat) && $chat['ok'] === true, 'HTTP chat-agent returns ok=true.');
check5b(($chat['agentId'] ?? '') === 'dimas', 'HTTP chat-agent selects requested private agent.');

echo "PHASE 5B VERIFICATION PASSED\n";
