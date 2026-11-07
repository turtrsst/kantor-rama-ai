<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

/**
 * Server-computed plan catalog and feature entitlements.
 *
 * Access rule approved for KRA: an exact SIAS platform admin bypasses billing;
 * every other user needs an active PRO/PLUS/PLATINUM subscription (or a valid
 * signed offline license) owned by the active workspace owner. The browser
 * only displays the result — APIs re-check everything here.
 */
final class KraEntitlements
{
    public const GRACE_DAYS = 3;
    public const LICENSE_GRACE_DAYS = 7;

    private const RANKS = ['free' => 0, 'pro' => 1, 'plus' => 2, 'platinum' => 3];

    private const CORE_CREATOR_SKILLS = [
        'creator-hook-smith',
        'creator-retention-script',
        'creator-seo-metadata',
        'creator-fact-check',
        'creator-policy-guard',
        'creator-prepublish-qa',
    ];

    private const PLANS = [
        'free' => [
            'id' => 'free',
            'name' => 'KRA OFFICE',
            'tagline' => 'Virtual Office dasar',
            'pricesIdr' => ['monthly' => 0, 'yearly' => 0],
            'features' => ['office_core', 'vault_manual', 'vault_basic_recall'],
            'limits' => ['workspaces' => 1, 'projects' => 3, 'seats' => 1, 'customAgents' => 3, 'apiKeys' => 0, 'youtubeUploadsMonthly' => 0, 'n100nRunsMonthly' => 0, 'memoryCompilesMonthly' => 10],
        ],
        'pro' => [
            'id' => 'pro',
            'name' => 'KRA PRO',
            'tagline' => 'Creator Essential untuk kreator solo',
            'pricesIdr' => ['monthly' => 9000, 'yearly' => 100000],
            'features' => [
                'office_core', 'kra_api_access', 'creator_studio', 'creator_specialists', 'creator_parallel',
                'creator_core_skills', 'youtube_connect', 'youtube_upload',
                'youtube_analytics_basic', 'telegram_notifications',
                'vault_manual', 'vault_basic_recall',
            ],
            'limits' => ['workspaces' => 1, 'projects' => 3, 'seats' => 1, 'customAgents' => 3, 'apiKeys' => 3, 'youtubeUploadsMonthly' => 30, 'n100nRunsMonthly' => 0, 'memoryCompilesMonthly' => 30],
        ],
        'plus' => [
            'id' => 'plus',
            'name' => 'KRA PLUS',
            'tagline' => 'Creator Production dengan automasi & memori pintar',
            'pricesIdr' => ['monthly' => 15000, 'yearly' => 150000],
            'features' => [
                'office_core', 'kra_api_access', 'creator_studio', 'creator_specialists', 'creator_parallel',
                'creator_discussion', 'creator_core_skills', 'creator_all_skills',
                'creator_custom_agents', 'youtube_connect', 'youtube_upload',
                'youtube_analytics_basic', 'youtube_analytics_advanced',
                'n100n_workflows', 'superbots_pipeline', 'concat_bridge', 'telegram_notifications',
                'telegram_approvals', 'vault_manual', 'vault_basic_recall',
                'vault_semantic_memory', 'vault_auto_compile', 'workflows_advanced',
            ],
            'limits' => ['workspaces' => 3, 'projects' => 15, 'seats' => 3, 'customAgents' => 20, 'apiKeys' => 10, 'youtubeUploadsMonthly' => 120, 'n100nRunsMonthly' => 500, 'memoryCompilesMonthly' => 200],
        ],
        'platinum' => [
            'id' => 'platinum',
            'name' => 'KRA PLATINUM',
            'tagline' => 'Full service untuk tim & bisnis konten',
            'pricesIdr' => ['monthly' => 50000, 'yearly' => 500000],
            'features' => [
                'office_core', 'kra_api_access', 'creator_studio', 'creator_specialists', 'creator_parallel',
                'creator_discussion', 'creator_core_skills', 'creator_all_skills',
                'creator_custom_agents', 'youtube_connect', 'youtube_upload',
                'youtube_analytics_basic', 'youtube_analytics_advanced',
                'n100n_workflows', 'superbots_pipeline', 'concat_bridge', 'telegram_notifications',
                'telegram_approvals', 'vault_manual', 'vault_basic_recall',
                'vault_semantic_memory', 'vault_auto_compile', 'workflows_advanced',
                'priority_support', 'full_service_onboarding', 'full_service_health_check',
                'multi_channel_ready',
            ],
            'limits' => ['workspaces' => 10, 'projects' => 50, 'seats' => 5, 'customAgents' => 100, 'apiKeys' => 25, 'youtubeUploadsMonthly' => 500, 'n100nRunsMonthly' => 2500, 'memoryCompilesMonthly' => 1000],
        ],
    ];

    public static function catalog(): array
    {
        $out = [];
        foreach (self::PLANS as $plan) {
            $out[] = $plan + [
                'currency' => 'IDR',
                'trialDays' => $plan['id'] === 'pro' ? 7 : 0,
                'graceDays' => self::GRACE_DAYS,
                'byok' => true,
                'note' => 'Lisensi fitur KRA dengan provider AI milik pengguna (BYOK/Ollama); bukan kuota token AI dari server pusat.',
            ];
        }
        return $out;
    }

    public static function plan(string $planId): array
    {
        return self::PLANS[self::normalizePlan($planId)] ?? self::PLANS['free'];
    }

    public static function normalizePlan(string $planId): string
    {
        $planId = strtolower(trim($planId));
        return isset(self::PLANS[$planId]) ? $planId : 'free';
    }

    public static function rank(string $planId): int
    {
        return self::RANKS[self::normalizePlan($planId)] ?? 0;
    }

    public static function coreCreatorSkills(): array
    {
        return self::CORE_CREATOR_SKILLS;
    }

    public static function isPlatformAdmin(?array $user): bool
    {
        return KraTenantContext::isPlatformAdmin($user);
    }

    /**
     * Pure subscription evaluation (database row or equivalent array), kept
     * separate so the runtime harness can verify trial/expiry/grace without
     * MySQL. Returns an entitlement array or null when inactive.
     */
    public static function evaluateSubscription(?array $row, ?int $now = null): ?array
    {
        if (!is_array($row)) return null;
        $now = $now ?? time();
        $status = strtolower(trim((string) ($row['status'] ?? '')));
        if (!in_array($status, ['active', 'trialing', 'past_due', 'canceled', 'cancelled'], true)) return null;

        $periodEnd = self::timestamp($row['current_period_end'] ?? $row['currentPeriodEnd'] ?? $row['expires_at'] ?? $row['expiresAt'] ?? null);
        $trialEnd = self::timestamp($row['trial_ends_at'] ?? $row['trialEndsAt'] ?? null);
        $effectiveEnd = $status === 'trialing' ? ($trialEnd ?: $periodEnd) : $periodEnd;
        if ($effectiveEnd === null) return null;

        $cancelAtPeriodEnd = !empty($row['cancel_at_period_end'] ?? $row['cancelAtPeriodEnd'] ?? false);
        if (($status === 'canceled' || $status === 'cancelled') && !$cancelAtPeriodEnd) return null;

        $inGrace = false;
        if ($now > $effectiveEnd) {
            if ($status === 'canceled' || $status === 'cancelled') return null;
            if ($now > $effectiveEnd + self::GRACE_DAYS * 86400) return null;
            $inGrace = true;
        }

        $planId = self::normalizePlan((string) ($row['plan'] ?? $row['plan_id'] ?? 'free'));
        if ($planId === 'free') return null;
        return self::build($planId, 'subscription', $inGrace ? 'grace' : $status, [
            'subscription' => self::publicSubscription($row),
            'expiresAt' => gmdate(DATE_ATOM, $effectiveEnd),
            'daysRemaining' => max(0, (int) ceil(($effectiveEnd - $now) / 86400)),
            'graceDaysRemaining' => $inGrace ? max(0, (int) ceil(($effectiveEnd + self::GRACE_DAYS * 86400 - $now) / 86400)) : self::GRACE_DAYS,
        ]);
    }

    /** Pure signed-license payload evaluation after cryptographic verification. */
    public static function evaluateLicensePayload(?array $payload, ?array $user = null, ?array $workspace = null, ?int $now = null): ?array
    {
        if (!is_array($payload)) return null;
        $now = $now ?? time();
        $expires = self::timestamp($payload['expires_at'] ?? $payload['expiresAt'] ?? null);
        if ($expires === null || $now > $expires + self::LICENSE_GRACE_DAYS * 86400) return null;
        $notBefore = self::timestamp($payload['not_before'] ?? $payload['starts_at'] ?? $payload['issued_at'] ?? null);
        if ($notBefore !== null && $now < $notBefore - 300) return null;
        if (!self::licenseBindingMatches($payload, $user, $workspace)) return null;

        $planId = self::normalizePlan((string) ($payload['plan'] ?? 'free'));
        if ($planId === 'free') return null;
        $inGrace = $now > $expires;
        $features = null;
        if (isset($payload['features']) && is_array($payload['features'])) {
            $features = array_values(array_filter(array_map('strval', $payload['features'])));
        }
        $limits = null;
        if (isset($payload['limits']) && is_array($payload['limits'])) $limits = $payload['limits'];
        elseif (isset($payload['seats'])) $limits = ['seats' => max(1, (int) $payload['seats'])];
        return self::build($planId, 'offline_license', $inGrace ? 'grace' : 'active', [
            'licenseId' => substr((string) ($payload['license_id'] ?? ''), 0, 80),
            'expiresAt' => gmdate(DATE_ATOM, $expires),
            'daysRemaining' => max(0, (int) ceil(($expires - $now) / 86400)),
            'graceDaysRemaining' => $inGrace ? max(0, (int) ceil(($expires + self::LICENSE_GRACE_DAYS * 86400 - $now) / 86400)) : self::LICENSE_GRACE_DAYS,
        ], $features, $limits);
    }

    public static function licenseBindingMatches(array $payload, ?array $user, ?array $workspace): bool
    {
        $boundUser = trim((string) ($payload['licensee_user_id'] ?? $payload['user_id'] ?? ''));
        $boundUsername = strtolower(trim((string) ($payload['licensee_username'] ?? $payload['username'] ?? '')));
        $boundEmail = strtolower(trim((string) ($payload['licensee_email'] ?? $payload['email'] ?? '')));
        $boundWorkspace = trim((string) ($payload['workspace_id'] ?? ''));
        $hasBinding = $boundUser !== '' || $boundUsername !== '' || $boundEmail !== '' || $boundWorkspace !== '';
        if (!$hasBinding) return true; // installation license
        if ($boundWorkspace !== '' && $workspace !== null && hash_equals($boundWorkspace, (string) ($workspace['id'] ?? ''))) return true;
        if (!is_array($user)) return false;
        if ($boundUser !== '' && hash_equals($boundUser, (string) ($user['id'] ?? ''))) return true;
        if ($boundUsername !== '' && hash_equals($boundUsername, strtolower((string) ($user['username'] ?? '')))) return true;
        if ($boundEmail !== '' && hash_equals($boundEmail, strtolower((string) ($user['email'] ?? '')))) return true;
        return false;
    }

    /** Billing identity for a workspace: its owner, never an invited member. */
    public static function billingOwnerId(?array $user = null, ?array $workspace = null): string
    {
        $workspace = $workspace ?? KraTenantContext::workspace();
        $ownerId = trim((string) ($workspace['ownerUserId'] ?? $workspace['owner_user_id'] ?? ''));
        if ($ownerId !== '') return $ownerId;
        $user = $user ?? KraTenantContext::user();
        return trim((string) ($user['id'] ?? ''));
    }

    /** Resolve the best entitlement for a user in a workspace. */
    public static function resolve(?array $user, ?array $workspace = null): array
    {
        $workspace = $workspace ?? KraTenantContext::workspace();
        $user = $user ?? KraTenantContext::user();

        // The billing identity is the workspace owner; invited members use the
        // owner's plan inside that workspace. Platform admins always bypass.
        $owner = null;
        $ownerId = trim((string) ($workspace['ownerUserId'] ?? $workspace['owner_user_id'] ?? ''));
        if ($ownerId !== '' && class_exists('KraAuth')) $owner = KraAuth::findUserById($ownerId);
        if ($owner === null && is_array($user) && ($ownerId === '' || $ownerId === (string) ($user['id'] ?? ''))) $owner = $user;

        if (self::isPlatformAdmin($user) || self::isPlatformAdmin($owner)) {
            return self::build('platinum', 'sias_admin', 'active', [
                'billingOwnerId' => $ownerId ?: (string) ($user['id'] ?? ''),
                'unlimited' => true,
                'expiresAt' => null,
                'daysRemaining' => null,
            ], null, ['workspaces' => null, 'projects' => null, 'seats' => null, 'customAgents' => null, 'apiKeys' => null, 'youtubeUploadsMonthly' => null, 'n100nRunsMonthly' => null, 'memoryCompilesMonthly' => null]);
        }

        $candidates = [];
        $billingOwnerId = $ownerId !== '' ? $ownerId : (string) ($user['id'] ?? '');
        if ($billingOwnerId !== '' && class_exists('KraBilling')) {
            try {
                $subscription = KraBilling::subscriptionForUser($billingOwnerId);
                $evaluated = self::evaluateSubscription($subscription);
                if ($evaluated !== null) $candidates[] = $evaluated;
            } catch (Throwable $e) {
                error_log('[KraEntitlements] subscription lookup failed: ' . $e->getMessage());
            }
        }
        if (class_exists('KraLicense')) {
            try {
                $license = KraLicense::currentPayload();
                $evaluated = self::evaluateLicensePayload($license, $owner ?? $user, $workspace);
                if ($evaluated !== null) $candidates[] = $evaluated;
            } catch (Throwable $e) {
                error_log('[KraEntitlements] license lookup failed: ' . $e->getMessage());
            }
        }
        if ($candidates !== []) {
            usort($candidates, static fn(array $a, array $b): int => ((int) ($b['rank'] ?? 0)) <=> ((int) ($a['rank'] ?? 0)));
            $best = $candidates[0];
            $best['billingOwnerId'] = $billingOwnerId;
            $best['sourcesConsidered'] = array_values(array_map(static fn(array $c): string => (string) ($c['source'] ?? ''), $candidates));
            return $best;
        }

        return self::build('free', 'none', 'inactive', [
            'billingOwnerId' => $billingOwnerId,
            'expiresAt' => null,
            'daysRemaining' => null,
        ]);
    }

    public static function forCurrentContext(bool $refresh = false): array
    {
        $cached = KraTenantContext::entitlement();
        if (!$refresh && is_array($cached)) return $cached;
        $resolved = self::resolve(KraTenantContext::user(), KraTenantContext::workspace());
        KraTenantContext::setEntitlement($resolved);
        return $resolved;
    }

    public static function hasFeature(string $feature, ?array $entitlement = null): bool
    {
        // Internal CLI/system calls without an authenticated user keep legacy
        // behavior. HTTP handlers set a user + workspace before any gate.
        if (KraTenantContext::user() === null && $entitlement === null) return true;
        $entitlement = $entitlement ?? self::forCurrentContext();
        return in_array($feature, (array) ($entitlement['features'] ?? []), true);
    }

    public static function assertFeature(string $feature, string $label = 'Fitur ini'): void
    {
        if (self::hasFeature($feature)) return;
        $entitlement = self::forCurrentContext();
        $planName = (string) ($entitlement['planName'] ?? 'KRA OFFICE');
        throw new DomainException($label . ' memerlukan langganan KRA Creator aktif. Paket workspace saat ini: ' . $planName . '. Admin SIAS bebas akses; pengguna lain dapat mengaktifkan PRO/PLUS/PLATINUM.');
    }

    public static function limit(string $key, ?array $entitlement = null): ?int
    {
        $entitlement = $entitlement ?? self::forCurrentContext();
        $limits = (array) ($entitlement['limits'] ?? []);
        if (!array_key_exists($key, $limits) || $limits[$key] === null) return null;
        return max(0, (int) $limits[$key]);
    }

    public static function assertUnderLimit(string $key, int $currentCount, string $label): void
    {
        $limit = self::limit($key);
        if ($limit !== null && $currentCount >= $limit) {
            $plan = self::forCurrentContext();
            throw new DomainException('Batas ' . $label . ' untuk ' . ($plan['planName'] ?? 'paket ini') . ' sudah tercapai (' . $limit . '). Upgrade paket atau arsipkan yang lama.');
        }
    }

    /** Filter Creator skill IDs according to the active plan. Non-Creator skills pass through. */
    public static function filterSkills(array $skillIds, ?array $entitlement = null): array
    {
        if (KraTenantContext::user() === null && $entitlement === null) return array_values($skillIds);
        $entitlement = $entitlement ?? self::forCurrentContext();
        $features = (array) ($entitlement['features'] ?? []);
        if (in_array('creator_all_skills', $features, true)) return array_values($skillIds);
        $coreOnly = in_array('creator_core_skills', $features, true);
        return array_values(array_filter($skillIds, static function ($id) use ($coreOnly): bool {
            $id = (string) $id;
            if (!str_starts_with($id, 'creator-')) return true;
            return $coreOnly && in_array($id, self::CORE_CREATOR_SKILLS, true);
        }));
    }

    public static function publicSubscription(?array $row): ?array
    {
        if (!is_array($row)) return null;
        return [
            'userId' => (string) ($row['user_id'] ?? $row['userId'] ?? ''),
            'plan' => self::normalizePlan((string) ($row['plan'] ?? 'free')),
            'billingPeriod' => (string) ($row['billing_period'] ?? $row['billingPeriod'] ?? 'monthly'),
            'status' => (string) ($row['status'] ?? ''),
            'startsAt' => $row['starts_at'] ?? $row['startsAt'] ?? null,
            'currentPeriodEnd' => $row['current_period_end'] ?? $row['currentPeriodEnd'] ?? null,
            'trialEndsAt' => $row['trial_ends_at'] ?? $row['trialEndsAt'] ?? null,
            'cancelAtPeriodEnd' => !empty($row['cancel_at_period_end'] ?? $row['cancelAtPeriodEnd'] ?? false),
            'paymentProvider' => (string) ($row['payment_provider'] ?? $row['paymentProvider'] ?? 'manual'),
            'lastPaymentAt' => $row['last_payment_at'] ?? $row['lastPaymentAt'] ?? null,
        ];
    }

    private static function build(string $planId, string $source, string $status, array $extra = [], ?array $features = null, ?array $limits = null): array
    {
        $plan = self::plan($planId);
        $mergedLimits = (array) $plan['limits'];
        if (is_array($limits)) $mergedLimits = array_merge($mergedLimits, $limits);
        return $extra + [
            'active' => $planId !== 'free' && in_array($status, ['active', 'trialing', 'past_due', 'grace', 'canceled', 'cancelled'], true),
            'plan' => $planId,
            'planName' => (string) $plan['name'],
            'tagline' => (string) $plan['tagline'],
            'rank' => self::rank($planId),
            'source' => $source,
            'status' => $status,
            'features' => $features ?? (array) $plan['features'],
            'limits' => $mergedLimits,
            'pricesIdr' => (array) $plan['pricesIdr'],
            'creatorSkillIds' => in_array('creator_all_skills', $features ?? (array) $plan['features'], true) ? ['*'] : self::CORE_CREATOR_SKILLS,
        ];
    }

    private static function timestamp(mixed $value): ?int
    {
        if ($value === null || $value === '') return null;
        if (is_int($value)) return $value;
        if (is_float($value)) return (int) $value;
        $value = trim((string) $value);
        if (preg_match('/^\d{10,}$/', $value)) return (int) $value;
        $ts = strtotime($value);
        return $ts === false ? null : $ts;
    }
}
