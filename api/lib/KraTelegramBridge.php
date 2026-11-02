<?php
declare(strict_types=1);

require_once __DIR__ . '/KraIntegrationSettings.php';
require_once __DIR__ . '/KraTenantContext.php';
require_once __DIR__ . '/KraEntitlements.php';

/**
 * KraTelegramBridge — bot Telegram untuk memantau (dan menyetujui) pekerjaan
 * para agen KRA dari HP.
 *
 * Keamanan: bot hanya melayani SATU chat privat yang sudah dipasangkan
 * (pairing) lewat kode sekali pakai dari Creator Integration Settings.
 * Webhook divalidasi header rahasia Telegram. Token bot disimpan server-side
 * (KraIntegrationSettings) dan tidak pernah dikirim ke browser.
 *
 * Perintah: /status /proposal /tugas /crew /n100n /youtube /help
 * Tombol inline pada /proposal menjalankan KraTaskEngine::approve/reject —
 * kekuatan yang sama dengan tombol approval di UI Task Board.
 */
final class KraTelegramBridge
{
    private static function workspaceEntitlement(): ?array
    {
        $workspace = KraTenantContext::workspace();
        if (!is_array($workspace) || !class_exists('KraEntitlements')) return null;
        $owner = null;
        if (class_exists('KraAuth')) $owner = KraAuth::findUserById((string) ($workspace['ownerUserId'] ?? ''));
        try { return KraEntitlements::resolve($owner, $workspace); } catch (Throwable) { return null; }
    }

    private static function workspaceFeature(string $feature): bool
    {
        if (!KraTenantContext::hasWorkspace()) return true; // legacy single-owner CLI/local path
        $entitlement = self::workspaceEntitlement();
        return $entitlement !== null && in_array($feature, (array) ($entitlement['features'] ?? []), true);
    }

    private static function request(string $method, array $payload): array
    {
        $settings = KraIntegrationSettings::telegram();
        $token = $settings['botToken'];
        if ($token === '') throw new RuntimeException('Bot token Telegram belum disimpan di KRA.');
        if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL diperlukan untuk Telegram Bot API.');
        $handle = curl_init('https://api.telegram.org/bot' . $token . '/' . $method);
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        $decoded = is_string($body) ? json_decode($body, true) : null;
        if (!is_array($decoded) || empty($decoded['ok'])) {
            $description = is_array($decoded) ? (string) ($decoded['description'] ?? '') : '';
            throw new RuntimeException('Telegram ' . $method . ' gagal: ' . ($description !== '' ? $description : ($error !== '' ? $error : 'HTTP ' . $status)));
        }
        return is_array($decoded['result'] ?? null) ? $decoded['result'] : ['ok' => true];
    }

    public static function status(): array
    {
        $settings = KraIntegrationSettings::telegram();
        $envManaged = (!KraTenantContext::isHosted() || KraTenantContext::canUseLegacyIntegrations())
            && ((string) getenv('KRA_TELEGRAM_BOT_TOKEN') !== '' || (string) getenv('KRA_TELEGRAM_CHAT_ID') !== '');
        return [
            'configured' => $settings['botToken'] !== '',
            'paired' => $settings['chatId'] !== '',
            'chatTitle' => $settings['chatTitle'],
            'webhookUrl' => $settings['webhookUrl'],
            'environmentManaged' => $envManaged,
            'workspaceId' => KraTenantContext::workspaceId(),
            'notificationsAllowed' => self::workspaceFeature('telegram_notifications'),
            'approvalsAllowed' => self::workspaceFeature('telegram_approvals'),
        ];
    }

    private static function clip(string $text, int $max): string
    {
        $text = trim($text);
        return strlen($text) > $max ? rtrim(mb_substr($text, 0, $max)) . '…' : $text;
    }

    public static function sendTo(string $chatId, string $text, ?array $inlineKeyboard = null): bool
    {
        if ($chatId === '') return false;
        $payload = [
            'chat_id' => $chatId,
            'text' => self::clip($text, 4000),
            'disable_web_page_preview' => true,
        ];
        if ($inlineKeyboard !== null) $payload['reply_markup'] = ['inline_keyboard' => $inlineKeyboard];
        try {
            self::request('sendMessage', $payload);
            return true;
        } catch (Throwable $error) {
            error_log('[KraTelegramBridge] sendMessage gagal: ' . $error->getMessage());
            return false;
        }
    }

    /** Best-effort notification to the paired owner chat; never throws. */
    public static function notify(string $text): void
    {
        if (!self::workspaceFeature('telegram_notifications')) return;
        $settings = KraIntegrationSettings::telegram();
        if ($settings['botToken'] === '' || $settings['chatId'] === '') return;
        self::sendTo($settings['chatId'], $text);
    }

    public static function setWebhook(string $publicBaseUrl): array
    {
        $publicBaseUrl = rtrim(trim($publicBaseUrl), '/');
        $parts = parse_url($publicBaseUrl);
        if ($publicBaseUrl === '' || !is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || empty($parts['host'])) {
            throw new InvalidArgumentException('Webhook Telegram wajib HTTPS publik. Isi base URL publik KRA, mis. https://kantor-rama-ai.my.id');
        }
        $settings = KraIntegrationSettings::telegram();
        if ($settings['botToken'] === '') {
            throw new RuntimeException('Simpan bot token dulu, lalu daftarkan webhook.');
        }
        // Rotate the secret on every registration: re-registering the webhook
        // is also how the owner replaces a leaked secret. The new secret is
        // persisted only after Telegram accepts it, so a failed call leaves
        // the previously registered secret in sync.
        $secret = bin2hex(random_bytes(24));
        $url = $publicBaseUrl . '/api/index.php?action=telegram-webhook';
        if (KraTenantContext::hasWorkspace()) $url .= '&workspace=' . rawurlencode(KraTenantContext::workspaceId());
        self::request('setWebhook', [
            'url' => $url,
            'secret_token' => $secret,
            'allowed_updates' => ['message', 'callback_query'],
            'drop_pending_updates' => true,
        ]);
        KraIntegrationSettings::saveTelegramWebhookSecret($secret);
        KraIntegrationSettings::saveTelegramWebhookUrl($url);
        return ['webhookUrl' => $url];
    }

    public static function removeWebhook(): void
    {
        try {
            self::request('deleteWebhook', ['drop_pending_updates' => false]);
        } catch (Throwable $error) {
            error_log('[KraTelegramBridge] deleteWebhook gagal: ' . $error->getMessage());
        }
        KraIntegrationSettings::saveTelegramWebhookUrl('');
    }

    public static function verifyWebhookSecret(?string $headerValue): bool
    {
        $secret = KraIntegrationSettings::telegram()['webhookSecret'];
        return $secret !== '' && is_string($headerValue) && hash_equals($secret, $headerValue);
    }

    // --- Update handling (webhook) --------------------------------------

    public static function handleUpdate(array $update): void
    {
        try {
            if (isset($update['callback_query']) && is_array($update['callback_query'])) {
                self::handleCallback($update['callback_query']);
                return;
            }
            $message = $update['message'] ?? null;
            if (!is_array($message)) return;
            $chat = is_array($message['chat'] ?? null) ? $message['chat'] : [];
            if (($chat['type'] ?? '') !== 'private') return; // bot ini privat: abaikan grup/channel
            $chatId = (string) ($chat['id'] ?? '');
            if ($chatId === '') return;
            $text = trim((string) ($message['text'] ?? ''));
            $settings = KraIntegrationSettings::telegram();
            $pairedHere = $settings['chatId'] !== '' && hash_equals($settings['chatId'], $chatId);

            if (!$pairedHere) {
                if (preg_match('/^\/start\s+([A-Za-z0-9]{6})$/', $text, $m) === 1
                    && KraIntegrationSettings::consumeTelegramPairing($m[1], $chatId, self::chatTitle($chat))) {
                    self::sendTo($chatId, "✅ Terhubung ke KRA. Bot ini sekarang hanya melayani chat ini.\n\n" . self::helpText());
                } else {
                    self::sendTo($chatId, 'Bot pemantau KRA ini privat. Untuk memasangkan: buka KRA → Creator Integration Settings → Telegram → BUAT KODE PAIRING, lalu kirim "/start KODE" ke sini.');
                }
                return;
            }

            $command = strtolower(explode('@', explode(' ', $text)[0] ?? '')[0]);
            switch ($command) {
                case '/start':
                case '/help':
                    self::sendTo($chatId, self::helpText());
                    break;
                case '/status':
                    self::sendTo($chatId, self::statusText());
                    break;
                case '/proposal':
                    self::sendProposals($chatId);
                    break;
                case '/tugas':
                    self::sendTo($chatId, self::tasksText());
                    break;
                case '/crew':
                    self::sendTo($chatId, self::crewText());
                    break;
                case '/n100n':
                    self::sendTo($chatId, self::n100nText());
                    break;
                case '/youtube':
                    self::sendTo($chatId, self::youtubeText());
                    break;
                default:
                    self::sendTo($chatId, "Perintah tidak dikenal.\n\n" . self::helpText());
            }
        } catch (Throwable $error) {
            error_log('[KraTelegramBridge] handleUpdate gagal: ' . $error->getMessage());
        }
    }

    private static function chatTitle(array $chat): string
    {
        $name = trim((string) (($chat['first_name'] ?? '') . ' ' . ($chat['last_name'] ?? '')));
        if ($name === '') $name = (string) ($chat['username'] ?? '');
        return $name !== '' ? $name : 'Pemilik KRA';
    }

    private static function handleCallback(array $callback): void
    {
        $chatId = (string) ($callback['message']['chat']['id'] ?? '');
        $settings = KraIntegrationSettings::telegram();
        $answer = static function (string $text) use ($callback): void {
            try {
                self::request('answerCallbackQuery', ['callback_query_id' => (string) ($callback['id'] ?? ''), 'text' => $text]);
            } catch (Throwable) {
            }
        };
        if ($chatId === '' || $settings['chatId'] === '' || !hash_equals($settings['chatId'], $chatId)) {
            $answer('Chat ini tidak terpasang ke KRA.');
            return;
        }
        $data = (string) ($callback['data'] ?? '');
        if (preg_match('/^(approve|reject):([A-Za-z0-9_-]{1,32})$/', $data, $m) !== 1) {
            $answer('Aksi tidak dikenal.');
            return;
        }
        [, $verb, $taskId] = $m;
        $tasks = KraTaskEngine::loadTasks();
        $task = $tasks[$taskId] ?? null;
        if (!is_array($task) || ($task['status'] ?? '') !== 'WAITING_APPROVAL') {
            $answer('Proposal ' . $taskId . ' sudah tidak menunggu approval.');
            self::sendTo($chatId, 'ℹ️ Proposal ' . $taskId . ' sudah berstatus ' . (is_array($task) ? (string) ($task['status'] ?? '?') : 'tidak ditemukan') . ' (mungkin sudah diproses dari UI Task Board).');
            return;
        }
        if (!self::workspaceFeature('telegram_approvals')) {
            $answer('Paket workspace belum mencakup approval Telegram.');
            self::sendTo($chatId, '🔒 Approval dari Telegram memerlukan KRA PLUS/PLATINUM (admin SIAS bebas akses). Proposal tetap aman dan dapat ditinjau dari Task Board KRA.');
            return;
        }
        try {
            $result = $verb === 'approve'
                ? KraTaskEngine::approve($taskId, 'Telegram')
                : KraTaskEngine::reject($taskId, 'Ditolak via Telegram');
            $answer($verb === 'approve' ? 'Disetujui.' : 'Ditolak.');
            self::sendTo($chatId, ($verb === 'approve' ? '✅ Disetujui & dijalankan: ' : '❌ Ditolak: ')
                . $taskId . ' — ' . self::clip((string) ($task['title'] ?? ''), 120)
                . ' (status akhir: ' . (string) ($result['status'] ?? '?') . ')');
        } catch (Throwable $error) {
            $answer('Gagal memproses.');
            self::sendTo($chatId, '⚠️ Gagal memproses ' . $taskId . ': ' . self::clip($error->getMessage(), 300));
        }
    }

    private static function helpText(): string
    {
        return "🤖 Pemantau KRA — perintah:\n"
            . "/status — kesehatan KRA (provider, N100N, YouTube, tugas)\n"
            . "/proposal — proposal menunggu approval (bisa disetujui dari sini)\n"
            . "/tugas — ringkasan Task Board\n"
            . "/crew — aktivitas terakhir Studio Crew\n"
            . "/n100n — status & daftar workflow\n"
            . "/youtube — status koneksi channel\n"
            . "Notifikasi otomatis terkirim saat ada proposal baru & upload YouTube selesai.";
    }

    private static function statusText(): string
    {
        $lines = ['🩺 Status KRA — ' . gmdate('Y-m-d H:i') . ' UTC'];
        try {
            $config = ProviderConfig::load();
            $configured = 0;
            foreach ((array) ($config['providers'] ?? []) as $provider) {
                if (!empty($provider['configured'])) $configured++;
            }
            $lines[] = 'Provider AI live terkonfigurasi: ' . $configured;
        } catch (Throwable) {
            $lines[] = 'Provider AI: tidak terbaca.';
        }
        try {
            $n100n = KraN100nClient::status();
            $lines[] = 'N100N: ' . (($n100n['ok'] ?? false) ? 'online' : (($n100n['configured'] ?? false) ? 'offline/terkonfigurasi' : 'belum dikonfigurasi'));
        } catch (Throwable) {
            $lines[] = 'N100N: tidak terbaca.';
        }
        $lines[] = self::youtubeText();
        $counts = [];
        foreach (KraTaskEngine::loadTasks() as $task) {
            $status = (string) ($task['status'] ?? '?');
            $counts[$status] = ($counts[$status] ?? 0) + 1;
        }
        $lines[] = 'Task Board: ' . ($counts !== [] ? implode(' · ', array_map(static fn ($k, $v) => $v . ' ' . $k, array_keys($counts), $counts)) : 'kosong');
        return implode("\n", $lines);
    }

    private static function youtubeText(): string
    {
        if (!class_exists('KraYouTubeOAuth')) return 'YouTube: modul tidak dimuat.';
        $youtube = KraYouTubeOAuth::status();
        if (!($youtube['connected'] ?? false)) return 'YouTube: belum terhubung.';
        return 'YouTube: terhubung ke "' . (string) ($youtube['channelTitle'] ?? 'channel') . '"'
            . (($youtube['canUpload'] ?? false) ? ' (izin upload aktif)' : ' (izin upload belum diberikan — authorize ulang di KRA)');
    }

    private static function sendProposals(string $chatId): void
    {
        $waiting = array_values(array_filter(
            KraTaskEngine::loadTasks(),
            static fn (array $task): bool => ($task['status'] ?? '') === 'WAITING_APPROVAL'
        ));
        if ($waiting === []) {
            self::sendTo($chatId, '📋 Tidak ada proposal yang menunggu approval.');
            return;
        }
        self::sendTo($chatId, '📋 ' . count($waiting) . ' proposal menunggu approval (menampilkan maks. 5):');
        foreach (array_slice($waiting, 0, 5) as $task) {
            $id = (string) ($task['id'] ?? '');
            $text = '📝 ' . $id . ' — ' . self::clip((string) ($task['title'] ?? 'Tanpa judul'), 140) . "\n"
                . 'Agent: ' . (string) ($task['agentId'] ?? '?')
                . ' · Target: ' . self::clip((string) ($task['targetFile'] ?? '-'), 80) . "\n"
                . self::clip((string) ($task['summary'] ?? ''), 200);
            $keyboard = self::workspaceFeature('telegram_approvals') ? [[
                ['text' => '✅ Approve', 'callback_data' => 'approve:' . $id],
                ['text' => '❌ Tolak', 'callback_data' => 'reject:' . $id],
            ]] : null;
            if ($keyboard === null) $text .= "\n🔒 Approval Telegram memerlukan PLUS/PLATINUM; tinjau dari Task Board.";
            self::sendTo($chatId, $text, $keyboard);
        }
    }

    private static function tasksText(): string
    {
        $tasks = array_values(KraTaskEngine::loadTasks());
        if ($tasks === []) return '🗂️ Task Board kosong.';
        usort($tasks, static fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        $lines = ['🗂️ ' . count($tasks) . ' tugas. Terbaru:'];
        foreach (array_slice($tasks, 0, 5) as $task) {
            $lines[] = '• ' . (string) ($task['id'] ?? '?') . ' [' . (string) ($task['status'] ?? '?') . '] '
                . self::clip((string) ($task['title'] ?? ''), 90);
        }
        return implode("\n", $lines);
    }

    private static function crewText(): string
    {
        $rows = class_exists('KraDb') ? KraDb::getChatHistory('creator_studio_team', 5) : [];
        if ($rows === []) return '🎬 Belum ada aktivitas Studio Crew yang tercatat (atau database offline).';
        $lines = ['🎬 Aktivitas terakhir Studio Crew:'];
        foreach ($rows as $row) {
            $lines[] = '• ' . (string) ($row['sender'] ?? '?') . ': ' . self::clip((string) ($row['message'] ?? ''), 180);
        }
        return implode("\n", $lines);
    }

    private static function n100nText(): string
    {
        try {
            $status = KraN100nClient::status();
            if (!($status['ok'] ?? false)) {
                return '⚙️ N100N: ' . (($status['configured'] ?? false) ? 'offline — periksa service Node di server.' : 'belum dikonfigurasi di KRA.');
            }
            $names = [];
            foreach (KraN100nClient::workflows() as $workflow) {
                if (isset($workflow['name'])) $names[] = '#' . (string) ($workflow['id'] ?? '?') . ' ' . (string) $workflow['name'];
                if (count($names) >= 10) break;
            }
            return "⚙️ N100N online. Workflow:\n" . ($names !== [] ? implode("\n", array_map(static fn ($n) => '• ' . $n, $names)) : '(daftar kosong)');
        } catch (Throwable $error) {
            return '⚙️ N100N: gagal dihubungi (' . self::clip($error->getMessage(), 160) . ').';
        }
    }
}
