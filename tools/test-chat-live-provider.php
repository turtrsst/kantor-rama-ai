<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraAgentChat.php';

try {
    KraAgentChat::dispatch([
        'channel' => 'team',
        'message' => 'Selamat pagi',
        'provider' => 'simulator',
    ]);
    fwrite(STDERR, "FAIL: Team chat accepted the simulator provider.\n");
    exit(1);
} catch (RuntimeException $error) {
    if (!str_contains($error->getMessage(), 'configured live AI provider')) {
        fwrite(STDERR, "FAIL: Unexpected provider validation error.\n");
        exit(1);
    }
}

echo "[PASS] Team chat rejects simulator/template mode.\n";

$resolveAgent = new ReflectionMethod(KraAgentChat::class, 'resolveAgentId');
$studioAgentId = $resolveAgent->invoke(null, 'creator_studio_research', 'creator_research', 'test from Studio terminal');
$getAgentInfo = new ReflectionMethod(KraAgentChat::class, 'getAgentInfo');
$studioAgent = $getAgentInfo->invoke(null, $studioAgentId);
if ($studioAgentId !== 'creator_research' || ($studioAgent['name'] ?? '') !== 'Nara') {
    fwrite(STDERR, "FAIL: Dedicated Studio channel did not resolve to the selected built-in Creator persona.\n");
    exit(1);
}
echo "[PASS] Isolated Studio channel resolves to Nara's built-in live-chat persona.\n";

$recipientsForChannel = new ReflectionMethod(KraAgentChat::class, 'recipientsForChannel');
$studioRecipients = $recipientsForChannel->invoke(null, 'creator_studio_team', 'Mari kolaborasi', 'rama');
$expectedStudioRecipients = ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer'];
if ($studioRecipients !== $expectedStudioRecipients) {
    fwrite(STDERR, "FAIL: Studio Crew group did not target exactly its four Creator specialists.\n");
    exit(1);
}
echo "[PASS] Studio Crew group targets all four Creator specialists and excludes Virtual Office agents.\n";
$usesLiveModel = new ReflectionMethod(KraAgentChat::class, 'usesLiveModelForChannel');
if (!$usesLiveModel->invoke(null, 'creator_studio_team', count($expectedStudioRecipients))) {
    fwrite(STDERR, "FAIL: Studio Crew broadcast did not require live model replies.\n");
    exit(1);
}
echo "[PASS] Each Studio Crew broadcast reply requires the live model.\n";

$result = KraRouterGateway::completeWithFallback([
    'provider' => 'simulator',
    'allowSimulator' => false,
    'messages' => [['role' => 'user', 'content' => 'Selamat pagi']],
]);
if (($result['content'] ?? null) !== '' || empty($result['attempts'])) {
    fwrite(STDERR, "FAIL: Live chat fallback policy returned simulator content.\n");
    exit(1);
}

echo "[PASS] Live provider fallback chain excludes simulator output.\n";

$proposalMethod = new ReflectionMethod(KraAgentChat::class, 'detectProposal');
$proposal = $proposalMethod->invoke(
    null,
    'maya',
    'ubah file src/app.js: improve the mobile menu',
    "```js\nexport const menu = true;\n```",
    '/tmp/kra-workspace-test'
);
if (!is_array($proposal) || ($proposal['targetFile'] ?? '') !== 'src/app.js'
    || ($proposal['projectRoot'] ?? '') !== '/tmp/kra-workspace-test') {
    fwrite(STDERR, "FAIL: Workspace edit proposal lost its selected root or target.\n");
    exit(1);
}

echo "[PASS] File edit proposals retain workspace root and relative target.\n";

$unscopedProposal = $proposalMethod->invoke(
    null,
    'maya',
    'ubah file web/app.js: change the theme',
    "```js\nexport const theme = 'new';\n```",
    null
);
$readTargetMethod = new ReflectionMethod(KraAgentChat::class, 'readTargetReadOnly');
$unscopedRead = $readTargetMethod->invoke(null, '/etc/passwd', null);
if ($unscopedProposal !== null || !str_contains($unscopedRead, 'no files were opened')) {
    fwrite(STDERR, "FAIL: File edits without a selected workspace were not blocked.\n");
    exit(1);
}

echo "[PASS] File reads and modify proposals require a selected workspace.\n";

$normalizeAttachments = new ReflectionMethod(KraAgentChat::class, 'normalizeAttachments');
$attachments = $normalizeAttachments->invoke(null, [
    ['name' => '../brief.pdf', 'kind' => 'text', 'mimeType' => 'application/pdf', 'text' => 'Promo hanya berlaku sampai Jumat.'],
    ['name' => 'product.png', 'kind' => 'image', 'mimeType' => 'image/png', 'dataUrl' => 'data:image/png;base64,aGVsbG8='],
]);
$buildUserContent = new ReflectionMethod(KraAgentChat::class, 'buildUserContent');
$content = $buildUserContent->invoke(null, 'Buat broadcast WA dari sumber ini.', $attachments);
$hasImagePart = is_array($content) && count($content) === 4
    && ($content[3]['type'] ?? '') === 'image_url'
    && str_contains((string) ($content[1]['text'] ?? ''), 'Promo hanya berlaku');
$textOnly = $buildUserContent->invoke(null, 'Buat broadcast WA.', [$attachments[0]]);
if (!$hasImagePart || !is_string($textOnly) || !str_contains($textOnly, 'Promo hanya berlaku')
    || ($attachments[0]['name'] ?? '') !== 'brief.pdf') {
    fwrite(STDERR, "FAIL: Image and PDF/text attachment content was not prepared for the AI provider.\n");
    exit(1);
}
echo "[PASS] PDF reference text and image attachments map to provider message content.\n";

try {
    $normalizeAttachments->invoke(null, [
        ['name' => 'bad.svg', 'kind' => 'image', 'mimeType' => 'image/svg+xml', 'dataUrl' => 'data:image/svg+xml;base64,PHN2Zz4='],
    ]);
    fwrite(STDERR, "FAIL: Unsupported active image format was accepted.\n");
    exit(1);
} catch (ReflectionException $error) {
    throw $error;
} catch (Throwable) {
    echo "[PASS] Unsupported or malformed attachment payloads are rejected.\n";
}
