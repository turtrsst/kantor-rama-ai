<?php
/*
 * Dedicated multi-workspace/subscription runtime checks.
 *
 * Run through the PHP-WASM harness:
 *   cd tools/runtime-harness
 *   VITEST=1 node run.mjs test-commercial.php
 *
 * The integration portions intentionally require the no-MySQL fallback used
 * by PHP-WASM/fresh local installs. If a real PDO connection is available,
 * they are reported as SKIP instead of writing test rows to production data.
 */
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '1');
date_default_timezone_set('UTC');
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

$root = '__KRA_ROOT__';
if (str_starts_with($root, '__')) $root = dirname(__DIR__, 2);
$pass = 0;
$fail = 0;
$skip = 0;

function kraCommercialCheck(string $name, bool $condition, string $extra = ''): void
{
    global $pass, $fail;
    if ($condition) $pass++; else $fail++;
    echo ($condition ? 'PASS  ' : 'FAIL  ') . $name;
    if ($extra !== '') echo '  — ' . $extra;
    echo "\n";
}

function kraCommercialSkip(string $name, string $why): void
{
    global $skip;
    $skip++;
    echo 'SKIP  ' . $name . '  — ' . $why . "\n";
}

function kraCommercialRun(string $name, callable $test): void
{
    try {
        $result = $test();
        kraCommercialCheck($name, (bool) ($result[0] ?? false), (string) ($result[1] ?? ''));
    } catch (Throwable $e) {
        kraCommercialCheck($name, false, get_class($e) . ': ' . $e->getMessage());
    }
}

function kraCommercialRemoveTree(string $path, string $root): void
{
    $expectedParent = realpath($root . DIRECTORY_SEPARATOR . '.temp') ?: ($root . DIRECTORY_SEPARATOR . '.temp');
    $real = realpath($path);
    if ($real === false) return;
    if (!str_starts_with($real . DIRECTORY_SEPARATOR, rtrim($expectedParent, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
        throw new RuntimeException('Refusing to remove a test path outside .temp: ' . $real);
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($real, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $item) {
        if ($item->isDir() && !$item->isLink()) @rmdir($item->getPathname());
        else @unlink($item->getPathname());
    }
    @rmdir($real);
}

$testRoot = $root . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'tenant-commercial-test';
@mkdir($root . DIRECTORY_SEPARATOR . '.temp', 0777, true);
kraCommercialRemoveTree($testRoot, $root);
@mkdir($testRoot . DIRECTORY_SEPARATOR . 'settings', 0777, true);
@mkdir($testRoot . DIRECTORY_SEPARATOR . 'vault-a', 0777, true);
@mkdir($testRoot . DIRECTORY_SEPARATOR . 'vault-b', 0777, true);

putenv('KRA_SETTINGS_DIR=' . $testRoot . DIRECTORY_SEPARATOR . 'settings');
$privateConfigRoot = '/tmp/kra-test-config';
putenv('KRA_PRIVATE_CONFIG_DIR=' . $privateConfigRoot);
putenv('KRA_DEPLOYMENT_MODE=local');
putenv('KRA_LICENSE_KEY=');
putenv('KRA_LICENSE_FILE=');
putenv('KRA_LICENSE_PUBLIC_KEY=');
putenv('KRA_LICENSE_PUBLIC_KEY_FILE=');

require $root . '/api/lib/KraTenantContext.php';
require $root . '/api/lib/KraEntitlements.php';
require $root . '/api/lib/KraLicense.php';
require $root . '/api/lib/KraProjectPath.php';
require $root . '/api/lib/KraDb.php';
require $root . '/api/lib/KraVaultSettings.php';
require $root . '/api/lib/KraVaultSync.php';
require $root . '/api/lib/KraSemanticMemory.php';
require $root . '/api/lib/KraMemoryCompiler.php';
require_once $root . '/api/lib/KraIntegrationSettings.php';
require $root . '/api/lib/KraBilling.php';

echo 'PHP ' . PHP_VERSION . " | commercial tenant checks\n";

$now = strtotime('2026-01-15T12:00:00Z');
$future = static fn (int $days): string => gmdate(DATE_ATOM, $now + $days * 86400);
$sub = static fn (string $plan, int $days = 30, string $status = 'active'): array => [
    'user_id' => 'u-test', 'plan' => $plan, 'billing_period' => 'monthly', 'status' => $status,
    'starts_at' => gmdate(DATE_ATOM, $now - 86400), 'current_period_end' => $future($days),
    'trial_ends_at' => $future(7), 'cancel_at_period_end' => 0, 'payment_provider' => 'manual',
];

echo "\n== Catalog & plan differentiation ==\n";
kraCommercialRun('C1 catalog prices are exactly the approved IDR prices', static function (): array {
    $byId = [];
    foreach (KraEntitlements::catalog() as $plan) $byId[$plan['id']] = $plan;
    $ok = ($byId['pro']['pricesIdr'] ?? null) === ['monthly' => 9000, 'yearly' => 100000]
        && ($byId['plus']['pricesIdr'] ?? null) === ['monthly' => 15000, 'yearly' => 150000]
        && ($byId['platinum']['pricesIdr'] ?? null) === ['monthly' => 50000, 'yearly' => 500000]
        && ($byId['pro']['trialDays'] ?? null) === 7;
    return [$ok, json_encode(array_map(static fn ($p) => $p['pricesIdr'], $byId))];
});
kraCommercialRun('C2 PRO is Creator Essential, not production automation', static function () use ($sub, $now): array {
    $e = KraEntitlements::evaluateSubscription($sub('pro'), $now);
    $f = $e['features'] ?? [];
    $ok = in_array('creator_studio', $f, true) && in_array('creator_parallel', $f, true)
        && in_array('creator_core_skills', $f, true) && in_array('youtube_analytics_basic', $f, true)
        && !in_array('creator_discussion', $f, true) && !in_array('creator_all_skills', $f, true)
        && !in_array('creator_custom_agents', $f, true) && !in_array('n100n_workflows', $f, true)
        && !in_array('vault_semantic_memory', $f, true)
        && ($e['limits']['workspaces'] ?? null) === 1 && ($e['limits']['youtubeUploadsMonthly'] ?? null) === 30;
    return [$ok, implode(',', $f)];
});
kraCommercialRun('C3 PLUS unlocks production automation and semantic memory', static function () use ($sub, $now): array {
    $e = KraEntitlements::evaluateSubscription($sub('plus'), $now);
    $f = $e['features'] ?? [];
    $ok = in_array('creator_discussion', $f, true) && in_array('creator_all_skills', $f, true)
        && in_array('creator_custom_agents', $f, true) && in_array('n100n_workflows', $f, true)
        && in_array('telegram_approvals', $f, true) && in_array('vault_semantic_memory', $f, true)
        && in_array('vault_auto_compile', $f, true) && !in_array('priority_support', $f, true)
        && ($e['limits']['seats'] ?? null) === 3 && ($e['limits']['n100nRunsMonthly'] ?? null) === 500;
    return [$ok, implode(',', $f)];
});
kraCommercialRun('C4 PLATINUM is the full-service plan', static function () use ($sub, $now): array {
    $e = KraEntitlements::evaluateSubscription($sub('platinum'), $now);
    $f = $e['features'] ?? [];
    $ok = in_array('priority_support', $f, true) && in_array('full_service_onboarding', $f, true)
        && in_array('full_service_health_check', $f, true) && ($e['limits']['projects'] ?? null) === 50
        && ($e['limits']['memoryCompilesMonthly'] ?? null) === 1000;
    return [$ok, implode(',', $f)];
});
kraCommercialRun('C5 trial, grace, expiry, and cancel-at-end are distinct', static function () use ($sub, $now): array {
    $trial = KraEntitlements::evaluateSubscription($sub('pro', 0, 'trialing'), $now);
    $grace = KraEntitlements::evaluateSubscription($sub('pro', -2), $now);
    $expired = KraEntitlements::evaluateSubscription($sub('pro', -4), $now);
    $cancelNow = KraEntitlements::evaluateSubscription($sub('plus', 10, 'canceled'), $now);
    $row = $sub('plus', 10, 'canceled');
    $row['cancel_at_period_end'] = 1;
    $cancelLater = KraEntitlements::evaluateSubscription($row, $now);
    $ok = ($trial['status'] ?? '') === 'trialing' && ($grace['status'] ?? '') === 'grace'
        && $expired === null && $cancelNow === null && $cancelLater !== null;
    return [$ok, 'trial=' . ($trial['status'] ?? 'null') . ' grace=' . ($grace['status'] ?? 'null')];
});

echo "\n== SIAS admin rule & skill filtering ==\n";
kraCommercialRun('C6 only exact SIAS admin roles bypass billing', static function (): array {
    $ok = KraEntitlements::isPlatformAdmin(['role' => 'admin'])
        && KraEntitlements::isPlatformAdmin(['role' => 'Administrator'])
        && KraEntitlements::isPlatformAdmin(['role' => 'super-admin'])
        && !KraEntitlements::isPlatformAdmin(['role' => 'supervisor'])
        && !KraEntitlements::isPlatformAdmin(['role' => 'boss'])
        && !KraEntitlements::isPlatformAdmin(['role' => 'owner'])
        && !KraEntitlements::isPlatformAdmin(['role' => 'guru']);
    return [$ok, 'supervisor is operational, not a billing bypass'];
});
kraCommercialRun('C6b omitted platform-admin argument means current request user', static function (): array {
    KraTenantContext::clear();
    KraTenantContext::setUser(['id' => 'admin-1', 'role' => 'admin']);
    try {
        $ok = KraTenantContext::isPlatformAdmin() && !KraTenantContext::isPlatformAdmin(null);
        return [$ok, 'explicit null remains false'];
    } finally {
        KraTenantContext::clear();
    }
});
kraCommercialRun('C7 workspace billing identity is the owner, never an invited member', static function (): array {
    $member = ['id' => 'member-1', 'role' => 'guru'];
    $workspace = ['id' => 'ws-owner', 'ownerUserId' => 'owner-9'];
    return [KraEntitlements::billingOwnerId($member, $workspace) === 'owner-9', 'owner-9'];
});
kraCommercialRun('C8 PRO filters advanced Creator skills while PLUS keeps all', static function () use ($sub, $now): array {
    $skills = ['creator-hook-smith', 'creator-thumbnail-lab', 'general-writing'];
    $pro = KraEntitlements::evaluateSubscription($sub('pro'), $now);
    $plus = KraEntitlements::evaluateSubscription($sub('plus'), $now);
    $proFiltered = KraEntitlements::filterSkills($skills, $pro);
    $plusFiltered = KraEntitlements::filterSkills($skills, $plus);
    $ok = $proFiltered === ['creator-hook-smith', 'general-writing'] && $plusFiltered === $skills;
    return [$ok, 'PRO=' . implode(',', $proFiltered)];
});

echo "\n== Offline license ==\n";
$licensePair = null;
$licenseToken = '';
if (!function_exists('sodium_crypto_sign_keypair') || !function_exists('sodium_crypto_sign_detached')) {
    kraCommercialSkip('C9-C10 Ed25519 sign/verify', 'PHP-WASM build has no sodium extension; run tools/license-issue.php on the owner PHP to exercise real signatures');
    kraCommercialRun('C9b verified-payload binding still rejects another username', static function () use ($future, $now): array {
        $payload = [
            'license_id' => 'KRA-LIC-TEST', 'plan' => 'plus', 'licensee_username' => 'tenant-user',
            'issued_at' => gmdate(DATE_ATOM, $now), 'expires_at' => $future(90),
        ];
        $goodUser = KraEntitlements::evaluateLicensePayload($payload, ['username' => 'Tenant-User'], ['id' => 'ws-a'], $now);
        $wrongUser = KraEntitlements::evaluateLicensePayload($payload, ['username' => 'other'], ['id' => 'ws-a'], $now);
        return [($goodUser['plan'] ?? '') === 'plus' && $wrongUser === null, 'cryptography itself is skipped in this runtime'];
    });
} else {
    kraCommercialRun('C9 Ed25519 license verifies and binds to its username', static function () use (&$licensePair, &$licenseToken, $future, $now): array {
        $licensePair = KraLicense::generateKeypair();
        $payload = [
            'license_id' => 'KRA-LIC-TEST', 'plan' => 'plus', 'licensee_username' => 'tenant-user',
            'issued_at' => gmdate(DATE_ATOM, $now), 'expires_at' => $future(90),
        ];
        $licenseToken = KraLicense::sign($payload, $licensePair['secretKey']);
        $public = KraLicense::decodeKey($licensePair['publicKey']);
        $verified = KraLicense::verify($licenseToken, $public);
        $goodUser = KraEntitlements::evaluateLicensePayload($verified['payload'] ?? null, ['username' => 'Tenant-User'], ['id' => 'ws-a'], $now);
        $wrongUser = KraEntitlements::evaluateLicensePayload($verified['payload'] ?? null, ['username' => 'other'], ['id' => 'ws-a'], $now);
        $ok = !empty($verified['valid']) && ($goodUser['plan'] ?? '') === 'plus' && $wrongUser === null;
        return [$ok, (string) ($verified['status'] ?? '')];
    });
    kraCommercialRun('C10 tampered license signature is rejected', static function () use (&$licensePair, &$licenseToken): array {
        $parts = explode('.', $licenseToken);
        $parts[2][0] = $parts[2][0] === 'A' ? 'B' : 'A';
        $verified = KraLicense::verify(implode('.', $parts), KraLicense::decodeKey($licensePair['publicKey']));
        return [empty($verified['valid']) && ($verified['status'] ?? '') === 'bad_signature', (string) ($verified['error'] ?? '')];
    });
}
kraCommercialRun('C11 license grace is seven days, then closed', static function () use ($future, $now): array {
    $payload = ['plan' => 'pro', 'expires_at' => $future(-2)];
    $grace = KraEntitlements::evaluateLicensePayload($payload, ['username' => 'any'], null, $now);
    $payload['expires_at'] = $future(-8);
    $closed = KraEntitlements::evaluateLicensePayload($payload, ['username' => 'any'], null, $now);
    return [($grace['status'] ?? '') === 'grace' && $closed === null, 'grace=' . ($grace['status'] ?? 'null')];
});

kraCommercialRun('C11b hosted tenants do not inherit an installation-environment license', static function (): array {
    putenv('KRA_LICENSE_KEY=KRA1.installation-only.signature');
    putenv('KRA_DEPLOYMENT_MODE=hosted');
    try {
        KraTenantContext::clear();
        KraTenantContext::setUser(['id' => 'u-hosted', 'role' => 'guru']);
        KraTenantContext::setWorkspace(['id' => 'ws-hosted', 'ownerUserId' => 'u-hosted', 'memberRole' => 'owner', 'legacyClaim' => false]);
        $hostedToken = KraLicense::storedToken();
        putenv('KRA_DEPLOYMENT_MODE=local');
        $localToken = KraLicense::storedToken();
        return [$hostedToken === '' && $localToken === 'KRA1.installation-only.signature', 'hosted=' . ($hostedToken === '' ? 'blocked' : 'leaked')];
    } finally {
        putenv('KRA_LICENSE_KEY=');
        putenv('KRA_DEPLOYMENT_MODE=local');
        KraTenantContext::clear();
    }
});

echo "\n== Tenant visibility & project containment ==\n";
$userA = ['id' => 'u-a', 'username' => 'a', 'role' => 'guru'];
$wsA = ['id' => 'ws-tenant-a', 'ownerUserId' => 'u-a', 'memberRole' => 'owner', 'legacyClaim' => false];
$wsB = ['id' => 'ws-tenant-b', 'ownerUserId' => 'u-b', 'memberRole' => 'owner', 'legacyClaim' => false];
kraCommercialRun('C12 rows from another workspace and unclaimed legacy rows are invisible', static function () use ($userA, $wsA): array {
    KraTenantContext::clear();
    KraTenantContext::setUser($userA);
    KraTenantContext::setWorkspace($wsA);
    $ok = KraTenantContext::rowVisible(['workspaceId' => 'ws-tenant-a'])
        && !KraTenantContext::rowVisible(['workspaceId' => 'ws-tenant-b'])
        && !KraTenantContext::rowVisible(['workspaceId' => ''])
        && !KraTenantContext::rowVisible(['workspace_id' => 'legacy']);
    return [$ok, 'workspace=' . KraTenantContext::workspaceId()];
});
kraCommercialRun('C13 only the marked legacy workspace can claim pre-tenant rows', static function () use ($userA, $wsA): array {
    $legacy = array_merge($wsA, ['legacyClaim' => true]);
    KraTenantContext::clear();
    KraTenantContext::setUser($userA);
    KraTenantContext::setWorkspace($legacy);
    $ok = KraTenantContext::rowVisible(['workspaceId' => ''])
        && KraTenantContext::rowVisible(['workspace_id' => 'legacy'])
        && !KraTenantContext::rowVisible(['workspaceId' => 'ws-tenant-b']);
    KraTenantContext::clear();
    return [$ok, 'legacy claim is explicit'];
});
kraCommercialRun('C14 project defaults are isolated per workspace', static function () use ($userA, $wsA): array {
    KraTenantContext::clear();
    KraTenantContext::setUser($userA);
    KraTenantContext::setWorkspace($wsA);
    try {
        $a = KraProjectPath::workspaceProjectsRoot('ws-tenant-a', false);
        $b = KraProjectPath::workspaceProjectsRoot('ws-tenant-b', false);
        $ok = $a !== $b && str_contains($a, 'ws-tenant-a') && str_contains($b, 'ws-tenant-b')
            && KraProjectPath::suggest('Aplikasi Kopi!', 'ws-tenant-a') === $a . DIRECTORY_SEPARATOR . 'aplikasi-kopi';
        return [$ok, $a];
    } finally {
        KraTenantContext::clear();
    }
});
kraCommercialRun('C15 project path rejects relative, traversal, and KRA-internal paths', static function () use ($root): array {
    $inside = KraProjectPath::validate($root . DIRECTORY_SEPARATOR . 'evil-app', 'ws-tenant-a', false);
    $relative = KraProjectPath::validate('relative/app', 'ws-tenant-a', false);
    $traversal = KraProjectPath::validate(KraProjectPath::projectsRoot() . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'escape', 'ws-tenant-a', false);
    return [!$inside['ok'] && !$relative['ok'] && !$traversal['ok'], implode('; ', $inside['reasons'])];
});
kraCommercialRun('C16 hosted projects cannot escape their workspace area', static function (): array {
    putenv('KRA_DEPLOYMENT_MODE=hosted');
    try {
        $inside = KraProjectPath::validateForWorkspace(
            KraProjectPath::workspaceProjectsRoot('ws-tenant-a', false) . DIRECTORY_SEPARATOR . 'aplikasi-a',
            'ws-tenant-a'
        );
        $outside = KraProjectPath::validateForWorkspace(
            KraProjectPath::projectsRoot() . DIRECTORY_SEPARATOR . 'outside-tenant-app',
            'ws-tenant-a'
        );
        $otherTenant = KraProjectPath::validateForWorkspace(
            KraProjectPath::workspaceProjectsRoot('ws-tenant-b', false) . DIRECTORY_SEPARATOR . 'aplikasi-b',
            'ws-tenant-a'
        );
        return [$inside['ok'] && !$outside['ok'] && !$otherTenant['ok'], implode('; ', $outside['reasons'])];
    } finally {
        putenv('KRA_DEPLOYMENT_MODE=local');
    }
});

echo "\n== Billing webhook primitive ==\n";
kraCommercialRun('C17 billing HMAC accepts only the exact signed body', static function (): array {
    $body = '{"event":"payment.paid","order":"KRA-ORDER-1"}';
    $secret = 'test-webhook-secret-never-production';
    $signature = hash_hmac('sha256', $body, $secret);
    $ok = KraBilling::verifyWebhookSignature($body, 'sha256=' . $signature, $secret)
        && !KraBilling::verifyWebhookSignature($body . ' ', $signature, $secret)
        && !KraBilling::verifyWebhookSignature($body, $signature, 'wrong');
    return [$ok, 'sha256= prefix supported'];
});

kraCommercialRun('C17b hosted BYOK cannot reference server env secrets or local SSRF targets', static function (): array {
    KraTenantContext::clear();
    KraTenantContext::setUser(['id' => 'u-hosted', 'username' => 'hosted', 'role' => 'guru']);
    KraTenantContext::setWorkspace(['id' => 'ws-hosted-byok', 'ownerUserId' => 'u-hosted', 'memberRole' => 'owner', 'legacyClaim' => false]);
    putenv('KRA_DEPLOYMENT_MODE=hosted');
    try {
        $localRejected = false;
        try { KraIntegrationSettings::saveProviderSettings(['providers' => ['ollama' => ['baseUrl' => 'http://127.0.0.1:11434/v1', 'model' => 'llama3.1']]]); }
        catch (InvalidArgumentException) { $localRejected = true; }
        $envRejected = false;
        try { KraIntegrationSettings::saveProviderSettings(['providers' => ['evil' => ['baseUrl' => 'https://8.8.8.8/v1', 'model' => 'x', 'apiKeyEnv' => 'KRA_DB_PASS']]]); }
        catch (InvalidArgumentException) { $envRejected = true; }
        putenv('KRA_DEPLOYMENT_MODE=local');
        $saved = KraIntegrationSettings::saveProviderSettings(['providers' => ['ollama' => ['baseUrl' => 'http://127.0.0.1:11434/v1', 'model' => 'llama3.1']]]);
        $ok = $localRejected && $envRejected && ($saved['providers']['ollama']['baseUrl'] ?? '') === 'http://127.0.0.1:11434/v1';
        return [$ok, 'hosted local/env rejected; local Ollama remains allowed'];
    } finally {
        putenv('KRA_DEPLOYMENT_MODE=local');
        KraTenantContext::clear();
    }
});

echo "\n== JSON chat + Obsidian memory isolation ==\n";
$pdoAvailable = KraDb::connect() instanceof PDO;
if ($pdoAvailable) {
    kraCommercialSkip('C18-C21 DB/Vault integration', 'PDO is available; refusing to write test data into a real database');
} else {
    kraCommercialRun('C18 JSON chat fallback is keyed by workspace', static function () use ($root, $userA, $wsA, $wsB): array {
        $file = $root . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'chat-history.json';
        $existed = is_file($file);
        $backup = $existed ? (string) file_get_contents($file) : null;
        try {
            KraTenantContext::clear();
            KraTenantContext::setUser($userA);
            KraTenantContext::setWorkspace($wsA);
            KraDb::logChat('USER', 'Pesan unik workspace AlphaZulu', 'commercial-test');
            $aText = json_encode(KraDb::getChatHistory('commercial-test', 20));
            KraTenantContext::setUser(['id' => 'u-b', 'username' => 'b', 'role' => 'guru']);
            KraTenantContext::setWorkspace($wsB);
            $bBefore = json_encode(KraDb::getChatHistory('commercial-test', 20));
            KraDb::logChat('USER', 'Pesan unik workspace BravoYankee', 'commercial-test');
            $bText = json_encode(KraDb::getChatHistory('commercial-test', 20));
            $ok = str_contains((string) $aText, 'AlphaZulu') && !str_contains((string) $bBefore, 'AlphaZulu')
                && str_contains((string) $bText, 'BravoYankee') && !str_contains((string) $bText, 'AlphaZulu');
            return [$ok, 'same channel, different workspace keys'];
        } finally {
            if ($existed) file_put_contents($file, (string) $backup, LOCK_EX);
            elseif (is_file($file)) unlink($file);
            KraTenantContext::clear();
        }
    });

    $compiledA = null;
    $compiledB = null;
    kraCommercialRun('C19 memory compiler writes redacted notes under each workspace', static function () use ($testRoot, $userA, $wsA, $wsB, &$compiledA, &$compiledB): array {
        $messagesA = [
            ['sender' => 'USER', 'message' => 'Keputusan penting: selalu gunakan kode ZafiraKuning untuk seri kopi dan deadline 2026-02-01.', 'created_at' => '2026-01-15 12:00:00'],
            ['sender' => 'NARA', 'message' => 'Catatan status selesai. api_key=sk-test-1234567890abcdef tidak boleh masuk vault.', 'created_at' => '2026-01-15 12:01:00'],
            ['sender' => 'USER', 'message' => 'Tolong lanjutkan review ZafiraKuning besok.', 'created_at' => '2026-01-15 12:02:00'],
        ];
        KraTenantContext::clear();
        KraTenantContext::setUser($userA);
        KraTenantContext::setWorkspace($wsA);
        KraVaultSettings::save($testRoot . DIRECTORY_SEPARATOR . 'vault-a');
        $compiledA = KraMemoryCompiler::compileConversation('commercial-test', $messagesA);
        $contentA = (string) file_get_contents((string) $compiledA['path']);

        KraTenantContext::setUser(['id' => 'u-b', 'username' => 'b', 'role' => 'guru']);
        KraTenantContext::setWorkspace($wsB);
        KraVaultSettings::save($testRoot . DIRECTORY_SEPARATOR . 'vault-b');
        $compiledB = KraMemoryCompiler::compileConversation('commercial-test', [
            ['sender' => 'USER', 'message' => 'Keputusan workspace lain: gunakan kode BiruLangit untuk seri teh dan target Rp150.000.', 'created_at' => '2026-01-15 12:03:00'],
        ]);
        $contentB = (string) file_get_contents((string) $compiledB['path']);
        $ok = str_contains(str_replace('\\', '/', (string) $compiledA['notePath']), 'KRA Workspaces/ws-tenant-a/')
            && str_contains(str_replace('\\', '/', (string) $compiledB['notePath']), 'KRA Workspaces/ws-tenant-b/')
            && str_contains($contentA, 'ZafiraKuning') && !str_contains($contentA, 'sk-test-1234567890abcdef')
            && str_contains($contentA, '[redacted]') && str_contains($contentB, 'BiruLangit')
            && !str_contains($contentB, 'ZafiraKuning');
        return [$ok, (string) ($compiledA['notePath'] ?? '')];
    });

    kraCommercialRun('C20 semantic recall cannot cross workspace vault boundaries', static function () use ($userA, $wsA, $wsB): array {
        KraTenantContext::clear();
        KraTenantContext::setUser(['id' => 'u-b', 'username' => 'b', 'role' => 'guru']);
        KraTenantContext::setWorkspace($wsB);
        $bContext = KraMemoryCompiler::contextForQuery('ZafiraKuning kopi deadline', 5);
        KraTenantContext::setUser($userA);
        KraTenantContext::setWorkspace($wsA);
        $aContext = KraMemoryCompiler::contextForQuery('ZafiraKuning kopi deadline', 5);
        $ok = !str_contains($bContext, 'ZafiraKuning') && str_contains($aContext, 'ZafiraKuning');
        return [$ok, 'A recall=' . strlen($aContext) . ' chars; B leak=' . (str_contains($bContext, 'ZafiraKuning') ? 'yes' : 'no')];
    });

    kraCommercialRun('C21 memory note listing is workspace-scoped without MySQL', static function () use ($wsB): array {
        KraTenantContext::clear();
        KraTenantContext::setUser(['id' => 'u-b', 'username' => 'b', 'role' => 'guru']);
        KraTenantContext::setWorkspace($wsB);
        $notes = KraMemoryCompiler::listNotes(20);
        $encoded = json_encode($notes);
        $ok = $notes !== [] && str_contains((string) $encoded, 'ws-tenant-b') && !str_contains((string) $encoded, 'ws-tenant-a');
        return [$ok, count($notes) . ' notes'];
    });
}

KraTenantContext::clear();
kraCommercialRemoveTree($testRoot, $root);
if (($privateConfigRoot ?? '') === '/tmp/kra-test-config') {
    $privateFile = $privateConfigRoot . DIRECTORY_SEPARATOR . 'integrations.json';
    if (is_file($privateFile)) @unlink($privateFile);
    if (is_dir($privateConfigRoot)) @rmdir($privateConfigRoot);
}

echo "\n== Summary ==\n";
echo "PASS {$pass} | FAIL {$fail} | SKIP {$skip}\n";
if ($fail > 0) {
    echo "COMMERCIAL_TENANT_TESTS=FAIL\n";
    if (PHP_SAPI === 'cli') exit(1);
} else {
    echo "COMMERCIAL_TENANT_TESTS=PASS\n";
}
