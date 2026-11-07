<?php
declare(strict_types=1);

require_once __DIR__ . '/KraDb.php';
require_once __DIR__ . '/KraTenantContext.php';

/**
 * KraTokenQuota — Manages the daily per-user chat token budget for KRA.
 * Resets every day at 07:00 WIB (Asia/Jakarta, UTC+7).
 */
final class KraTokenQuota
{
    public const DAILY_LIMIT = 150000;
    public const RESET_HOUR_WIB = 7;
    public const TIMEZONE = 'Asia/Jakarta';
    public const EVENT_TYPE = 'ai_token';

    /** Override with KRA_DAILY_TOKEN_BUDGET when a different daily cap is wanted. */
    public static function limit(): int
    {
        $env = (int) (getenv('KRA_DAILY_TOKEN_BUDGET') ?: 0);
        return $env > 0 ? $env : self::DAILY_LIMIT;
    }

    /**
     * @return array{0: DateTimeImmutable, 1: DateTimeImmutable} [periodStart, nextReset]
     */
    public static function currentPeriod(): array
    {
        $tz = new DateTimeZone(self::TIMEZONE);
        $now = new DateTimeImmutable('now', $tz);
        $resetToday = $now->setTime(self::RESET_HOUR_WIB, 0, 0);
        if ($now < $resetToday) {
            $start = $resetToday->modify('-1 day');
            $next = $resetToday;
        } else {
            $start = $resetToday;
            $next = $resetToday->modify('+1 day');
        }
        return [$start, $next];
    }

    public static function status(?string $workspaceId = null): array
    {
        [$start, $next] = self::currentPeriod();
        $now = new DateTimeImmutable('now', new DateTimeZone(self::TIMEZONE));
        $used = self::usedTokens($start, $workspaceId);
        $limit = self::limit();
        $percent = min(100.0, round(($used / $limit) * 100, 2));
        $remaining = max(0, $limit - $used);
        $exhausted = $used >= $limit;

        $diffSeconds = max(0, $next->getTimestamp() - $now->getTimestamp());
        $hours = (int) floor($diffSeconds / 3600);
        $minutes = (int) floor(($diffSeconds % 3600) / 60);
        $resetInStr = ($hours > 0 ? "{$hours} jam " : '') . "{$minutes} menit";

        return [
            'used' => $used,
            'input' => 0,
            'output' => $used,
            'limit' => $limit,
            'remaining' => $remaining,
            'percent' => $percent,
            'exhausted' => $exhausted,
            'periodStart' => $start->format('Y-m-d H:i:s T'),
            'resetAt' => $next->format('Y-m-d H:i:s T'),
            'resetAtShort' => '07:00 WIB',
            'resetIn' => $resetInStr,
            'resetInSeconds' => $diffSeconds,
        ];
    }

    public static function usedTokens(DateTimeImmutable $since, ?string $workspaceId = null): int
    {
        try {
            $db = KraDb::connect();
            if (!$db) return 0;
            $ws = $workspaceId ?? (KraTenantContext::hasWorkspace() ? KraTenantContext::workspaceId() : '');
            $userId = KraTenantContext::userId();
            if ($userId === '') return 0;
            $ts = $since->getTimestamp();
            $sql = "SELECT COALESCE(SUM(quantity),0) FROM kra_usage_events
                WHERE user_id = :user AND event_type = :type
                AND created_at >= FROM_UNIXTIME(:ts)";
            $params = [':user' => $userId, ':type' => self::EVENT_TYPE, ':ts' => $ts];
            if ($ws !== '') {
                $sql .= ' AND workspace_id = :ws';
                $params[':ws'] = $ws;
            }
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            return (int) ($stmt->fetchColumn() ?: 0);
        } catch (Throwable) {
            return 0;
        }
    }

    /** Rough fallback when a provider returns no usage block (~4 chars per token). */
    public static function estimateTokens(string ...$texts): int
    {
        $chars = 0;
        foreach ($texts as $text) $chars += strlen($text);
        return (int) max(1, ceil($chars / 4));
    }

    public static function record(int $tokens, array $metadata = []): void
    {
        if ($tokens <= 0) return;
        KraDb::recordUsage(self::EVENT_TYPE, $tokens, $metadata);
    }

    /**
     * Quota owner is the authenticated user; an anonymous caller falls back to
     * its workspace so public traffic is still capped instead of unmetered.
     */
    public static function ownerKey(): string
    {
        $userId = KraTenantContext::userId();
        if ($userId !== '') return 'u:' . $userId;
        $workspaceId = KraTenantContext::hasWorkspace() ? KraTenantContext::workspaceId() : '';
        return $workspaceId !== '' ? 'w:' . $workspaceId : '';
    }

    /**
     * Provider-reported usage is authoritative; `estimateTokens` is the
     * fallback when the provider response carries no usage block.
     */
    public static function recordFromCompletion(array $completion, string ...$estimatedFrom): void
    {
        $usage = is_array($completion['usage'] ?? null) ? $completion['usage'] : [];
        $total = (int) ($usage['total_tokens'] ?? $usage['totalTokens'] ?? 0);
        if ($total <= 0) {
            $total = (int) ($usage['prompt_tokens'] ?? $usage['promptTokens'] ?? 0)
                + (int) ($usage['completion_tokens'] ?? $usage['completionTokens'] ?? 0);
        }
        if ($total <= 0) $total = self::estimateTokens(...$estimatedFrom);
        self::record($total);
    }

    public static function statusForOwner(string $ownerKey): array
    {
        $status = self::status();
        if ($ownerKey !== '') $status['owner'] = $ownerKey;
        return $status;
    }

    public static function assertAvailable(?string $workspaceId = null): array
    {
        $status = self::status($workspaceId);
        if ($status['exhausted']) {
            $msg = sprintf(
                'Kuota token harian habis: %s dari %s token sudah terpakai. ' .
                'Chat aktif kembali saat reset pukul 07:00 WIB (dalam %s).',
                number_format((float) $status['used'], 0, ',', '.'),
                number_format((float) self::limit(), 0, ',', '.'),
                $status['resetIn']
            );
            throw new RuntimeException($msg);
        }
        return $status;
    }
}
