<?php
/* KRA runtime harness (php-wasm, host FS). No network/curl in this runtime:
   outbound HTTP calls must fail SOFT exactly as coded (caught + logged). */
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '1');
putenv('KRA_PRIVATE_CONFIG_DIR=/tmp/kra-test-config');
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

$root = '__KRA_ROOT__';
if (str_starts_with($root, '__')) $root = dirname(__DIR__, 2);
$pass = 0; $fail = 0;
function ok(string $name, bool $cond, string $extra = ''): void {
    global $pass, $fail;
    if ($cond) { $pass++; echo "PASS  $name"; } else { $fail++; echo "FAIL  $name"; }
    if ($extra !== '') echo "  — $extra";
    echo "\n";
}
function section(string $t): void { echo "\n== $t ==\n"; }

echo 'PHP ' . PHP_VERSION . ' | mbstring=' . (function_exists('mb_substr') ? 'yes' : 'NO')
   . ' curl=' . (function_exists('curl_init') ? 'yes' : 'no') . "\n";

require $root . '/api/lib/KraIntegrationSettings.php';
require $root . '/api/lib/KraSkillEngine.php';   // + KraSkillLock, KraSkillHub, KraDb
require $root . '/api/lib/KraTaskEngine.php';
require $root . '/api/lib/KraTelegramBridge.php';
require $root . '/api/lib/KraYouTubeOAuth.php';

section('1) Creator Skill Pack — digest injection');
$d = KraSkillEngine::digest('creator_writer', 'buatkan hook pembuka untuk video review kopi');
ok('T1 digest writer menyebut creator-hook-smith', str_contains($d, 'creator-hook-smith'));
ok('T1 digest berisi kutipan aturan (bukan sekadar nama)', strlen($d) > 400, strlen($d) . ' chars');
echo '      cuplikan: ' . str_replace("\n", ' ', substr($d, 0, 180)) . "...\n";
$d2 = KraSkillEngine::digest('creator_producer', 'tolong pakai /creator-concat-edit-brief untuk video ini');
ok('T2 sebutan eksplisit memaksa concat-edit-brief', str_contains($d2, 'creator-concat-edit-brief'));
$d3 = KraSkillEngine::digest('creator_research', 'tren konten apa minggu ini?');
ok('T3 digest Nara berisi trend-radar/fact-check', str_contains($d3, 'creator-trend-radar') || str_contains($d3, 'creator-fact-check'));
$catalog = KraSkillEngine::catalog();
$creatorApproved = array_filter($catalog, static fn ($s) => str_starts_with($s['id'], 'creator-') && ($s['approved'] ?? false) && !($s['drift'] ?? true));
ok('T4 katalog: 11 skill creator approved tanpa drift hash', count($creatorApproved) === 11, count($creatorApproved) . ' ok dari ' . count($catalog) . ' total');

section('2) Telegram — settings, token, pairing, webhook secret');
try { KraIntegrationSettings::saveTelegramToken('bukan-token-sama-sekali'); ok('T5 token invalid ditolak', false, 'tidak melempar'); }
catch (InvalidArgumentException $e) { ok('T5 token invalid ditolak', true, $e->getMessage()); }
KraIntegrationSettings::saveTelegramToken('123456789:AAE-abcdefghijklmnopqrstuvwxyz0123456789xyz');
$tg = KraIntegrationSettings::telegram();
ok('T6 token valid tersimpan + secret webhook dibuat', $tg['botToken'] !== '' && $tg['webhookSecret'] !== '');
ok('T7 status configured', KraTelegramBridge::status()['configured'] === true);
ok('T8 secret salah/null ditolak', !KraTelegramBridge::verifyWebhookSecret('salah') && !KraTelegramBridge::verifyWebhookSecret(null));
ok('T9 secret benar diterima', KraTelegramBridge::verifyWebhookSecret($tg['webhookSecret']));

$code = KraIntegrationSettings::startTelegramPairing();
ok('T10 kode pairing 6 karakter', strlen($code) === 6, $code);
// Simulasi update Telegram: orang asing dengan kode salah
KraTelegramBridge::handleUpdate(['message' => ['text' => '/start ZZZZZZ', 'chat' => ['id' => 999, 'type' => 'private', 'first_name' => 'Asing']]]);
ok('T11 kode salah tidak memasangkan', KraIntegrationSettings::telegram()['chatId'] === '');
// Pemilik dengan kode benar (sendTo akan gagal-soft: curl tidak ada di runtime ini)
KraTelegramBridge::handleUpdate(['message' => ['text' => '/start ' . $code, 'chat' => ['id' => 555, 'type' => 'private', 'first_name' => 'Pemilik']]]);
ok('T12 pairing pemilik tersimpan (chatId=555)', KraIntegrationSettings::telegram()['chatId'] === '555', KraIntegrationSettings::telegram()['chatTitle']);
ok('T13 kode sekali pakai (replay gagal)', !KraIntegrationSettings::consumeTelegramPairing($code, '777', 'X'));
// Chat grup diabaikan total
KraTelegramBridge::handleUpdate(['message' => ['text' => '/status', 'chat' => ['id' => -100, 'type' => 'group']]]);
ok('T14 update grup diabaikan tanpa error', true);
// Perintah dari chat terpasang: /status → statusText() merangkai banyak subsistem; tidak boleh fatal
try {
    KraTelegramBridge::handleUpdate(['message' => ['text' => '/status', 'chat' => ['id' => 555, 'type' => 'private', 'first_name' => 'Pemilik']]]);
    ok('T15 /status dari chat terpasang terproses (kirim gagal-soft tanpa curl)', true);
} catch (Throwable $e) { ok('T15 /status dari chat terpasang terproses', false, $e->getMessage()); }

try { KraTelegramBridge::setWebhook('http://localhost/kra'); ok('T16 webhook non-HTTPS ditolak', false, 'tidak melempar'); }
catch (InvalidArgumentException $e) { ok('T16 webhook non-HTTPS ditolak', true); }
try { KraTelegramBridge::setWebhook('https://example.com/kra'); ok('T17 webhook HTTPS lolos validasi (gagal di transport wajar)', false, 'harusnya berhenti di transport'); }
catch (Throwable $e) { ok('T17 webhook HTTPS lolos validasi, berhenti di transport (sandbox tanpa rute ke Telegram)', !str_contains($e->getMessage(), 'wajib HTTPS'), $e->getMessage()); }
ok('T17b registrasi gagal tidak merotasi secret tersimpan', KraIntegrationSettings::telegram()['webhookSecret'] === $tg['webhookSecret'] && KraTelegramBridge::verifyWebhookSecret($tg['webhookSecret']));

section('3) Proposal → notifikasi → approve via callback Telegram');
$task = KraTaskEngine::propose('creator_writer', 'create', 'Harness: naskah video tes', '/tmp/naskah.md', "# Tes\n", 'Proposal uji harness');
ok('T18 propose ()', ($task['status'] ?? '') === 'WAITING_APPROVAL' && str_starts_with($task['id'], 'KRA-'), $task['id']);
// Callback dari chat LAIN (999) tidak boleh menyetujui
KraTelegramBridge::handleUpdate(['callback_query' => ['id' => 'q1', 'data' => 'approve:' . $task['id'], 'message' => ['chat' => ['id' => 999, 'type' => 'private'], 'message_id' => 1]]]);
ok('T19 callback chat asing tidak menyetujui', (KraTaskEngine::loadTasks()[$task['id']]['status'] ?? '') === 'WAITING_APPROVAL');
// Callback pemilik menyetujui
KraTelegramBridge::handleUpdate(['callback_query' => ['id' => 'q2', 'data' => 'approve:' . $task['id'], 'message' => ['chat' => ['id' => 555, 'type' => 'private'], 'message_id' => 2]]]);
$after = KraTaskEngine::loadTasks()[$task['id']]['status'] ?? '?';
ok('T20 callback pemilik memproses proposal', $after !== 'WAITING_APPROVAL', 'status akhir: ' . $after);
// Callback kedua (sudah tidak menunggu) aman
KraTelegramBridge::handleUpdate(['callback_query' => ['id' => 'q3', 'data' => 'reject:' . $task['id'], 'message' => ['chat' => ['id' => 555, 'type' => 'private'], 'message_id' => 3]]]);
ok('T21 callback duplikat aman (tidak fatal)', true);

section('4) YouTube Analytics — jalur error tanpa koneksi');
$st = KraYouTubeOAuth::status();
ok('T22 status() expose analyticsGranted=false saat belum connect', ($st['analyticsGranted'] ?? null) === false && $st['connected'] === false);
try { KraYouTubeOAuth::analyticsSummary(); ok('T23 analyticsSummary tanpa channel melempar error jelas', false, 'tidak melempar'); }
catch (Throwable $e) { ok('T23 analyticsSummary tanpa channel melempar error jelas', str_contains($e->getMessage(), 'belum terhubung'), $e->getMessage()); }

section('5) Fast fan-out Studio Crew (provider tak terjangkau → entri error)');
require $root . '/api/lib/KraAgentChat.php';
try {
    $one = KraAgentChat::dispatch([
        'channel' => 'creator_studio_team', 'agentId' => 'creator_writer',
        'message' => 'tes fanout', 'provider' => 'ollama', 'model' => 'llama3.1',
        'fanout' => true, 'fanoutPrimary' => true,
    ]);
    $replies = $one['replies'] ?? [];
    ok('T24 fanout: tepat 1 recipient terlayani', count($replies) === 1, count($replies) . ' balasan');
    ok('T25 fanout: recipient = yang diminta (creator_writer)', ($replies[0]['agentId'] ?? '') === 'creator_writer', (string) ($replies[0]['agentId'] ?? '-'));
    ok('T26 fanout: flag fanout=true di hasil', ($one['fanout'] ?? false) === true);
    ok('T27 fanout: routing.skills = skill efektif (default writer) untuk chip UI', !empty($replies[0]['routing']['skills']), json_encode($replies[0]['routing']['skills'] ?? []));
} catch (Throwable $e) {
    ok('T24-T27 fanout dispatch', false, get_class($e) . ': ' . $e->getMessage());
}
try {
    $group = KraAgentChat::dispatch([
        'channel' => 'creator_studio_team', 'message' => 'tes grup lama',
        'provider' => 'ollama', 'model' => 'llama3.1',
    ]);
    ok('T28 tanpa fanout: grup tetap 4 specialist (perilaku lama utuh)', count($group['replies'] ?? []) === 4, count($group['replies'] ?? []) . ' balasan');
} catch (Throwable $e) {
    ok('T28 tanpa fanout: grup 4 specialist', false, get_class($e) . ': ' . $e->getMessage());
}
try {
    KraAgentChat::dispatch(['channel' => 'office', 'agentId' => 'creator_writer', 'message' => 'halo', 'provider' => 'ollama']);
    ok('T29 specialist Creator ditolak di channel Office', false, 'tidak melempar');
} catch (InvalidArgumentException $e) {
    ok('T29 specialist Creator ditolak di channel Office', true, $e->getMessage());
}

section('6) Fleksibilitas perintah (regresi dari analisis kegagalan)');
$ref = static function (string $method): ReflectionMethod {
    $m = new ReflectionMethod('KraAgentChat', $method);
    if (PHP_VERSION_ID < 80500) $m->setAccessible(true);
    return $m;
};
$detect = $ref('detectProposal');
$resolveAgent = $ref('resolveAgentId');
$fenced = "```markdown\n# Naskah Kopi\nPembuka yang kuat...\n```";
$longText = 'Berikut naskah lengkapnya: segmen satu membuka dengan pertanyaan retoris, segmen dua masuk ke data, segmen tiga menutup dengan ajakan bertindak.';
$p = $detect->invoke(null, 'creator_writer', 'Buatkan naskah video tentang kopi', $fenced, null);
ok('T30 perintah natural "buatkan naskah" jadi proposal .md berisi balasan', is_array($p) && str_ends_with($p['targetFile'], '.md') && str_contains($p['proposedContent'], '# Naskah Kopi'), is_array($p) ? $p['targetFile'] : 'null');
$p = $detect->invoke(null, 'creator_writer', 'Tulis script 60 detik lalu simpan', $longText, null);
ok('T31 "tulis script lalu simpan" jadi proposal dokumen (isi = teks balasan)', is_array($p) && str_contains($p['proposedContent'], 'segmen satu'), is_array($p) ? $p['targetFile'] : 'null');
$p = $detect->invoke(null, 'budi', 'buatkan file laporan.php', 'Baik, rancangannya begini: pertama tabel, lalu query.', null);
ok('T32 target kode tanpa code fence TIDAK jadi proposal stub', $p === null);
$p = $detect->invoke(null, 'creator_writer', '/create laporan.md', $fenced, null);
ok('T33 "/create laporan.md" menghormati nama file', is_array($p) && $p['targetFile'] === 'proposals/laporan.md', is_array($p) ? $p['targetFile'] : 'null');
ok('T34 sapaan biasa tidak jadi proposal', $detect->invoke(null, 'creator_writer', 'halo apa kabar', $longText, null) === null);
$r = KraTaskRouter::route('creator_reviewer', 'Tolong cek fakta klaim ini');
ok('T35 router: "cek fakta" (ID) memilih creator-fact-check', in_array('creator-fact-check', $r['skills'], true), json_encode($r['skills']));
$r = KraTaskRouter::route('creator_writer', 'Saya creator pemula, buatkan hook kopi');
ok('T36 router: kata "creator" tidak lagi menarik skill acak', $r['skills'] === ['creator-hook-smith'], json_encode($r['skills']));
ok('T37 router: sapaan dengan "lalu" bukan ReAct', KraTaskRouter::route('rama', 'Halo apa kabar? Lalu agenda hari ini apa?')['mode'] === 'single');
ok('T38 router: "perbaiki bug lalu deploy" tetap ReAct', KraTaskRouter::route('budi', 'Tolong perbaiki bug login lalu deploy')['mode'] === 'react');
ok('T39 resolusi agen: "budidaya" tidak memanggil Budi', $resolveAgent->invoke(null, 'team', '', 'bahas budidaya ikan lele') === 'rama');
ok('T40 resolusi agen: "tanya budi" tetap Budi', $resolveAgent->invoke(null, 'team', '', 'tolong tanya budi ya') === 'budi');
KraDb::logChat('User', 'pesan fallback uji memori', 'office');
$hist = KraDb::getChatHistory('office', 12);
$found = false;
foreach ($hist as $row) { if (($row['message'] ?? '') === 'pesan fallback uji memori') $found = true; }
ok('T41 tanpa MySQL riwayat chat tersimpan via fallback JSON', KraDb::connect() === null && $found, count($hist) . ' pesan');
@unlink($root . '/.temp/chat-history.json');
try {
    $res = KraAgentChat::dispatch([
        'channel' => 'creator_studio_team', 'agentId' => 'creator_writer',
        'message' => 'tes folder basi', 'provider' => 'ollama', 'model' => 'llama3.1',
        'fanout' => true, 'fanoutPrimary' => true, 'projectRoot' => '/folder/sudah/dipindah',
    ]);
    ok('T42 projectRoot basi: chat tetap hidup + workspaceWarning terisi', count($res['replies'] ?? []) === 1 && !empty($res['workspaceWarning']));
} catch (Throwable $e) {
    ok('T42 projectRoot basi: chat tetap hidup', false, $e->getMessage());
}

echo "\n== RINGKASAN: $pass PASS, $fail FAIL ==\n";
