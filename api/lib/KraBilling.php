<?php
declare(strict_types=1);

require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraEntitlements.php';

/**
 * Subscription, manual checkout order, and signed billing-webhook storage.
 * No central AI-token balance is sold here: plans license KRA features while
 * AI inference stays BYOK/Ollama on the user's own installation/server.
 */
final class KraBilling
{
    public static function subscriptionForUser(string $userId): ?array
    {
        $userId = trim($userId);
        if ($userId === '') return null;
        $db = KraDb::connect();
        if (!$db instanceof PDO) return null;
        $stmt = $db->prepare('SELECT * FROM kra_subscriptions WHERE user_id = :user LIMIT 1');
        $stmt->execute([':user' => $userId]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    public static function upsertSubscription(array $data, string $actorUserId = 'system', string $eventType = 'subscription.manual_upsert'): array
    {
        $userId = trim((string) ($data['userId'] ?? $data['user_id'] ?? ''));
        if ($userId === '') throw new InvalidArgumentException('userId wajib diisi.');
        $plan = KraEntitlements::normalizePlan((string) ($data['plan'] ?? 'pro'));
        if ($plan === 'free' && strtolower((string) ($data['status'] ?? '')) !== 'canceled') {
            throw new InvalidArgumentException('Pilih PRO, PLUS, atau PLATINUM.');
        }
        $period = strtolower(trim((string) ($data['billingPeriod'] ?? $data['billing_period'] ?? 'monthly')));
        if (!in_array($period, ['monthly', 'yearly'], true)) $period = 'monthly';
        $status = strtolower(trim((string) ($data['status'] ?? 'active')));
        if (!in_array($status, ['active', 'trialing', 'past_due', 'pending', 'canceled', 'cancelled', 'expired'], true)) $status = 'active';

        $startsAt = self::dateOrNull($data['startsAt'] ?? $data['starts_at'] ?? gmdate(DATE_ATOM));
        $endsAt = self::dateOrNull($data['currentPeriodEnd'] ?? $data['current_period_end'] ?? $data['expiresAt'] ?? null);
        if ($endsAt === null) {
            $base = $startsAt !== null ? strtotime($startsAt) : time();
            $endsAt = gmdate('Y-m-d H:i:s', strtotime($period === 'yearly' ? '+1 year' : '+1 month', $base ?: time()));
        }
        $trialEndsAt = self::dateOrNull($data['trialEndsAt'] ?? $data['trial_ends_at'] ?? ($status === 'trialing' ? $endsAt : null));

        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia; langganan belum disimpan.');
        $stmt = $db->prepare('INSERT INTO kra_subscriptions
            (user_id, plan, billing_period, status, starts_at, current_period_end, trial_ends_at,
             cancel_at_period_end, canceled_at, payment_provider, external_customer_id,
             external_subscription_id, last_payment_at)
            VALUES (:user, :plan, :period, :status, :starts, :ends, :trial, :cancel_end, :canceled,
                    :provider, :customer, :external_sub, :paid)
            ON DUPLICATE KEY UPDATE plan=VALUES(plan), billing_period=VALUES(billing_period),
              status=VALUES(status), starts_at=VALUES(starts_at), current_period_end=VALUES(current_period_end),
              trial_ends_at=VALUES(trial_ends_at), cancel_at_period_end=VALUES(cancel_at_period_end),
              canceled_at=VALUES(canceled_at), payment_provider=VALUES(payment_provider),
              external_customer_id=VALUES(external_customer_id),
              external_subscription_id=VALUES(external_subscription_id), last_payment_at=VALUES(last_payment_at)');
        $isCanceled = in_array($status, ['canceled', 'cancelled'], true);
        $stmt->execute([
            ':user' => $userId,
            ':plan' => $plan,
            ':period' => $period,
            ':status' => $status === 'cancelled' ? 'canceled' : $status,
            ':starts' => $startsAt,
            ':ends' => $endsAt,
            ':trial' => $trialEndsAt,
            ':cancel_end' => !empty($data['cancelAtPeriodEnd'] ?? $data['cancel_at_period_end'] ?? false) ? 1 : 0,
            ':canceled' => $isCanceled ? gmdate('Y-m-d H:i:s') : null,
            ':provider' => substr(trim((string) ($data['paymentProvider'] ?? $data['payment_provider'] ?? 'manual')), 0, 64) ?: 'manual',
            ':customer' => self::nullableString($data['externalCustomerId'] ?? $data['external_customer_id'] ?? null, 160),
            ':external_sub' => self::nullableString($data['externalSubscriptionId'] ?? $data['external_subscription_id'] ?? null, 160),
            ':paid' => self::dateOrNull($data['lastPaymentAt'] ?? $data['last_payment_at'] ?? ($status === 'active' ? gmdate(DATE_ATOM) : null)),
        ]);
        $row = self::subscriptionForUser($userId);
        self::recordEvent($userId, $eventType, [
            'actorUserId' => $actorUserId,
            'plan' => $plan,
            'billingPeriod' => $period,
            'status' => $status,
            'currentPeriodEnd' => $endsAt,
        ], trim((string) ($data['externalEventId'] ?? '')) ?: null);
        return $row ?? [];
    }

    public static function startTrial(array $user): array
    {
        $userId = trim((string) ($user['id'] ?? ''));
        if ($userId === '') throw new InvalidArgumentException('Login SIAS wajib sebelum memulai trial.');
        if (KraEntitlements::isPlatformAdmin($user)) throw new DomainException('Admin SIAS sudah memiliki akses penuh tanpa trial/langganan.');
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia; trial belum dimulai.');
        $stmt = $db->prepare('SELECT COUNT(*) FROM kra_billing_events WHERE user_id = :user AND event_type = "trial_started"');
        $stmt->execute([':user' => $userId]);
        if ((int) $stmt->fetchColumn() > 0 || self::subscriptionForUser($userId) !== null) {
            throw new DomainException('Trial PRO satu kali untuk akun ini sudah pernah digunakan atau akun sudah memiliki catatan langganan.');
        }
        $end = gmdate('Y-m-d H:i:s', time() + 7 * 86400);
        $row = self::upsertSubscription([
            'userId' => $userId,
            'plan' => 'pro',
            'billingPeriod' => 'monthly',
            'status' => 'trialing',
            'startsAt' => gmdate(DATE_ATOM),
            'currentPeriodEnd' => $end,
            'trialEndsAt' => $end,
            'paymentProvider' => 'trial',
        ], $userId, 'trial_started');
        return $row;
    }

    public static function cancel(string $userId, bool $immediate, string $actorUserId): array
    {
        $row = self::subscriptionForUser($userId);
        if ($row === null) throw new DomainException('Tidak ada langganan aktif untuk dibatalkan.');
        $end = $immediate ? gmdate('Y-m-d H:i:s') : (string) ($row['current_period_end'] ?? gmdate('Y-m-d H:i:s'));
        return self::upsertSubscription([
            'userId' => $userId,
            'plan' => (string) ($row['plan'] ?? 'pro'),
            'billingPeriod' => (string) ($row['billing_period'] ?? 'monthly'),
            'status' => 'canceled',
            'startsAt' => (string) ($row['starts_at'] ?? gmdate(DATE_ATOM)),
            'currentPeriodEnd' => $end,
            'trialEndsAt' => $row['trial_ends_at'] ?? null,
            'cancelAtPeriodEnd' => !$immediate,
            'paymentProvider' => (string) ($row['payment_provider'] ?? 'manual'),
            'externalCustomerId' => $row['external_customer_id'] ?? null,
            'externalSubscriptionId' => $row['external_subscription_id'] ?? null,
            'lastPaymentAt' => $row['last_payment_at'] ?? null,
        ], $actorUserId, $immediate ? 'subscription.canceled_immediately' : 'subscription.cancel_at_period_end');
    }

    public static function createCheckoutRequest(array $user, string $planId, string $period): array
    {
        $userId = trim((string) ($user['id'] ?? ''));
        if ($userId === '') throw new InvalidArgumentException('Login SIAS wajib sebelum meminta aktivasi.');
        $plan = KraEntitlements::plan($planId);
        if (($plan['id'] ?? '') === 'free') throw new InvalidArgumentException('Pilih PRO, PLUS, atau PLATINUM.');
        $period = strtolower(trim($period)) === 'yearly' ? 'yearly' : 'monthly';
        $amount = (int) (($plan['pricesIdr'][$period] ?? 0));
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia; permintaan aktivasi belum dibuat.');
        $id = 'ord_' . bin2hex(random_bytes(12));
        $code = 'KRA-' . strtoupper(bin2hex(random_bytes(4)));
        $paymentUrl = trim((string) (getenv('KRA_BILLING_PAYMENT_URL') ?: ''));
        $contact = trim((string) (getenv('KRA_BILLING_CONTACT') ?: 'admin KRA'));
        $instructions = $paymentUrl !== ''
            ? 'Selesaikan pembayaran melalui tautan resmi, lalu kirim kode ' . $code . ' kepada ' . $contact . ' untuk verifikasi.'
            : 'Hubungi ' . $contact . ' dengan kode ' . $code . ' untuk instruksi pembayaran manual dan aktivasi. Jangan mengirim password SIAS atau API key.';
        $stmt = $db->prepare('INSERT INTO kra_billing_orders
            (id, public_code, user_id, plan, billing_period, amount_idr, status, payment_provider, payment_url, instructions, expires_at)
            VALUES (:id, :code, :user, :plan, :period, :amount, "pending", "manual", :url, :instructions, :expires)');
        $stmt->execute([
            ':id' => $id,
            ':code' => $code,
            ':user' => $userId,
            ':plan' => $plan['id'],
            ':period' => $period,
            ':amount' => $amount,
            ':url' => $paymentUrl !== '' ? $paymentUrl : null,
            ':instructions' => $instructions,
            ':expires' => gmdate('Y-m-d H:i:s', time() + 3 * 86400),
        ]);
        self::recordEvent($userId, 'checkout_requested', ['orderId' => $id, 'code' => $code, 'plan' => $plan['id'], 'period' => $period, 'amountIdr' => $amount]);
        return [
            'id' => $id,
            'code' => $code,
            'plan' => $plan['id'],
            'planName' => $plan['name'],
            'billingPeriod' => $period,
            'amountIdr' => $amount,
            'currency' => 'IDR',
            'status' => 'pending',
            'paymentUrl' => $paymentUrl,
            'instructions' => $instructions,
            'expiresAt' => gmdate(DATE_ATOM, time() + 3 * 86400),
        ];
    }

    public static function markOrderPaid(string $orderCodeOrId, string $actorUserId, string $provider = 'manual', ?string $externalId = null): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) throw new RuntimeException('Database KRA tidak tersedia.');
        $stmt = $db->prepare('SELECT * FROM kra_billing_orders WHERE id = :id OR public_code = :code LIMIT 1');
        $stmt->execute([':id' => $orderCodeOrId, ':code' => strtoupper(trim($orderCodeOrId))]);
        $order = $stmt->fetch();
        if (!is_array($order)) throw new DomainException('Order pembayaran tidak ditemukan.');
        if ((string) ($order['status'] ?? '') === 'paid') return ['order' => self::publicOrder($order), 'subscription' => KraEntitlements::publicSubscription(self::subscriptionForUser((string) $order['user_id']))];
        $period = (string) ($order['billing_period'] ?? 'monthly');
        $end = gmdate('Y-m-d H:i:s', strtotime($period === 'yearly' ? '+1 year' : '+1 month'));
        $subscription = self::upsertSubscription([
            'userId' => (string) $order['user_id'],
            'plan' => (string) $order['plan'],
            'billingPeriod' => $period,
            'status' => 'active',
            'startsAt' => gmdate(DATE_ATOM),
            'currentPeriodEnd' => $end,
            'paymentProvider' => $provider,
            'externalSubscriptionId' => $externalId,
            'lastPaymentAt' => gmdate(DATE_ATOM),
        ], $actorUserId, 'payment_confirmed');
        $db->prepare('UPDATE kra_billing_orders SET status="paid", payment_provider=:provider, external_id=:external, paid_at=NOW() WHERE id=:id')
            ->execute([':provider' => $provider, ':external' => $externalId, ':id' => (string) $order['id']]);
        $stmt = $db->prepare('SELECT * FROM kra_billing_orders WHERE id = :id');
        $stmt->execute([':id' => (string) $order['id']]);
        $fresh = $stmt->fetch();
        return ['order' => self::publicOrder(is_array($fresh) ? $fresh : $order), 'subscription' => KraEntitlements::publicSubscription($subscription)];
    }

    public static function adminList(int $limit = 200): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [];
        $limit = max(1, min(500, $limit));
        $stmt = $db->query('SELECT u.id AS user_id, u.username, u.display_name, u.role,
            s.plan, s.billing_period, s.status, s.starts_at, s.current_period_end, s.trial_ends_at,
            s.cancel_at_period_end, s.payment_provider, s.last_payment_at
            FROM kra_users u LEFT JOIN kra_subscriptions s ON s.user_id = u.id
            ORDER BY u.display_name LIMIT ' . $limit);
        return $stmt ? $stmt->fetchAll() : [];
    }

    /** Platform-admin order queue; newest first, optionally one status only. */
    public static function adminOrders(int $limit = 100, ?string $status = 'pending'): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [];
        $limit = max(1, min(500, $limit));
        $statusSql = '';
        $params = [];
        if ($status !== null && $status !== '') {
            $statusSql = 'WHERE o.status = :status';
            $params[':status'] = substr(trim($status), 0, 40);
        }
        $stmt = $db->prepare('SELECT o.*, u.username, u.display_name
            FROM kra_billing_orders o LEFT JOIN kra_users u ON u.id = o.user_id
            ' . $statusSql . ' ORDER BY o.created_at DESC LIMIT ' . $limit);
        $stmt->execute($params);
        return array_map(static function (array $row): array {
            $order = self::publicOrder($row);
            $order['username'] = (string) ($row['username'] ?? '');
            $order['displayName'] = (string) ($row['display_name'] ?? '');
            return $order;
        }, $stmt->fetchAll());
    }

    public static function ordersForUser(string $userId, int $limit = 20): array
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return [];
        $stmt = $db->prepare('SELECT * FROM kra_billing_orders WHERE user_id = :user ORDER BY created_at DESC LIMIT ' . max(1, min(100, $limit)));
        $stmt->execute([':user' => $userId]);
        return array_map([self::class, 'publicOrder'], $stmt->fetchAll());
    }

    public static function recordEvent(string $userId, string $type, array $payload = [], ?string $externalEventId = null): bool
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO) return false;
        try {
            $stmt = $db->prepare('INSERT INTO kra_billing_events (external_event_id, user_id, event_type, payload)
                VALUES (:external, :user, :type, :payload)');
            $stmt->execute([
                ':external' => $externalEventId !== null && $externalEventId !== '' ? substr($externalEventId, 0, 180) : null,
                ':user' => $userId !== '' ? $userId : null,
                ':type' => substr($type, 0, 120),
                ':payload' => json_encode(self::redactPayload($payload), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ]);
            return true;
        } catch (Throwable) {
            return false; // duplicate external_event_id = idempotent replay
        }
    }

    private static function billingEventExists(string $externalEventId): bool
    {
        $db = KraDb::connect();
        if (!$db instanceof PDO || $externalEventId === '') return false;
        try {
            $stmt = $db->prepare('SELECT 1 FROM kra_billing_events WHERE external_event_id = :external LIMIT 1');
            $stmt->execute([':external' => substr($externalEventId, 0, 180)]);
            return $stmt->fetchColumn() !== false;
        } catch (Throwable) {
            return false;
        }
    }

    public static function verifyWebhookSignature(string $rawBody, ?string $signature, ?string $secret = null): bool
    {
        $secret = $secret ?? trim((string) (getenv('KRA_BILLING_WEBHOOK_SECRET') ?: ''));
        if ($secret === '' || $signature === null || trim($signature) === '') return false;
        $signature = trim($signature);
        if (str_starts_with(strtolower($signature), 'sha256=')) $signature = substr($signature, 7);
        $expected = hash_hmac('sha256', $rawBody, $secret);
        return hash_equals(strtolower($expected), strtolower($signature));
    }

    /** Generic signed adapter contract for a payment gateway/manual verifier. */
    public static function handleSignedWebhook(string $rawBody, ?string $signature): array
    {
        if (!self::verifyWebhookSignature($rawBody, $signature)) {
            throw new DomainException('Billing webhook signature tidak cocok atau secret belum dikonfigurasi.');
        }
        $payload = json_decode($rawBody, true);
        if (!is_array($payload)) throw new InvalidArgumentException('Billing webhook harus JSON.');
        $externalEventId = trim((string) ($payload['event_id'] ?? $payload['id'] ?? ''));
        if ($externalEventId === '') throw new InvalidArgumentException('Billing webhook wajib memiliki event_id unik untuk idempotensi.');
        $orderCode = trim((string) ($payload['order_code'] ?? $payload['order_id'] ?? $payload['public_code'] ?? ''));
        $status = strtolower(trim((string) ($payload['status'] ?? $payload['event'] ?? '')));
        $userId = trim((string) ($payload['user_id'] ?? $payload['userId'] ?? ''));
        $provider = substr(trim((string) ($payload['provider'] ?? 'webhook')), 0, 64) ?: 'webhook';

        if (self::billingEventExists($externalEventId)) {
            return ['ok' => true, 'duplicate' => true, 'message' => 'Event webhook sudah pernah diproses.'];
        }
        // Mark the external event only after the state change succeeds. If
        // applying it fails, the gateway can safely retry the same event_id.
        if ($orderCode !== '' && in_array($status, ['paid', 'payment.paid', 'settled', 'success'], true)) {
            $result = self::markOrderPaid($orderCode, 'billing-webhook', $provider, trim((string) ($payload['external_id'] ?? $externalEventId)));
            self::recordEvent($userId, 'webhook.' . $status, $payload, $externalEventId);
            return ['ok' => true, 'duplicate' => false] + $result;
        }
        if ($userId !== '' && isset($payload['plan'])) {
            $subscription = self::upsertSubscription([
                'userId' => $userId,
                'plan' => (string) $payload['plan'],
                'billingPeriod' => (string) ($payload['billing_period'] ?? 'monthly'),
                'status' => in_array($status, ['active', 'trialing', 'past_due', 'pending', 'canceled', 'cancelled', 'expired'], true) ? $status : 'active',
                'startsAt' => $payload['starts_at'] ?? gmdate(DATE_ATOM),
                'currentPeriodEnd' => $payload['current_period_end'] ?? $payload['expires_at'] ?? null,
                'trialEndsAt' => $payload['trial_ends_at'] ?? null,
                'cancelAtPeriodEnd' => (bool) ($payload['cancel_at_period_end'] ?? false),
                'paymentProvider' => $provider,
                'externalCustomerId' => $payload['external_customer_id'] ?? null,
                'externalSubscriptionId' => $payload['external_subscription_id'] ?? null,
                'lastPaymentAt' => $payload['paid_at'] ?? ($status === 'active' ? gmdate(DATE_ATOM) : null),
                'externalEventId' => $externalEventId . ':applied',
            ], 'billing-webhook', 'subscription.webhook_applied');
            self::recordEvent($userId, 'webhook.' . ($status ?: 'received'), $payload, $externalEventId);
            return ['ok' => true, 'duplicate' => false, 'subscription' => KraEntitlements::publicSubscription($subscription)];
        }
        self::recordEvent($userId, 'webhook.' . ($status ?: 'received'), $payload, $externalEventId);
        return ['ok' => true, 'duplicate' => false, 'message' => 'Webhook tercatat; tidak ada order/langganan yang diubah.'];
    }

    public static function publicOrder(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'code' => (string) ($row['public_code'] ?? ''),
            'userId' => (string) ($row['user_id'] ?? ''),
            'plan' => (string) ($row['plan'] ?? ''),
            'billingPeriod' => (string) ($row['billing_period'] ?? 'monthly'),
            'amountIdr' => (int) ($row['amount_idr'] ?? 0),
            'currency' => 'IDR',
            'status' => (string) ($row['status'] ?? ''),
            'paymentProvider' => (string) ($row['payment_provider'] ?? 'manual'),
            'paymentUrl' => (string) ($row['payment_url'] ?? ''),
            'instructions' => (string) ($row['instructions'] ?? ''),
            'createdAt' => $row['created_at'] ?? null,
            'expiresAt' => $row['expires_at'] ?? null,
            'paidAt' => $row['paid_at'] ?? null,
        ];
    }

    private static function dateOrNull(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;
        $ts = is_int($value) ? $value : strtotime((string) $value);
        return $ts === false ? null : gmdate('Y-m-d H:i:s', $ts);
    }

    private static function nullableString(mixed $value, int $max): ?string
    {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : substr($value, 0, $max);
    }

    private static function redactPayload(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if (is_array($value)) $payload[$key] = self::redactPayload($value);
            elseif (preg_match('/password|secret|token|api.?key|card|cvv/i', (string) $key)) $payload[$key] = '[redacted]';
        }
        return $payload;
    }
}
