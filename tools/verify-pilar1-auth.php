<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDb.php';
require_once __DIR__ . '/../api/lib/KraAuth.php';

function checkPilar1(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

$pdo = KraDb::connect();
checkPilar1($pdo instanceof PDO, 'Database connection is available.');

KraAuth::seedDefaultOfficers();
$stmt = $pdo->query("SELECT COUNT(*) FROM kra_users");
$userCount = (int) $stmt->fetchColumn();
checkPilar1($userCount >= 5, "Default officers are seeded in kra_users (found: {$userCount}).");

$authRama = KraAuth::authenticate('kra_officer_rama');
checkPilar1($authRama !== null && $authRama['id'] === 'user_rama', 'KraAuth resolves Rama session.');

$authBudi = KraAuth::authenticate('kra_officer_budi');
checkPilar1($authBudi !== null && $authBudi['id'] === 'user_budi', 'KraAuth resolves Budi session.');

$authInvalid = KraAuth::authenticate('invalid_session_credential');
checkPilar1($authInvalid === null, 'Invalid credential safely rejected.');

$baseUrl = 'http://127.0.0.1/kantor-rama-ai/api/index.php';

function kraHttpCall(string $url, string $method = 'GET', ?array $postData = null, ?string $authHeaderVal = null): array
{
    $headers = ['Content-Type: application/json'];
    if ($authHeaderVal !== null) {
        $headers[] = 'Authorization: ' . $authHeaderVal;
    }

    $opts = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'ignore_errors' => true,
        ],
    ];

    if ($postData !== null) {
        $opts['http']['content'] = json_encode($postData);
    }

    $context = stream_context_create($opts);
    $response = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    preg_match('/HTTP\/\S+\s+(\d+)/', $statusLine, $matches);
    $statusCode = isset($matches[1]) ? (int) $matches[1] : 0;

    return [
        'status' => $statusCode,
        'body' => json_decode((string) $response, true) ?: [],
        'raw' => (string) $response,
    ];
}

// 1. Unauthenticated request must return HTTP 401
$unauth = kraHttpCall($baseUrl . '?action=decorations&floor=1', 'GET');
checkPilar1($unauth['status'] === 401, 'Unauthenticated decorations request rejected with HTTP 401.');
checkPilar1(($unauth['body']['ok'] ?? true) === false, '401 response contains ok=false.');

// 2. Clear pre-existing test decorations
kraHttpCall($baseUrl . '?action=clear-decor', 'POST', ['floor' => 1], 'Bearer kra_officer_rama');
kraHttpCall($baseUrl . '?action=clear-decor', 'POST', ['floor' => 1], 'Bearer kra_officer_budi');

// 3. Rama saves a trophy at (2, 2)
$ramaSave = kraHttpCall($baseUrl . '?action=save-decor', 'POST', [
    'floor' => 1,
    'x' => 2,
    'y' => 2,
    'item' => 'trophy',
], 'Bearer kra_officer_rama');
checkPilar1($ramaSave['status'] === 200 && ($ramaSave['body']['ok'] ?? false) === true, 'Rama saves trophy at (2, 2).');
checkPilar1(($ramaSave['body']['owner'] ?? '') === 'user_rama', 'Response confirms owner is user_rama.');

// 4. Budi fetches decorations for floor 1 -> must NOT see Rama's trophy
$budiFetch = kraHttpCall($baseUrl . '?action=decorations&floor=1', 'GET', null, 'Bearer kra_officer_budi');
checkPilar1($budiFetch['status'] === 200, 'Budi fetches decorations with HTTP 200.');
checkPilar1(($budiFetch['body']['owner'] ?? '') === 'user_budi', 'Budi endpoint scoped to user_budi.');
$budiItems = $budiFetch['body']['items'] ?? [];
$budiHasRamaTrophy = false;
foreach ($budiItems as $item) {
    if ((int) $item['tile_x'] === 2 && (int) $item['tile_y'] === 2) {
        $budiHasRamaTrophy = true;
    }
}
checkPilar1(!$budiHasRamaTrophy, 'Data isolation confirmed: Budi cannot see Rama trophy at (2, 2).');

// 5. IDOR Attack Simulation: Budi attempts to save item with owner='user_rama'
$idorAttempt = kraHttpCall($baseUrl . '?action=save-decor', 'POST', [
    'floor' => 1,
    'x' => 4,
    'y' => 4,
    'item' => 'cactus',
    'owner' => 'user_rama',
], 'Bearer kra_officer_budi');
checkPilar1($idorAttempt['status'] === 200, 'IDOR payload handled without error.');
checkPilar1(($idorAttempt['body']['owner'] ?? '') === 'user_budi', 'Server ignored client-sent owner and forced user_budi.');

// 6. Verify Rama still does not see Budi's item at (4, 4)
$ramaFetch = kraHttpCall($baseUrl . '?action=decorations&floor=1', 'GET', null, 'Bearer kra_officer_rama');
$ramaItems = $ramaFetch['body']['items'] ?? [];
$ramaHasBudiCactus = false;
$ramaHasOwnTrophy = false;
foreach ($ramaItems as $item) {
    if ((int) $item['tile_x'] === 4 && (int) $item['tile_y'] === 4) {
        $ramaHasBudiCactus = true;
    }
    if ((int) $item['tile_x'] === 2 && (int) $item['tile_y'] === 2 && $item['item_id'] === 'trophy') {
        $ramaHasOwnTrophy = true;
    }
}
checkPilar1(!$ramaHasBudiCactus, 'IDOR prevented: Rama does not have Budi cactus injected into their deck.');
checkPilar1($ramaHasOwnTrophy, 'Rama still retains own trophy at (2, 2).');

// 7. Isolation on deletion: Budi clears floor 1 -> Rama's items remain untouched
kraHttpCall($baseUrl . '?action=clear-decor', 'POST', ['floor' => 1], 'Bearer kra_officer_budi');
$ramaAfterBudiClear = kraHttpCall($baseUrl . '?action=decorations&floor=1', 'GET', null, 'Bearer kra_officer_rama');
$ramaItemsAfter = $ramaAfterBudiClear['body']['items'] ?? [];
$trophyStillThere = false;
foreach ($ramaItemsAfter as $item) {
    if ((int) $item['tile_x'] === 2 && (int) $item['tile_y'] === 2 && $item['item_id'] === 'trophy') {
        $trophyStillThere = true;
    }
}
checkPilar1($trophyStillThere, 'Clear isolation: Budi clearing deck does NOT delete Rama decorations.');

// Clean up test data
kraHttpCall($baseUrl . '?action=clear-decor', 'POST', ['floor' => 1], 'Bearer kra_officer_rama');
echo "\n[SUCCESS] Pilar 1: Authentication & User Deck Data Isolation 100% verified.\n";
