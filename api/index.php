<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');

require_once __DIR__ . '/lib/KraAudit.php';
require_once __DIR__ . '/lib/KraAgentRegistry.php';
require_once __DIR__ . '/lib/KraTenantContext.php';
require_once __DIR__ . '/lib/KraDb.php';
require_once __DIR__ . '/lib/KraEntitlements.php';
require_once __DIR__ . '/lib/KraBilling.php';
require_once __DIR__ . '/lib/KraLicense.php';
require_once __DIR__ . '/lib/KraWorkspaces.php';
require_once __DIR__ . '/lib/KraApiKeys.php';
require_once __DIR__ . '/lib/KraProjectPath.php';
require_once __DIR__ . '/lib/KraTaskEngine.php';
require_once __DIR__ . '/lib/KraWorkspaceBrowser.php';
require_once __DIR__ . '/lib/KraTemplateRegistry.php';
require_once __DIR__ . '/lib/KraSkillLock.php';
require_once __DIR__ . '/lib/KraSkillHub.php';
require_once __DIR__ . '/lib/KraSkillEngine.php';
require_once __DIR__ . '/lib/KraModelDispatcher.php';
require_once __DIR__ . '/lib/KraRouterGateway.php';
require_once __DIR__ . '/lib/KraAgentChat.php';
require_once __DIR__ . '/lib/KraExecutionRunner.php';
require_once __DIR__ . '/lib/KraVaultSettings.php';
require_once __DIR__ . '/lib/KraVaultSync.php';
require_once __DIR__ . '/lib/KraTerminalBridge.php';
require_once __DIR__ . '/lib/KraAuth.php';
require_once __DIR__ . '/lib/KraReActEngine.php';
require_once __DIR__ . '/lib/KraSemanticMemory.php';
require_once __DIR__ . '/lib/KraMemoryCompiler.php';
require_once __DIR__ . '/lib/KraDatasetEngine.php';
require_once __DIR__ . '/lib/KraVisionEngine.php';
require_once __DIR__ . '/lib/KraWorkflowEngine.php';
require_once __DIR__ . '/lib/KraCreatorWorkflowFactory.php';
require_once __DIR__ . '/lib/KraIntegrationSettings.php';
require_once __DIR__ . '/lib/KraYouTubeOAuth.php';
require_once __DIR__ . '/lib/KraYouTubeUploader.php';
require_once __DIR__ . '/lib/KraN100nClient.php';
require_once __DIR__ . '/lib/KraGitHubChangerClient.php';
require_once __DIR__ . '/lib/KraRnaRouterClient.php';
require_once __DIR__ . '/lib/KraTelegramBridge.php';
require_once __DIR__ . '/lib/KraGitHubBridge.php';
require_once __DIR__ . '/lib/KraWebSearchBridge.php';
require_once __DIR__ . '/lib/KraRemotionBridge.php';
require_once __DIR__ . '/lib/KraFlowBridge.php';
require_once __DIR__ . '/ProviderConfig.php';

function getProjectRoot(): string
{
    $root = realpath(__DIR__ . '/..');
    return $root !== false ? $root : getcwd();
}

function getMemoryRoot(): string
{
    return KraVaultSync::getVaultDir();
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function requireSupervisorRole(?array $user): void
{
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    if (!preg_match('/(^|[^a-z])(admin|administrator|supervisor|boss|owner)([^a-z]|$)/', $role)) {
        respond(['ok' => false, 'error' => 'Supervisor or administrator role required.'], 403);
    }
}

function requestedWorkspaceId(): string
{
    return trim((string) ($_SERVER['HTTP_X_KRA_WORKSPACE'] ?? $_GET['workspace'] ?? ''));
}

function establishTenantContext(array $user, string $requestedWorkspaceId = '', bool $fallbackToDefault = false): array
{
    KraTenantContext::setUser($user);
    KraTenantContext::setSystemAccess(false);
    if (KraTenantContext::isApiKeyAuth($user)) {
        // A generated KRA API key is bound to exactly one workspace. It may
        // not use X-KRA-Workspace to hop into another workspace owned/membered
        // by its creator, and it never falls back to the creator's default.
        $boundWorkspaceId = trim((string) ($user['apiKeyWorkspaceId'] ?? ''));
        if ($boundWorkspaceId === '') throw new DomainException('KRA API Key tidak terikat ke workspace yang valid.');
        if ($requestedWorkspaceId !== '' && !hash_equals($boundWorkspaceId, $requestedWorkspaceId)) {
            throw new DomainException('KRA API Key ini hanya berlaku untuk workspace tempat key dibuat.');
        }
        $requestedWorkspaceId = $boundWorkspaceId;
        $fallbackToDefault = false;
    }
    try {
        $workspace = KraWorkspaces::resolve($user, $requestedWorkspaceId);
    } catch (Throwable $e) {
        if (!$fallbackToDefault || $requestedWorkspaceId === '') throw $e;
        $workspace = KraWorkspaces::resolve($user, '');
        $workspace['workspaceReset'] = true;
    }
    KraTenantContext::setWorkspace($workspace);
    $entitlement = KraEntitlements::resolve($user, $workspace);
    KraTenantContext::setEntitlement($entitlement);
    return $workspace;
}

function refreshTenantEntitlement(): array
{
    $entitlement = KraEntitlements::resolve(KraTenantContext::user(), KraTenantContext::workspace());
    KraTenantContext::setEntitlement($entitlement);
    return $entitlement;
}

function publicWorkspace(array $workspace): array
{
    return [
        'id' => (string) ($workspace['id'] ?? ''),
        'name' => (string) ($workspace['name'] ?? 'Workspace'),
        'ownerUserId' => (string) ($workspace['ownerUserId'] ?? ''),
        'memberRole' => (string) ($workspace['memberRole'] ?? KraTenantContext::memberRole()),
        'isDefault' => !empty($workspace['isDefault']),
        'status' => (string) ($workspace['status'] ?? 'active'),
        'createdAt' => (string) ($workspace['createdAt'] ?? ''),
        'updatedAt' => (string) ($workspace['updatedAt'] ?? ''),
    ];
}

function requireWorkspaceAccess(string $level = 'member'): array
{
    $workspace = KraTenantContext::workspace();
    if (!is_array($workspace)) {
        if (KraDb::connect() === null && KraTenantContext::user() !== null) {
            return ['id' => '', 'name' => 'Local workspace', 'ownerUserId' => (string) (KraTenantContext::user()['id'] ?? ''), 'memberRole' => 'owner'];
        }
        respond(['ok' => false, 'code' => 'workspace_required', 'error' => 'Workspace aktif tidak ditemukan. login ulang atau pilih workspace.'], 403);
    }
    if (KraTenantContext::isPlatformAdmin()) return $workspace;
    if (KraTenantContext::userId() !== '' && (string) ($workspace['ownerUserId'] ?? '') === KraTenantContext::userId()) return $workspace;
    $role = KraTenantContext::memberRole();
    $allowed = match ($level) {
        'viewer' => in_array($role, ['owner', 'admin', 'member', 'viewer'], true),
        'member' => in_array($role, ['owner', 'admin', 'member'], true),
        'admin' => in_array($role, ['owner', 'admin'], true),
        'owner' => $role === 'owner',
        default => false,
    };
    if (!$allowed) {
        respond(['ok' => false, 'code' => 'workspace_forbidden', 'error' => 'Peran Anda di workspace ini tidak mengizinkan tindakan tersebut.'], 403);
    }
    return $workspace;
}

function requirePlatformAdmin(?array $user): void
{
    if (!KraAuth::isPlatformAdmin($user)) {
        respond(['ok' => false, 'code' => 'platform_admin_required', 'error' => 'Tindakan ini hanya untuk admin SIAS.'], 403);
    }
}

function requireCommercialFeature(string $feature, string $label): void
{
    try {
        KraEntitlements::assertFeature($feature, $label);
    } catch (DomainException $e) {
        respond([
            'ok' => false,
            'code' => 'subscription_required',
            'feature' => $feature,
            'error' => $e->getMessage(),
            'entitlement' => KraTenantContext::entitlement(),
            'catalog' => KraEntitlements::catalog(),
        ], 402);
    }
}

function kraIsApiKeyAuth(?array $user = null): bool
{
    $candidate = $user ?? KraTenantContext::user();
    return is_array($candidate) && (string) ($candidate['authType'] ?? '') === 'api_key';
}

function requirePaidApiKeyAccess(): array
{
    try {
        return KraApiKeys::assertPaidAccess(refreshTenantEntitlement());
    } catch (DomainException $e) {
        respond([
            'ok' => false,
            'code' => 'paid_subscription_required',
            'feature' => KraApiKeys::FEATURE,
            'error' => $e->getMessage(),
            'entitlement' => KraTenantContext::entitlement(),
            'catalog' => KraEntitlements::catalog(),
        ], 402);
    }
}

/**
 * Scope map for delegated KRA API keys. Unknown/sensitive actions fail closed:
 * billing, API-key management, integration secrets, terminal execution,
 * workspace membership, filesystem browsing, approvals, and YouTube upload
 * remain interactive-session operations.
 */
function kraApiKeyRequiredScope(string $action, string $method): mixed
{
    $method = strtoupper($method);
    if ($action === 'api-key-status') return null;

    $readActions = [
        'auth-status', 'setup-status', 'subscription-catalog', 'subscription-status',
        'projects', 'provider-settings', 'agents', 'hired-agents', 'templates',
        'skills', 'skill-read', 'providers', 'router-health', 'router-models',
        'runtime', 'chat-history', 'tasks', 'presence', 'workflow-list',
        'workflow-plan', 'task-preview',
    ];
    if (in_array($action, $readActions, true)) return $method === 'GET' ? 'read' : false;

    if (in_array($action, ['chat-agent', 'react-chat', 'model-propose', 'log-chat'], true)) {
        return $method === 'POST' ? 'chat' : false;
    }
    if ($action === 'propose') return $method === 'POST' ? 'tasks' : false;
    if (in_array($action, [
        'workflow-create', 'workflow-stage', 'flow-kategori', 'flow-tugas',
        'flow-selesai', 'flow-status', 'n100n-status', 'n100n-workflows',
        'n100n-execution', 'n100n-run',
    ], true)) return 'workflows';
    if ($action === 'memory-notes' || $action === 'vault-recall' || $action === 'vault-dashboard') {
        return $method === 'GET' ? 'memory' : false;
    }
    if ($action === 'memory-compile' || $action === 'meeting-record') {
        return $method === 'POST' ? 'memory' : false;
    }
    if (in_array($action, ['youtube-status', 'youtube-analytics'], true)) {
        return $method === 'GET' ? 'creator' : false;
    }
    return false;
}

function enforceApiKeyAccess(string $action, ?array $user = null): void
{
    if (!kraIsApiKeyAuth($user)) return;
    requirePaidApiKeyAccess();
    $requiredScope = kraApiKeyRequiredScope($action, (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($requiredScope === false) {
        respond([
            'ok' => false,
            'code' => 'api_key_action_forbidden',
            'error' => 'KRA API Key tidak dapat dipakai untuk action ini. Gunakan sesi login SIAS interaktif untuk pengaturan akun, billing, integrasi, persetujuan, terminal, atau upload.',
            'action' => $action,
        ], 403);
    }
    if (is_string($requiredScope) && !KraApiKeys::principalHasScope($user ?? KraTenantContext::user(), $requiredScope)) {
        respond([
            'ok' => false,
            'code' => 'api_key_scope_required',
            'error' => 'KRA API Key ini tidak memiliki scope `' . $requiredScope . '` untuk action `' . $action . '`.',
            'requiredScope' => $requiredScope,
            'scopes' => KraTenantContext::apiKeyScopes(),
        ], 403);
    }
}

function requireCreatorAccess(string $level = 'member'): array
{
    $workspace = requireWorkspaceAccess($level);
    requireCommercialFeature('creator_studio', 'Content Creator Studio');
    return $workspace;
}

function requireWorkspaceOwnerOrPlatform(?array $user): array
{
    if (KraAuth::isPlatformAdmin($user)) return KraTenantContext::workspace() ?? [];
    return requireWorkspaceAccess('owner');
}

function kraHeaderValue(string $name): string
{
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$serverName])) return trim((string) $_SERVER[$serverName]);
    if (function_exists('getallheaders')) {
        foreach ((array) getallheaders() as $key => $value) {
            if (strcasecmp((string) $key, $name) === 0) return trim((string) $value);
        }
    }
    return '';
}

function authSessionPayload(array $user, array $workspace): array
{
    $entitlement = refreshTenantEntitlement();
    $workspaces = KraDb::connect() !== null ? array_map('publicWorkspace', KraWorkspaces::listForUser($user)) : [publicWorkspace($workspace)];
    $billingOwnerId = KraEntitlements::billingOwnerId($user, KraTenantContext::workspace());
    $subscription = KraEntitlements::publicSubscription(KraBilling::subscriptionForUser($billingOwnerId));
    $provider = ProviderConfig::publicSummary();
    $vault = KraVaultSettings::current();
    $projects = KraTenantContext::hasWorkspace() ? KraWorkspaces::projects(KraTenantContext::workspace()) : [];
    $setup = [
        'deploymentMode' => KraTenantContext::deploymentMode(),
        'databaseConnected' => KraDb::connect() !== null,
        'workspaceReady' => KraTenantContext::hasWorkspace() || KraDb::connect() === null,
        'providerConfigured' => !empty($provider['hasProvider']),
        'provider' => $provider,
        'vaultConfigured' => !empty($vault['exists']) && !empty($vault['writable']),
        'vault' => [
            'exists' => !empty($vault['exists']),
            'writable' => !empty($vault['writable']),
            'path' => KraTenantContext::isWorkspaceAdmin() || KraTenantContext::isPlatformAdmin() ? (string) ($vault['path'] ?? '') : '',
        ],
        'projectCount' => count($projects),
        'subscriptionActive' => !empty($entitlement['active']),
        'license' => KraLicense::status(),
        'nextSteps' => [],
    ];
    if (!$setup['providerConfigured']) $setup['nextSteps'][] = 'Hubungkan Ollama atau simpan API key provider milik workspace (BYOK).';
    if (!$setup['vaultConfigured']) $setup['nextSteps'][] = 'Pilih/buat Vault Obsidian untuk memori jangka panjang workspace.';
    if ($setup['projectCount'] === 0) $setup['nextSteps'][] = 'Buat folder proyek default atau daftarkan folder proyek yang sudah ada.';
    if (!$setup['subscriptionActive'] && !KraAuth::isPlatformAdmin($user)) $setup['nextSteps'][] = 'Aktifkan PRO/PLUS/PLATINUM atau impor lisensi offline untuk membuka Creator Studio.';

    return [
        'user' => $user,
        'isPlatformAdmin' => KraAuth::isPlatformAdmin($user),
        'isSupervisor' => KraAuth::isSupervisor($user),
        'activeWorkspace' => publicWorkspace($workspace),
        'workspaces' => $workspaces,
        'entitlement' => $entitlement,
        'subscription' => $subscription,
        'catalog' => KraEntitlements::catalog(),
        'setup' => $setup,
        'deploymentMode' => KraTenantContext::deploymentMode(),
    ];
}

$action = $_GET['action'] ?? 'status';

try {
    $projectRoot = getProjectRoot();
    $memoryRoot = ''; // Resolved only after tenant context exists.
    // No built-in or predictable pairing credentials are created here.
    // Accounts and bearer sessions come only from the configured SIAS identity source.

    // Queue/flow endpoints are machine-to-machine. The Creator Studio N100N
    // controls use a KRA bearer session; the N100N service key stays in PHP.
    $currentUser = null;
    $aksiFlowMesin = ['flow-kategori', 'flow-tugas', 'flow-selesai', 'flow-status'];
    $aksiN100nStudio = ['n100n-status', 'n100n-workflows', 'n100n-run', 'n100n-execution'];
    $publicActions = ['status', 'login', 'register', 'auth-status', 'youtube-oauth-callback', 'telegram-webhook', 'billing-webhook', 'github-changer-event', 'rna-router-event'];
    if (in_array($action, $aksiFlowMesin, true)) {
        $generatedApiKey = KraAuth::extractApiKey();
        if ($generatedApiKey !== null) {
            // Paid workspace API keys may drive the generic flow queue. They
            // remain bound to their own workspace below; the global machine
            // key remains available for the trusted local N100N bridge.
            $currentUser = KraAuth::authenticateApiKey($generatedApiKey);
            if (!is_array($currentUser)) {
                respond(['ok' => false, 'code' => 'api_key_invalid', 'error' => 'KRA API Key tidak valid, kedaluwarsa, atau sudah di-revoke.'], 401);
            }
        } else {
            $kunciMesin = trim((string) (getenv('KRA_FLOW_API_KEY') ?: getenv('KRA_API_KEY') ?: ''));
            $kunciKirim = trim((string) ($_SERVER['HTTP_X_API_KEY'] ?? ''));
            if ($kunciMesin === '' || !hash_equals($kunciMesin, $kunciKirim)) {
                respond(['ok' => false, 'error' => 'x-api-key tidak cocok.'], 401);
            }
            $currentUser = [
                'id' => 'n100n-bridge',
                'username' => 'n100n',
                'display_name' => 'n100n bridge',
                'role' => 'supervisor',
            ];
        }
    } elseif (in_array($action, $aksiN100nStudio, true)) {
        $kunciMesin = trim((string) (getenv('KRA_FLOW_API_KEY') ?: getenv('KRA_API_KEY') ?: ''));
        $kunciKirim = trim((string) ($_SERVER['HTTP_X_API_KEY'] ?? ''));
        if ($kunciMesin !== '' && $kunciKirim !== '' && hash_equals($kunciMesin, $kunciKirim)) {
            // Preserve trusted machine access without exposing this key to browsers.
            $currentUser = [
                'id' => 'n100n-bridge',
                'username' => 'n100n',
                'display_name' => 'n100n bridge',
                'role' => 'supervisor',
            ];
        } else {
            $currentUser = KraAuth::requireUser();
        }
    } elseif (!in_array($action, $publicActions, true)) {
        $currentUser = KraAuth::requireUser();
    }

    if (is_array($currentUser) && (string) ($currentUser['id'] ?? '') !== 'n100n-bridge') {
        try {
            establishTenantContext($currentUser, requestedWorkspaceId());
        } catch (Throwable $e) {
            respond(['ok' => false, 'code' => 'workspace_forbidden', 'error' => $e->getMessage()], 403);
        }
    } elseif (is_array($currentUser)) {
        KraTenantContext::setUser($currentUser);
        $machineWorkspaceId = requestedWorkspaceId();
        if ($machineWorkspaceId !== '') {
            $machineWorkspace = KraWorkspaces::byId($machineWorkspaceId);
            if ($machineWorkspace === null) respond(['ok' => false, 'code' => 'workspace_not_found', 'error' => 'Workspace untuk N100N tidak ditemukan.'], 404);
            KraTenantContext::setWorkspace($machineWorkspace + ['memberRole' => 'machine']);
            KraTenantContext::setEntitlement(KraEntitlements::resolve(null, $machineWorkspace));
        } elseif (KraTenantContext::isHosted() && in_array($action, $aksiFlowMesin, true)) {
            respond(['ok' => false, 'code' => 'workspace_required', 'error' => 'Kirim header X-KRA-Workspace pada mode hosted agar tugas N100N tidak tercampur.'], 400);
        }
    }

    if (is_array($currentUser) && kraIsApiKeyAuth($currentUser)) {
        enforceApiKeyAccess($action, $currentUser);
    }

    if ($action === 'billing-webhook') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $rawBody = (string) file_get_contents('php://input');
        try {
            $result = KraBilling::handleSignedWebhook($rawBody, kraHeaderValue('X-KRA-Signature'));
        } catch (DomainException $e) {
            $signatureFailure = stripos($e->getMessage(), 'signature') !== false;
            respond(['ok' => false, 'code' => $signatureFailure ? 'webhook_signature_invalid' : 'webhook_rejected', 'error' => $e->getMessage()], $signatureFailure ? 401 : 422);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'code' => 'webhook_payload_invalid', 'error' => $e->getMessage()], 422);
        }
        respond(['ok' => true, 'handled' => $result]);
    }

    if ($action === 'youtube-oauth-callback') {
        KraYouTubeOAuth::callback();
    }

    if ($action === 'telegram-webhook') {
        // Public by necessity (Telegram calls it), authenticated by the
        // secret token header registered via telegram-set-webhook.
        $telegramSecret = (string) ($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
        $telegramWorkspaceId = requestedWorkspaceId();
        if ($telegramWorkspaceId !== '') {
            $telegramWorkspace = KraWorkspaces::byId($telegramWorkspaceId);
            if ($telegramWorkspace === null) respond(['ok' => false, 'error' => 'Telegram workspace tidak ditemukan.'], 404);
            KraTenantContext::setWorkspace($telegramWorkspace + ['memberRole' => 'telegram_webhook']);
            KraTenantContext::setSystemAccess(true);
        } else {
            $telegramMatch = KraIntegrationSettings::findTelegramWorkspaceBySecret($telegramSecret);
            if ($telegramMatch !== null && (string) ($telegramMatch['workspaceId'] ?? '') !== '') {
                $telegramWorkspace = KraWorkspaces::byId((string) $telegramMatch['workspaceId']);
                if ($telegramWorkspace !== null) {
                    KraTenantContext::setWorkspace($telegramWorkspace + ['memberRole' => 'telegram_webhook']);
                    KraTenantContext::setSystemAccess(true);
                }
            }
        }
        if (!KraTelegramBridge::verifyWebhookSecret($telegramSecret)) {
            respond(['ok' => false, 'error' => 'Webhook secret tidak cocok.'], 401);
        }
        $update = json_decode((string) file_get_contents('php://input'), true);
        if (is_array($update)) KraTelegramBridge::handleUpdate($update);
        respond(['ok' => true]);
    }

    if (in_array($action, [
        'subscription-catalog', 'subscription-status', 'subscription-checkout-request', 'subscription-start-trial',
        'subscription-cancel', 'subscription-orders', 'subscription-admin-list', 'subscription-admin-upsert',
        'subscription-admin-order-paid', 'license-status', 'license-import', 'workspaces', 'workspace-update',
        'workspace-members', 'projects', 'project-default', 'provider-settings', 'memory-compile', 'memory-notes', 'setup-status', 'api-keys', 'api-key-status',
    ], true)) {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $payload = $method === 'GET' ? [] : (json_decode((string) file_get_contents('php://input'), true) ?: $_POST);
        if (!is_array($payload)) $payload = [];
        try {
            if ($action === 'subscription-catalog') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'subscription-catalog requires GET.'], 405);
                respond(['ok' => true, 'catalog' => KraEntitlements::catalog(), 'entitlement' => refreshTenantEntitlement()]);
            }

            if ($action === 'subscription-status') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'subscription-status requires GET.'], 405);
                $billingOwnerId = KraEntitlements::billingOwnerId($currentUser, KraTenantContext::workspace());
                respond([
                    'ok' => true,
                    'entitlement' => refreshTenantEntitlement(),
                    'subscription' => KraEntitlements::publicSubscription(KraBilling::subscriptionForUser($billingOwnerId)),
                    'license' => KraLicense::status(),
                    'catalog' => KraEntitlements::catalog(),
                    'activeWorkspace' => publicWorkspace(requireWorkspaceAccess('viewer')),
                ]);
            }

            if ($action === 'subscription-checkout-request') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'subscription-checkout-request requires POST.'], 405);
                requireWorkspaceOwnerOrPlatform($currentUser);
                $ownerId = KraEntitlements::billingOwnerId($currentUser, KraTenantContext::workspace());
                $billingUser = KraAuth::findUserById($ownerId) ?? $currentUser;
                $order = KraBilling::createCheckoutRequest(
                    $billingUser,
                    (string) ($payload['plan'] ?? ''),
                    (string) ($payload['billingPeriod'] ?? 'monthly')
                );
                KraBilling::recordEvent($ownerId, 'checkout_request_details', [
                    'orderId' => (string) ($order['id'] ?? ''),
                    'workspaceId' => KraTenantContext::workspaceId(),
                    'paymentMethod' => substr(trim((string) ($payload['paymentMethod'] ?? 'manual-transfer')), 0, 80),
                    'note' => substr(trim((string) ($payload['note'] ?? '')), 0, 500),
                    'setupService' => substr(trim((string) ($payload['setupService'] ?? '')), 0, 500),
                ]);
                respond(['ok' => true, 'order' => $order, 'message' => 'Permintaan pembayaran dibuat. Akses dibuka setelah pembayaran terverifikasi oleh admin KRA atau webhook pembayaran.']);
            }

            if ($action === 'subscription-start-trial') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'subscription-start-trial requires POST.'], 405);
                requireWorkspaceOwnerOrPlatform($currentUser);
                $subscription = KraBilling::startTrial($currentUser);
                respond(['ok' => true, 'subscription' => KraEntitlements::publicSubscription($subscription), 'entitlement' => refreshTenantEntitlement(), 'message' => 'Trial KRA PRO 7 hari aktif.']);
            }

            if ($action === 'subscription-cancel') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'subscription-cancel requires POST.'], 405);
                requireWorkspaceOwnerOrPlatform($currentUser);
                $ownerId = KraEntitlements::billingOwnerId($currentUser, KraTenantContext::workspace());
                $subscription = KraBilling::cancel($ownerId, !empty($payload['immediate']), (string) $currentUser['id']);
                respond(['ok' => true, 'subscription' => KraEntitlements::publicSubscription($subscription), 'entitlement' => refreshTenantEntitlement(), 'message' => 'Langganan dibatalkan. File dan riwayat workspace Anda tetap tersimpan.']);
            }

            if ($action === 'subscription-orders') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'subscription-orders requires GET.'], 405);
                $ownerId = KraAuth::isPlatformAdmin($currentUser) && trim((string) ($_GET['userId'] ?? '')) !== ''
                    ? trim((string) $_GET['userId'])
                    : (string) $currentUser['id'];
                respond(['ok' => true, 'orders' => KraBilling::ordersForUser($ownerId, 100)]);
            }

            if ($action === 'subscription-admin-list') {
                requirePlatformAdmin($currentUser);
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'subscription-admin-list requires GET.'], 405);
                respond(['ok' => true, 'subscriptions' => KraBilling::adminList(200), 'orders' => KraBilling::adminOrders(100, 'pending'), 'catalog' => KraEntitlements::catalog()]);
            }

            if ($action === 'subscription-admin-upsert') {
                requirePlatformAdmin($currentUser);
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'subscription-admin-upsert requires POST.'], 405);
                $target = KraAuth::findUserByUsernameOrId(trim((string) ($payload['userId'] ?? $payload['username'] ?? '')));
                if ($target === null) respond(['ok' => false, 'error' => 'Pengguna SIAS tidak ditemukan.'], 404);
                $subscription = KraBilling::upsertSubscription([
                    'userId' => (string) $target['id'],
                    'plan' => (string) ($payload['plan'] ?? ''),
                    'billingPeriod' => (string) ($payload['billingPeriod'] ?? 'monthly'),
                    'status' => (string) ($payload['status'] ?? 'active'),
                    'currentPeriodEnd' => isset($payload['periodEndsAt']) && trim((string) $payload['periodEndsAt']) !== '' ? (string) $payload['periodEndsAt'] : null,
                    'paymentProvider' => trim((string) ($payload['provider'] ?? 'manual')),
                ], (string) $currentUser['id']);
                if (trim((string) ($payload['setupService'] ?? '')) !== '') {
                    KraBilling::recordEvent((string) $target['id'], 'full_service_requested', ['actorUserId' => (string) $currentUser['id'], 'setupService' => substr(trim((string) $payload['setupService']), 0, 1000)]);
                }
                $subscription = KraEntitlements::publicSubscription($subscription);
                respond(['ok' => true, 'subscription' => $subscription, 'user' => ['id' => (string) $target['id'], 'username' => (string) $target['username'], 'role' => (string) $target['role']]]);
            }

            if ($action === 'subscription-admin-order-paid') {
                requirePlatformAdmin($currentUser);
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'subscription-admin-order-paid requires POST.'], 405);
                $result = KraBilling::markOrderPaid(
                    trim((string) ($payload['orderId'] ?? $payload['orderCode'] ?? '')),
                    (string) $currentUser['id'],
                    trim((string) ($payload['provider'] ?? 'manual')) ?: 'manual',
                    trim((string) ($payload['providerReference'] ?? 'manual-verified'))
                );
                respond(['ok' => true] + $result + ['message' => 'Pembayaran terverifikasi dan langganan pengguna diaktifkan.']);
            }

            if ($action === 'license-status') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'license-status requires GET.'], 405);
                requireWorkspaceAccess('admin');
                respond(['ok' => true, 'license' => KraLicense::status(), 'entitlement' => refreshTenantEntitlement()]);
            }

            if ($action === 'license-import') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'license-import requires POST.'], 405);
                requireWorkspaceOwnerOrPlatform($currentUser);
                $license = KraLicense::import(trim((string) ($payload['token'] ?? '')));
                respond(['ok' => true, 'license' => $license, 'entitlement' => refreshTenantEntitlement(), 'message' => 'Lisensi offline tersimpan untuk workspace aktif.']);
            }

            if ($action === 'workspaces') {
                if ($method === 'GET') {
                    respond([
                        'ok' => true,
                        'workspaces' => array_map('publicWorkspace', KraWorkspaces::listForUser($currentUser)),
                        'activeWorkspace' => publicWorkspace(requireWorkspaceAccess('viewer')),
                        'entitlement' => refreshTenantEntitlement(),
                    ]);
                }
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'workspaces requires GET or POST.'], 405);
                $workspace = KraWorkspaces::create($currentUser, trim((string) ($payload['name'] ?? 'Workspace baru')));
                respond(['ok' => true, 'workspace' => publicWorkspace($workspace), 'message' => 'Workspace dibuat. Pilih workspace tersebut untuk mulai menggunakannya.']);
            }

            if ($action === 'workspace-update') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'workspace-update requires POST.'], 405);
                $workspace = requireWorkspaceAccess('admin');
                if (array_key_exists('name', $payload)) $workspace = KraWorkspaces::rename($workspace, (string) $payload['name']);
                if (strtolower(trim((string) ($payload['status'] ?? ''))) === 'archived') {
                    KraWorkspaces::archive($workspace);
                    $workspace['status'] = 'archived';
                }
                KraTenantContext::setWorkspace($workspace);
                respond(['ok' => true, 'workspace' => publicWorkspace($workspace)]);
            }

            if ($action === 'workspace-members') {
                $workspace = requireWorkspaceAccess($method === 'GET' ? 'viewer' : 'admin');
                if ($method === 'GET') {
                    respond(['ok' => true, 'workspace' => publicWorkspace($workspace), 'members' => KraWorkspaces::members($workspace)]);
                }
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'workspace-members requires GET or POST.'], 405);
                $operation = strtolower(trim((string) ($payload['operation'] ?? 'add')));
                if ($operation === 'remove') {
                    $members = KraWorkspaces::removeMember($workspace, trim((string) ($payload['userId'] ?? '')));
                    respond(['ok' => true, 'members' => $members, 'message' => 'Anggota dihapus dari workspace.']);
                }
                $members = KraWorkspaces::addMember(
                    $workspace,
                    trim((string) ($payload['username'] ?? $payload['userId'] ?? '')),
                    trim((string) ($payload['role'] ?? 'member'))
                );
                respond(['ok' => true, 'members' => $members, 'message' => 'Anggota workspace diperbarui.']);
            }

            if ($action === 'projects') {
                $workspace = requireWorkspaceAccess($method === 'GET' ? 'viewer' : 'admin');
                if ($method === 'GET') {
                    respond(['ok' => true, 'projects' => KraWorkspaces::projects($workspace), 'workspace' => publicWorkspace($workspace)]);
                }
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'projects requires GET or POST.'], 405);
                $projectRootInput = trim((string) ($payload['root'] ?? $payload['rootPath'] ?? ''));
                if (!empty($payload['create'])) {
                    $projectCheck = KraProjectPath::validateForWorkspace($projectRootInput, (string) $workspace['id']);
                    if (empty($projectCheck['ok'])) throw new DomainException('Lokasi proyek ditolak: ' . implode(' ', (array) ($projectCheck['reasons'] ?? [])));
                    $projectRootInput = (string) $projectCheck['path'];
                    if (!is_dir($projectRootInput) && !@mkdir($projectRootInput, 0777, true) && !is_dir($projectRootInput)) {
                        throw new RuntimeException('Folder proyek tidak dapat dibuat oleh server KRA.');
                    }
                }
                $project = KraWorkspaces::registerProject(
                    $workspace,
                    trim((string) ($payload['name'] ?? '')),
                    $projectRootInput,
                    !empty($payload['isDefault'])
                );
                respond(['ok' => true, 'project' => $project, 'projects' => KraWorkspaces::projects($workspace)]);
            }

            if ($action === 'project-default') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'project-default requires POST.'], 405);
                $workspace = requireWorkspaceAccess('admin');
                $project = KraWorkspaces::ensureDefaultProject($workspace);
                respond(['ok' => true, 'project' => $project, 'projects' => KraWorkspaces::projects($workspace)]);
            }

            if ($action === 'provider-settings') {
                if ($method === 'GET') {
                    requireWorkspaceAccess('viewer');
                    respond(['ok' => true, 'provider' => ProviderConfig::publicSummary(), 'workspaceId' => KraTenantContext::workspaceId()]);
                }
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'provider-settings requires GET or POST.'], 405);
                requireWorkspaceAccess('admin');
                KraIntegrationSettings::saveProviderSettings(is_array($payload['provider'] ?? null) ? $payload['provider'] : $payload);
                KraDb::recordUsage('provider_settings_updated', 1, ['workspaceId' => KraTenantContext::workspaceId()]);
                respond(['ok' => true, 'provider' => ProviderConfig::publicSummary(), 'message' => 'Pengaturan provider workspace tersimpan. API key tidak pernah dikembalikan ke browser.']);
            }

            if ($action === 'memory-compile') {
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'memory-compile requires POST.'], 405);
                requireWorkspaceAccess('member');
                requireCommercialFeature('vault_manual', 'Kompilasi memori Obsidian');
                $channel = trim((string) ($payload['channel'] ?? 'general')) ?: 'general';
                if (KraAgentChat::isCreatorChannel($channel)) requireCommercialFeature('creator_studio', 'Content Creator Studio');
                $memoryLimit = KraEntitlements::limit('memoryCompilesMonthly');
                KraEntitlements::assertUnderLimit('memoryCompilesMonthly', KraDb::usageCount('memory_compiled', $memoryLimit === null ? 10000 : $memoryLimit + 1), 'kompilasi memori bulan ini');
                $result = KraMemoryCompiler::compileConversation($channel);
                respond(['ok' => !empty($result['ok']), 'memory' => $result], !empty($result['ok']) ? 200 : 422);
            }

            if ($action === 'memory-notes') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'memory-notes requires GET.'], 405);
                requireWorkspaceAccess('viewer');
                requireCommercialFeature('vault_manual', 'Memori Obsidian');
                respond(['ok' => true, 'notes' => KraMemoryCompiler::listNotes(min(100, max(1, (int) ($_GET['limit'] ?? 30))))]);
            }

            if ($action === 'setup-status') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'setup-status requires GET.'], 405);
                $workspace = requireWorkspaceAccess('viewer');
                $session = authSessionPayload($currentUser, $workspace);
                respond(['ok' => true, 'setup' => $session['setup'], 'entitlement' => $session['entitlement'], 'activeWorkspace' => $session['activeWorkspace'], 'catalog' => $session['catalog']]);
            }

            if ($action === 'api-key-status') {
                if ($method !== 'GET') respond(['ok' => false, 'error' => 'api-key-status requires GET.'], 405);
                $workspace = requireWorkspaceAccess('viewer');
                $key = null;
                if (kraIsApiKeyAuth($currentUser)) {
                    $key = KraApiKeys::publicById($workspace, (string) ($currentUser['apiKeyId'] ?? ''))
                        ?? (is_array($currentUser['apiKey'] ?? null) ? $currentUser['apiKey'] : null);
                }
                respond([
                    'ok' => true,
                    'authenticated' => true,
                    'authType' => kraIsApiKeyAuth($currentUser) ? 'api_key' : 'sias_session',
                    'user' => [
                        'id' => (string) ($currentUser['id'] ?? ''),
                        'username' => (string) ($currentUser['username'] ?? ''),
                        'display_name' => (string) ($currentUser['display_name'] ?? ''),
                        'role' => (string) ($currentUser['role'] ?? ''),
                    ],
                    'activeWorkspace' => publicWorkspace($workspace),
                    'entitlement' => refreshTenantEntitlement(),
                    'apiKey' => $key,
                    'scopes' => kraIsApiKeyAuth($currentUser) ? KraTenantContext::apiKeyScopes() : [],
                ]);
            }

            if ($action === 'api-keys') {
                if (kraIsApiKeyAuth($currentUser)) {
                    respond(['ok' => false, 'code' => 'api_key_management_forbidden', 'error' => 'KRA API Key tidak dapat mengelola API key lain. login dengan sesi SIAS pemilik/admin workspace.'], 403);
                }
                $workspace = requireWorkspaceAccess('admin');
                if ($method === 'GET') {
                    $entitlement = refreshTenantEntitlement();
                    respond([
                        'ok' => true,
                        'keys' => KraApiKeys::listForWorkspace($workspace),
                        'summary' => KraApiKeys::summary($workspace, $entitlement),
                        'entitlement' => $entitlement,
                        'activeWorkspace' => publicWorkspace($workspace),
                    ]);
                }
                if ($method !== 'POST') respond(['ok' => false, 'error' => 'api-keys requires GET or POST.'], 405);

                $operation = strtolower(trim((string) ($payload['operation'] ?? 'create')));
                if ($operation === 'revoke') {
                    // Revocation stays available after a plan lapses so an
                    // owner/admin can always disable a leaked credential.
                    $revoked = KraApiKeys::revoke($workspace, $currentUser, trim((string) ($payload['id'] ?? $payload['keyId'] ?? '')));
                    KraDb::recordUsage('api_key_revoked', 1, ['apiKeyId' => (string) ($revoked['id'] ?? ''), 'workspaceId' => KraTenantContext::workspaceId()]);
                    $entitlement = refreshTenantEntitlement();
                    respond([
                        'ok' => true,
                        'key' => $revoked,
                        'keys' => KraApiKeys::listForWorkspace($workspace),
                        'summary' => KraApiKeys::summary($workspace, $entitlement),
                        'message' => 'KRA API Key di-revoke dan tidak dapat digunakan lagi.',
                    ]);
                }

                requireCommercialFeature('kra_api_access', 'KRA API Key');
                requirePaidApiKeyAccess();
                if ($operation === 'rotate') {
                    $created = KraApiKeys::rotate($workspace, $currentUser, trim((string) ($payload['id'] ?? $payload['keyId'] ?? '')));
                    KraDb::recordUsage('api_key_rotated', 1, ['apiKeyId' => (string) ($created['key']['id'] ?? ''), 'replacedKeyId' => (string) ($created['replacedKeyId'] ?? ''), 'workspaceId' => KraTenantContext::workspaceId()]);
                    $entitlement = refreshTenantEntitlement();
                    respond([
                        'ok' => true,
                        'apiKey' => (string) ($created['apiKey'] ?? ''),
                        'key' => $created['key'] ?? null,
                        'replacedKeyId' => (string) ($created['replacedKeyId'] ?? ''),
                        'keys' => KraApiKeys::listForWorkspace($workspace),
                        'summary' => KraApiKeys::summary($workspace, $entitlement),
                        'message' => 'KRA API Key baru dibuat dan key lama langsung di-revoke. Secret baru hanya ditampilkan sekali ini.',
                    ]);
                }
                if ($operation !== 'create') {
                    respond(['ok' => false, 'error' => 'Operation api-keys tidak dikenal. Gunakan create, rotate, atau revoke.'], 422);
                }

                $expiresInDays = 90;
                if (array_key_exists('expiresInDays', $payload)) {
                    $expiresInDays = $payload['expiresInDays'] === null ? 0 : (int) $payload['expiresInDays'];
                }
                $created = KraApiKeys::create(
                    $workspace,
                    $currentUser,
                    trim((string) ($payload['name'] ?? 'KRA API Key')),
                    $payload['scopes'] ?? ['read'],
                    $expiresInDays
                );
                KraDb::recordUsage('api_key_created', 1, ['apiKeyId' => (string) ($created['key']['id'] ?? ''), 'scopes' => $created['key']['scopes'] ?? [], 'workspaceId' => KraTenantContext::workspaceId()]);
                $entitlement = refreshTenantEntitlement();
                respond([
                    'ok' => true,
                    'apiKey' => (string) ($created['apiKey'] ?? ''),
                    'key' => $created['key'] ?? null,
                    'keys' => KraApiKeys::listForWorkspace($workspace),
                    'summary' => KraApiKeys::summary($workspace, $entitlement),
                    'message' => 'KRA API Key dibuat. Simpan secret sekarang: secret hanya ditampilkan sekali dan server hanya menyimpan hash-nya.',
                ]);
            }
        } catch (DomainException $e) {
            respond(['ok' => false, 'code' => 'commercial_limit_or_access', 'error' => $e->getMessage(), 'entitlement' => KraTenantContext::entitlement(), 'catalog' => KraEntitlements::catalog()], 402);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        }
    }

    if ($action === 'youtube-config') {
        requireCreatorAccess($_SERVER['REQUEST_METHOD'] === 'GET' ? 'viewer' : 'admin');
        requireCommercialFeature('youtube_connect', 'Koneksi YouTube');
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status()]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-config requires GET or POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        try {
            KraIntegrationSettings::saveYoutubeCredentials(
                (string) ($payload['client_id'] ?? ''),
                array_key_exists('client_secret', $payload) ? (string) $payload['client_secret'] : null,
                (string) ($payload['redirect_uri'] ?? ''),
            );
            respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status(), 'message' => 'Google OAuth settings saved securely on the KRA server.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        }
    }

    if ($action === 'youtube-oauth-start') {
        requireCreatorAccess('admin');
        requireCommercialFeature('youtube_connect', 'Koneksi YouTube');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-oauth-start requires POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        // Desktop (Electron) authorizes in the system browser and lands on a
        // static confirmation page instead of navigating the app window away.
        $client = ($payload['client'] ?? '') === 'desktop' ? 'desktop' : 'web';
        try {
            respond(['ok' => true, 'authorization_url' => KraYouTubeOAuth::authorizationUrl((string) ($currentUser['id'] ?? ''), $client)]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        }
    }

    if ($action === 'youtube-status') {
        requireCreatorAccess('viewer');
        requireCommercialFeature('youtube_connect', 'Koneksi YouTube');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') respond(['ok' => false, 'error' => 'youtube-status requires GET.'], 405);
        respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status()]);
    }

    if ($action === 'youtube-disconnect') {
        requireCreatorAccess('admin');
        requireCommercialFeature('youtube_connect', 'Koneksi YouTube');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-disconnect requires POST.'], 405);
        KraYouTubeOAuth::disconnect();
        respond(['ok' => true, 'youtube' => KraYouTubeOAuth::status(), 'message' => 'YouTube channel disconnected and the stored Google token was revoked when the provider was reachable.']);
    }

    if ($action === 'youtube-upload') {
        requireCreatorAccess('admin');
        requireCommercialFeature('youtube_upload', 'Upload YouTube');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'youtube-upload requires POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        // Uploading is an external side effect: it only runs from an explicit,
        // human-confirmed supervisor action in the KRA UI, never implicitly.
        if (($payload['confirm'] ?? false) !== true) {
            respond(['ok' => false, 'error' => 'Human confirmation is required: send {"confirm": true} only after a supervisor reviewed the final video and metadata.'], 422);
        }
        try {
            try {
                $uploadLimit = KraEntitlements::limit('youtubeUploadsMonthly');
                KraEntitlements::assertUnderLimit(
                    'youtubeUploadsMonthly',
                    KraDb::usageCount('youtube_upload', $uploadLimit === null ? 10000 : $uploadLimit + 1),
                    'upload YouTube bulan ini'
                );
            } catch (DomainException $e) {
                respond(['ok' => false, 'code' => 'quota_exceeded', 'error' => $e->getMessage(), 'entitlement' => KraTenantContext::entitlement(), 'catalog' => KraEntitlements::catalog()], 402);
            }
            $result = KraYouTubeUploader::upload($payload);
            KraDb::recordUsage('youtube_upload', 1, ['videoId' => (string) ($result['videoId'] ?? ''), 'workspaceId' => KraTenantContext::workspaceId()]);
            KraTelegramBridge::notify('🎬 Upload YouTube selesai: "' . $result['title'] . '" (' . $result['privacy'] . ")\n" . $result['studioUrl']);
            respond(['ok' => true, 'video' => $result, 'message' => 'Video sent to YouTube Studio as ' . $result['privacy'] . ': ' . $result['studioUrl']]);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            error_log('[KraYouTubeUpload] ' . $e->getMessage());
            KraTelegramBridge::notify('⚠️ Upload YouTube gagal: ' . $e->getMessage());
            respond(['ok' => false, 'error' => $e->getMessage()], 502);
        }
    }

    if ($action === 'youtube-analytics') {
        requireCreatorAccess('viewer');
        requireCommercialFeature('youtube_analytics_basic', 'YouTube Analytics');
        try {
            $analytics = KraYouTubeOAuth::analyticsSummary();
            $advanced = KraEntitlements::hasFeature('youtube_analytics_advanced');
            $analytics['advanced'] = $advanced;
            if (!$advanced) {
                // PRO receives the 28-day channel totals; per-video ranking and
                // production review detail are the PLUS/PLATINUM differentiator.
                $analytics['topVideos'] = [];
            }
            KraDb::recordUsage('youtube_analytics', 1, ['workspaceId' => KraTenantContext::workspaceId(), 'advanced' => $advanced]);
            respond(['ok' => true, 'analytics' => $analytics]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 502);
        }
    }

    if (in_array($action, ['telegram-config', 'telegram-pairing', 'telegram-test', 'telegram-set-webhook', 'telegram-disconnect'], true)) {
        requireWorkspaceAccess('admin');
        requireCommercialFeature('telegram_notifications', 'Notifikasi Telegram');
        if (($currentUser['id'] ?? '') === 'n100n-bridge') respond(['ok' => false, 'error' => 'Use an authenticated KRA administrator session to change integration settings.'], 403);
        if ($action === 'telegram-config') {
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                respond(['ok' => true, 'telegram' => KraTelegramBridge::status()]);
            }
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'telegram-config requires GET or POST.'], 405);
            $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
            try {
                $clear = filter_var($payload['clear_token'] ?? false, FILTER_VALIDATE_BOOLEAN);
                if ($clear) KraTelegramBridge::removeWebhook();
                KraIntegrationSettings::saveTelegramToken(
                    array_key_exists('bot_token', $payload) ? (string) $payload['bot_token'] : null,
                    $clear
                );
                respond(['ok' => true, 'telegram' => KraTelegramBridge::status(), 'message' => $clear
                    ? 'Bot token Telegram dihapus dari server KRA.'
                    : 'Bot token Telegram tersimpan aman di server KRA. Berikutnya: buat kode pairing lalu kirim /start KODE ke bot Anda.']);
            } catch (InvalidArgumentException $e) {
                respond(['ok' => false, 'error' => $e->getMessage()], 422);
            }
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => $action . ' requires POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        try {
            if ($action === 'telegram-pairing') {
                if (KraIntegrationSettings::telegram()['botToken'] === '') {
                    respond(['ok' => false, 'error' => 'Simpan bot token dulu sebelum membuat kode pairing.'], 422);
                }
                $code = KraIntegrationSettings::startTelegramPairing();
                respond(['ok' => true, 'pairingCode' => $code, 'message' => 'Kirim "/start ' . $code . '" ke bot Telegram Anda dalam 10 menit untuk memasangkan chat ini.']);
            }
            if ($action === 'telegram-test') {
                $sent = KraTelegramBridge::sendTo(
                    KraIntegrationSettings::telegram()['chatId'],
                    '👋 Tes dari KRA: bot pemantau terhubung. Ketik /help untuk daftar perintah.'
                );
                if (!$sent) respond(['ok' => false, 'error' => 'Pesan tes gagal terkirim. Pastikan token benar dan chat sudah dipasangkan (pairing).'], 502);
                respond(['ok' => true, 'message' => 'Pesan tes terkirim ke Telegram Anda.']);
            }
            if ($action === 'telegram-set-webhook') {
                $base = (string) ($payload['base_url'] ?? (getenv('KRA_PUBLIC_BASE_URL') ?: ''));
                $result = KraTelegramBridge::setWebhook($base);
                respond(['ok' => true, 'telegram' => KraTelegramBridge::status(), 'message' => 'Webhook terdaftar: ' . $result['webhookUrl']]);
            }
            // telegram-disconnect
            KraIntegrationSettings::clearTelegramPairing();
            respond(['ok' => true, 'telegram' => KraTelegramBridge::status(), 'message' => 'Pasangan chat Telegram dilepas. Bot tidak lagi melayani perintah sampai pairing ulang.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            error_log('[KraTelegram] ' . $e->getMessage());
            respond(['ok' => false, 'error' => $e->getMessage()], 502);
        }
    }

    if ($action === 'n100n-config') {
        requireWorkspaceAccess('admin');
        requireCommercialFeature('n100n_workflows', 'Integrasi N100N');
        if (($currentUser['id'] ?? '') === 'n100n-bridge') respond(['ok' => false, 'error' => 'Use an authenticated KRA administrator session to change integration settings.'], 403);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $settings = KraIntegrationSettings::n100n();
            respond(['ok' => true, 'n100n' => [
                'baseUrl' => KraIntegrationSettings::publicN100nBaseUrl(),
                'configured' => $settings['apiKey'] !== '',
                'environmentManaged' => (!KraTenantContext::isHosted() || KraTenantContext::canUseLegacyIntegrations()) && ((string) getenv('KRA_N100N_BASE_URL') !== '' || (string) getenv('KRA_N100N_URL') !== '' || (string) getenv('KRA_N100N_API_KEY') !== '' || (string) getenv('KRA_N100N_TOKEN') !== ''),
                'workspaceId' => KraTenantContext::workspaceId(),
            ]]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'error' => 'n100n-config requires GET or POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        try {
            KraIntegrationSettings::saveN100n((string) ($payload['base_url'] ?? ''), array_key_exists('api_key', $payload) ? (string) $payload['api_key'] : null, !empty($payload['clear_key']));
            $settings = KraIntegrationSettings::n100n();
            respond(['ok' => true, 'n100n' => ['baseUrl' => KraIntegrationSettings::publicN100nBaseUrl(), 'configured' => $settings['apiKey'] !== ''], 'message' => 'N100N settings saved securely on the KRA server.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ---------------- GitHub Changer (dashboard Git/GitHub lokal) ----------
    // Callback publik dari service Node. Tidak memakai sesi SIAS: verifikasi
    // HMAC-SHA256 atas body mentah + pemeriksaan waktu (anti replay).
    if ($action === 'github-changer-event') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            respond(['ok' => false, 'error' => 'github-changer-event requires POST.'], 405);
        }
        $raw = (string) file_get_contents('php://input');
        if (strlen($raw) > 65536) respond(['ok' => false, 'error' => 'GitHub Changer event payload is too large.'], 413);
        $secret = KraIntegrationSettings::githubChangerEventSecret();
        $signature = kraHeaderValue('X-KRA-Signature');
        $expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
        if ($secret === '' || $signature === '' || !hash_equals($expected, $signature)) {
            respond(['ok' => false, 'error' => 'GitHub Changer event signature tidak valid atau secret belum diset.'], 401);
        }
        $payload = json_decode($raw, true);
        if (!is_array($payload) || ($payload['source'] ?? '') !== 'github-changer' || ($payload['type'] ?? '') !== 'automation') {
            respond(['ok' => false, 'error' => 'Format event GitHub Changer tidak dikenal.'], 422);
        }
        $eventTime = strtotime((string) ($payload['at'] ?? ''));
        if ($eventTime === false || abs(time() - $eventTime) > 900) {
            respond(['ok' => false, 'error' => 'Waktu event GitHub Changer tidak valid atau terlalu lama.'], 422);
        }
        KraIntegrationSettings::saveGitHubChangerEvent($payload);
        respond(['ok' => true, 'message' => 'GitHub Changer event diterima.']);
    }

    if ($action === 'github-changer-status') {
        requireWorkspaceAccess('viewer');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['ok' => false, 'error' => 'github-changer-status requires GET.'], 405);
        $status = KraGitHubChangerClient::status();
        $connected = (bool) ($status['ok'] ?? false);
        respond([
            'ok' => true,
            'connected' => $connected,
            'configured' => (bool) ($status['configured'] ?? false),
            'message' => $connected
                ? 'KRA can reach the bundled GitHub Changer service.'
                : (string) ($status['error'] ?? 'GitHub Changer is not reachable from the KRA server.'),
            'githubChanger' => $status,
        ]);
    }

    if ($action === 'github-changer-repos') {
        // Daftar repo memuat path absolut mesin server: admin workspace saja.
        requireWorkspaceAccess('admin');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['ok' => false, 'error' => 'github-changer-repos requires GET.'], 405);
        try {
            $repos = KraGitHubChangerClient::repos();
            respond(['ok' => true, 'repos' => $repos['repos'] ?? [], 'count' => (int) ($repos['count'] ?? 0)]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'GitHub Changer repo list failed: ' . $e->getMessage()], 502);
        }
    }

    if ($action === 'github-changer-activity') {
        requireWorkspaceAccess('admin');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['ok' => false, 'error' => 'github-changer-activity requires GET.'], 405);
        $limit = filter_var($_GET['limit'] ?? 10, FILTER_VALIDATE_INT);
        try {
            $activity = KraGitHubChangerClient::activity($limit === false ? 10 : (int) $limit);
            respond(['ok' => true, 'entries' => $activity['entries'] ?? []]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'GitHub Changer activity failed: ' . $e->getMessage()], 502);
        }
    }

    if ($action === 'github-changer-sync') {
        requireWorkspaceAccess('admin');
        requireSupervisorRole($currentUser);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond(['ok' => false, 'error' => 'github-changer-sync requires POST.'], 405);
        try {
            respond(['ok' => true, 'result' => KraGitHubChangerClient::sync()]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'GitHub Changer sync failed: ' . $e->getMessage()], 502);
        }
    }

    if ($action === 'github-changer-config') {
        requireWorkspaceAccess('admin');
        if (($currentUser['id'] ?? '') === 'n100n-bridge') {
            respond(['ok' => false, 'error' => 'Use an authenticated KRA administrator session to change integration settings.'], 403);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
            $settings = KraIntegrationSettings::githubChanger();
            respond(['ok' => true, 'githubChanger' => [
                'baseUrl' => KraIntegrationSettings::publicGitHubChangerBaseUrl(),
                'configured' => $settings['apiKey'] !== '',
                'environmentManaged' => (!KraTenantContext::isHosted() || KraTenantContext::canUseLegacyIntegrations())
                    && ((string) getenv('KRA_GITHUB_CHANGER_URL') !== '' || (string) getenv('KRA_GITHUB_CHANGER_API_KEY') !== ''),
                'eventSecretConfigured' => KraIntegrationSettings::githubChangerEventSecret() !== '',
                'lastEvent' => KraIntegrationSettings::githubChangerEvent(),
                'workspaceId' => KraTenantContext::workspaceId(),
            ]]);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond(['ok' => false, 'error' => 'github-changer-config requires GET or POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (!is_array($payload)) $payload = [];
        try {
            $current = KraIntegrationSettings::githubChanger();
            KraIntegrationSettings::saveGitHubChanger(
                (string) ($payload['base_url'] ?? $current['baseUrl']),
                array_key_exists('api_key', $payload) ? (string) $payload['api_key'] : null,
                !empty($payload['clear_key'])
            );
            $settings = KraIntegrationSettings::githubChanger();
            respond(['ok' => true, 'githubChanger' => [
                'baseUrl' => KraIntegrationSettings::publicGitHubChangerBaseUrl(),
                'configured' => $settings['apiKey'] !== '',
            ], 'message' => 'GitHub Changer settings saved securely on the KRA server.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ---------------- RNA Router (gateway AI + automation) ------------------
    // Callback publik dari scripts/kra-automation.js. Otentikasi HMAC-SHA256
    // atas body mentah + jendela waktu, bukan sesi browser.
    if ($action === 'rna-router-event') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            respond(['ok' => false, 'error' => 'rna-router-event requires POST.'], 405);
        }
        $raw = (string) file_get_contents('php://input');
        if (strlen($raw) > 65536) respond(['ok' => false, 'error' => 'RNA Router event payload is too large.'], 413);
        $secret = KraIntegrationSettings::rnaRouterEventSecret();
        $signature = kraHeaderValue('X-KRA-Signature');
        $expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
        if ($secret === '' || $signature === '' || !hash_equals($expected, $signature)) {
            respond(['ok' => false, 'error' => 'RNA Router event signature tidak valid atau secret belum diset.'], 401);
        }
        $payload = json_decode($raw, true);
        if (!is_array($payload) || ($payload['source'] ?? '') !== 'rna-router' || ($payload['type'] ?? '') !== 'automation') {
            respond(['ok' => false, 'error' => 'Format event RNA Router tidak dikenal.'], 422);
        }
        $eventTime = strtotime((string) ($payload['at'] ?? ''));
        if ($eventTime === false || abs(time() - $eventTime) > 900) {
            respond(['ok' => false, 'error' => 'Waktu event RNA Router tidak valid atau terlalu lama.'], 422);
        }
        KraIntegrationSettings::saveRnaRouterEvent($payload);
        respond(['ok' => true, 'message' => 'RNA Router automation event diterima.']);
    }

    if ($action === 'rna-router-status') {
        requireWorkspaceAccess('viewer');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['ok' => false, 'error' => 'rna-router-status requires GET.'], 405);
        $status = KraRnaRouterClient::status();
        $connected = (bool) ($status['ok'] ?? false);
        respond([
            'ok' => true,
            'connected' => $connected,
            'message' => $connected
                ? ($status['healthy'] ? 'KRA can reach the RNA Router gateway.' : 'RNA Router menjawab, tetapi status health bukan ok.')
                : (string) ($status['error'] ?? 'RNA Router is not reachable from the KRA server.'),
            'rnaRouter' => $status,
        ]);
    }

    if ($action === 'rna-router-models') {
        requireWorkspaceAccess('viewer');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['ok' => false, 'error' => 'rna-router-models requires GET.'], 405);
        try {
            [$models, $count] = KraRnaRouterClient::models();
            respond(['ok' => true, 'models' => $models, 'count' => $count]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'RNA Router model list failed: ' . $e->getMessage()], 502);
        }
    }

    if ($action === 'rna-router-chat') {
        requireWorkspaceAccess('admin');
        requireSupervisorRole($currentUser);
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond(['ok' => false, 'error' => 'rna-router-chat requires POST.'], 405);
        $raw = (string) file_get_contents('php://input');
        if (strlen($raw) > 16384) respond(['ok' => false, 'error' => 'RNA Router test message is too large.'], 413);
        $payload = json_decode($raw, true) ?: $_POST;
        if (!is_array($payload)) $payload = [];
        try {
            $result = KraRnaRouterClient::chat((string) ($payload['message'] ?? ''), (string) ($payload['model'] ?? ''));
            respond($result);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'RNA Router chat test failed: ' . $e->getMessage()], 502);
        }
    }

    if ($action === 'rna-router-config') {
        requireWorkspaceAccess('admin');
        if (($currentUser['id'] ?? '') === 'n100n-bridge') {
            respond(['ok' => false, 'error' => 'Use an authenticated KRA administrator session to change integration settings.'], 403);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
            $settings = KraIntegrationSettings::rnaRouter();
            respond(['ok' => true, 'rnaRouter' => [
                'baseUrl' => KraIntegrationSettings::publicRnaRouterBaseUrl(),
                'model' => $settings['model'],
                'configured' => $settings['baseUrl'] !== '',
                'apiKeyConfigured' => $settings['apiKey'] !== '',
                'environmentManaged' => (!KraTenantContext::isHosted() || KraTenantContext::canUseLegacyIntegrations())
                    && ((string) getenv('KRA_RNA_ROUTER_URL') !== '' || (string) getenv('KRA_RNA_ROUTER_API_KEY') !== ''),
                'eventSecretConfigured' => KraIntegrationSettings::rnaRouterEventSecret() !== '',
                'lastEvent' => KraIntegrationSettings::rnaRouterEvent(),
                'workspaceId' => KraTenantContext::workspaceId(),
            ]]);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond(['ok' => false, 'error' => 'rna-router-config requires GET or POST.'], 405);
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (!is_array($payload)) $payload = [];
        try {
            $current = KraIntegrationSettings::rnaRouter();
            KraIntegrationSettings::saveRnaRouter(
                (string) ($payload['base_url'] ?? $current['baseUrl']),
                array_key_exists('api_key', $payload) ? (string) $payload['api_key'] : null,
                (string) ($payload['model'] ?? $current['model']),
                !empty($payload['clear_key'])
            );
            $settings = KraIntegrationSettings::rnaRouter();
            respond(['ok' => true, 'rnaRouter' => [
                'baseUrl' => KraIntegrationSettings::publicRnaRouterBaseUrl(),
                'model' => $settings['model'],
                'configured' => true,
            ], 'message' => 'RNA Router settings saved securely on the KRA server.']);
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    if ($action === 'status') {
        $statusMemoryRoot = KraTenantContext::hasWorkspace() ? getMemoryRoot() : '';
        respond([
            'ok' => true,
            'service' => 'KRA Local Bridge',
            'deploymentMode' => KraTenantContext::deploymentMode(),
            'projectExists' => is_dir($projectRoot),
            'memoryExists' => $statusMemoryRoot !== '' && is_dir($statusMemoryRoot),
            'readOnlyAudit' => true,
            'catalog' => KraEntitlements::catalog(),
        ]);
    }

    if ($action === 'agents') {
        requireWorkspaceAccess('viewer');
        respond([
            'ok' => true,
            'agents' => KraAgentRegistry::all(),
        ]);
    }

    if ($action === 'presence') {
        requireWorkspaceAccess($_SERVER['REQUEST_METHOD'] === 'GET' ? 'viewer' : 'member');
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            respond(['ok' => true, 'presence' => KraDb::getPresence(), 'events' => KraDb::getAgentEvents()]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'presence requires GET or POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        if (isset($payload['presence'])) KraDb::savePresence($payload['presence']);
        if (isset($payload['event'])) KraDb::saveAgentEvent($payload['event']);
        respond(['ok' => true, 'saved' => true]);
    }

    if ($action === 'save-agent') {
        requireWorkspaceAccess('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'save-agent requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if (empty($payload['id']) || empty($payload['name']) || empty($payload['role'])) {
            respond(['ok' => false, 'error' => 'Agent id, name, and role are required.'], 400);
        }
        $existingAgents = KraDb::getHiredAgents();
        $existingAgent = null;
        foreach ($existingAgents as $candidate) {
            if ((string) ($candidate['id'] ?? '') === (string) $payload['id']) { $existingAgent = $candidate; break; }
        }
        $agentMode = strtolower((string) (($payload['workspace']['mode'] ?? null) ?: ($payload['mode'] ?? $existingAgent['workspace']['mode'] ?? '')));
        if ($agentMode === 'creator') {
            requireCommercialFeature('creator_studio', 'Content Creator Studio');
            if ($existingAgent === null) requireCommercialFeature('creator_custom_agents', 'Agent Creator kustom');
        }
        if ($existingAgent === null) {
            try {
                KraEntitlements::assertUnderLimit('customAgents', count($existingAgents), 'agent kustom');
            } catch (DomainException $e) {
                respond(['ok' => false, 'code' => 'quota_exceeded', 'error' => $e->getMessage(), 'entitlement' => KraTenantContext::entitlement(), 'catalog' => KraEntitlements::catalog()], 402);
            }
        }
        if (!KraDb::saveAgent($payload)) {
            respond(['ok' => false, 'saved' => false, 'error' => 'The server database is unavailable; the agent profile was not saved.'], 503);
        }
        respond(['ok' => true, 'saved' => true]);
    }

    if ($action === 'hired-agents') {
        requireWorkspaceAccess('viewer');
        $agents = KraDb::getHiredAgents();
        if (!KraEntitlements::hasFeature('creator_studio')) {
            $agents = array_values(array_filter($agents, static fn(array $agent): bool => strtolower((string) ($agent['workspace']['mode'] ?? $agent['mode'] ?? '')) !== 'creator' && !str_starts_with((string) ($agent['id'] ?? ''), 'creator_')));
        }
        respond(['ok' => true, 'agents' => $agents, 'workspaceId' => KraTenantContext::workspaceId()]);
    }

    if ($action === 'log-chat') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'log-chat requires POST.'], 405);
        }
        requireWorkspaceAccess('member');
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $logChannel = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($payload['channel'] ?? 'office')) ?: 'office';
        if (KraAgentChat::isCreatorChannel($logChannel)) requireCommercialFeature('creator_studio', 'Content Creator Studio');
        KraDb::logChat(
            (string) ($payload['sender'] ?? 'User'),
            (string) ($payload['message'] ?? ''),
            $logChannel
        );
        respond(['ok' => true]);
    }

    if ($action === 'chat-history') {
        requireWorkspaceAccess('viewer');
        $channel = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['channel'] ?? 'team'));
        if (KraAgentChat::isCreatorChannel((string) $channel)) requireCommercialFeature('creator_studio', 'Content Creator Studio');
        $limit = (int) ($_GET['limit'] ?? 50);
        respond([
            'ok' => true,
            'channel' => $channel !== '' ? $channel : 'team',
            'messages' => KraDb::getChatHistory($channel !== '' ? $channel : 'team', $limit),
        ]);
    }

    if ($action === 'react-chat') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'react-chat requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        $agent = (string) ($payload['agentId'] ?? 'budi');
        $message = (string) ($payload['message'] ?? '');
        $maxTurns = (int) ($payload['maxTurns'] ?? 6);
        $chainHandoff = (bool) ($payload['chainHandoff'] ?? true);
        $provider = (string) ($payload['provider'] ?? '');
        $model = (string) ($payload['model'] ?? '');
        $channel = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($payload['channel'] ?? 'react')) ?: 'react';
        if ($message === '') {
            respond(['ok' => false, 'error' => 'Message is required.'], 400);
        }
        requireWorkspaceAccess('member');
        if (KraAgentChat::isCreatorChannel($channel) || str_starts_with($agent, 'creator_')) {
            requireCommercialFeature('creator_studio', 'Content Creator Studio');
        } else {
            foreach (KraDb::getHiredAgents() as $hiredAgent) {
                if ((string) ($hiredAgent['id'] ?? '') === $agent && strtolower((string) ($hiredAgent['workspace']['mode'] ?? $hiredAgent['mode'] ?? '')) === 'creator') {
                    requireCommercialFeature('creator_studio', 'Content Creator Studio');
                    break;
                }
            }
        }
        $streamReact = ($_GET['stream'] ?? '') === '1';
        $emitReact = null;
        if ($streamReact) {
            @set_time_limit(0);
            while (ob_get_level() > 0) ob_end_clean();
            @ini_set('zlib.output_compression', '0');
            header('Content-Type: application/x-ndjson; charset=utf-8');
            header('Cache-Control: no-cache, no-transform');
            header('X-Accel-Buffering: no');
            $emitReact = static function (array $event): void {
                echo json_encode($event, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
                if (function_exists('ob_flush')) @ob_flush();
                flush();
            };
        }
        KraDb::logChat('User', $message, $channel);
        try {
            $reactResult = KraReActEngine::runLoop(
                $agent, $message, $maxTurns, $chainHandoff, $provider, $model,
                $streamReact ? static function (array $progress) use ($emitReact): void {
                    $emitReact(['type' => 'progress', 'progress' => $progress]);
                } : null
            );
            $creatorNames = ['creator_research' => 'Nara', 'creator_writer' => 'Aruna', 'creator_producer' => 'Dito', 'creator_reviewer' => 'Lintang'];
            $sender = $creatorNames[$agent] ?? match (strtolower($agent)) {
                'rama' => 'Rama', 'maya', 'modifier' => 'Maya', 'dimas', 'auditor' => 'Dimas', 'siti', 'ops' => 'Siti', default => 'Budi'
            };
            KraDb::logChat($sender, (string) ($reactResult['finalAnswer'] ?? ''), $channel);
            if (isset($reactResult['trace']) && is_array($reactResult['trace'])) {
                foreach ($reactResult['trace'] as &$step) {
                    unset($step['thought']);
                    if (isset($step['action'])) {
                        unset($step['input']);
                        $observation = is_array($step['observation'] ?? null) ? $step['observation'] : [];
                        $summary = !empty($observation['ok']) ? 'Action completed; result reviewed.' : 'Action did not complete; the agent adjusted its plan.';
                        if (!empty($observation['task']) && is_array($observation['task'])) {
                            $step['observation'] = ['ok' => true, 'summary' => 'Proposal staged and waiting for approval.', 'task' => $observation['task']];
                        } else {
                            $step['observation'] = ['ok' => (bool) ($observation['ok'] ?? false), 'summary' => $summary];
                        }
                    } else {
                        $step['progress'] = 'Final response prepared.';
                    }
                }
                unset($step);
            }
            if ($streamReact) {
                $emitReact(['type' => 'done', 'ok' => true, 'result' => $reactResult]);
                exit;
            }
            respond($reactResult);
        } catch (Throwable $e) {
            if ($streamReact) {
                $emitReact(['type' => 'error', 'ok' => false, 'error' => $e instanceof InvalidArgumentException ? $e->getMessage() : 'ReAct request failed. Check provider status and server logs.']);
                exit;
            }
            throw $e;
        }
    }

    if ($action === 'chat-agent') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'chat-agent requires POST.'], 405);
        }
        $rawChatBody = (string) file_get_contents('php://input');
        if (strlen($rawChatBody) > 8 * 1024 * 1024) {
            respond(['ok' => false, 'error' => 'Chat attachments exceed the 8 MB request limit.'], 413);
        }
        $payload = json_decode($rawChatBody, true) ?: [];
        requireWorkspaceAccess('member');
        $chatChannel = trim((string) ($payload['channel'] ?? 'team')) ?: 'team';
        $chatAgentId = trim((string) ($payload['agentId'] ?? $payload['agent'] ?? ''));
        if (KraAgentChat::isCreatorChannel($chatChannel) || ($chatAgentId !== '' && KraAgentChat::isCreatorAgentId($chatAgentId))) {
            requireCommercialFeature('creator_studio', 'Content Creator Studio');
            if (!empty($payload['fanout'])) requireCommercialFeature('creator_parallel', 'Mode ⚡ Paralel Studio Crew');
            $crewMode = strtolower(trim((string) ($payload['crewMode'] ?? $payload['crew_mode'] ?? '')));
            if ($chatChannel === 'creator_studio_team' && empty($payload['fanout']) && $crewMode !== 'parallel') {
                requireCommercialFeature('creator_discussion', 'Mode 💬 Diskusi Studio Crew');
            }
            if ($chatAgentId !== '' && !in_array($chatAgentId, ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer'], true) && KraAgentChat::isCreatorAgentId($chatAgentId)) {
                requireCommercialFeature('creator_custom_agents', 'Agent Creator kustom');
            }
        }
        if (($_GET['stream'] ?? '') === '1') {
            @set_time_limit(0);
            while (ob_get_level() > 0) ob_end_clean();
            @ini_set('zlib.output_compression', '0');
            header('Content-Type: application/x-ndjson; charset=utf-8');
            header('Cache-Control: no-cache, no-transform');
            header('X-Accel-Buffering: no');
            $emit = static function (array $event): void {
                echo json_encode($event, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
                if (function_exists('ob_flush')) @ob_flush();
                flush();
            };
            try {
                $result = KraAgentChat::dispatch(
                    $payload,
                    static function (array $reply, int $index, int $total) use ($emit): void {
                        $emit(['type' => 'reply', 'reply' => $reply, 'index' => $index, 'total' => $total]);
                    },
                    static function (array $progress) use ($emit): void {
                        $emit(['type' => 'progress', 'progress' => $progress]);
                    }
                );
                $emit(['type' => 'done', 'ok' => true, 'channel' => $result['channel'], 'provider' => $result['provider'], 'elapsedMs' => $result['elapsedMs'] ?? null, 'fanout' => !empty($result['fanout']), 'workspaceWarning' => $result['workspaceWarning'] ?? null]);
            } catch (Throwable $e) {
                $message = $e instanceof InvalidArgumentException || $e instanceof DomainException
                    ? $e->getMessage()
                    : 'Chat could not start. Check the selected live provider and server logs.';
                $emit(['type' => 'error', 'ok' => false, 'error' => $message]);
            }
            exit;
        }
        respond(KraAgentChat::dispatch($payload));
    }

    if ($action === 'tasks') {
        requireWorkspaceAccess('viewer');
        $tasks = KraTaskEngine::loadTasks();
        if (!KraEntitlements::hasFeature('creator_studio')) {
            $tasks = array_filter($tasks, static fn(array $task): bool => strtolower((string) ($task['scope'] ?? $task['context']['scope'] ?? '')) !== 'creator');
        }
        respond([
            'ok' => true,
            'tasks' => $tasks,
            'workspaceId' => KraTenantContext::workspaceId(),
        ]);
    }

    if ($action === 'auth-status') {
        $user = KraAuth::authenticate();
        if ($user === null) {
            respond([
                'ok' => true,
                'authenticated' => false,
                'user' => null,
                'catalog' => KraEntitlements::catalog(),
                'deploymentMode' => KraTenantContext::deploymentMode(),
            ]);
        }
        try {
            $workspace = establishTenantContext($user, requestedWorkspaceId(), true);
            if (kraIsApiKeyAuth($user)) {
                enforceApiKeyAccess('auth-status', $user);
                respond([
                    'ok' => true,
                    'authenticated' => true,
                    'authType' => 'api_key',
                    'user' => [
                        'id' => (string) ($user['id'] ?? ''),
                        'username' => (string) ($user['username'] ?? ''),
                        'display_name' => (string) ($user['display_name'] ?? ''),
                        'role' => (string) ($user['role'] ?? ''),
                    ],
                    'activeWorkspace' => publicWorkspace($workspace),
                    'entitlement' => refreshTenantEntitlement(),
                    'apiKey' => is_array($user['apiKey'] ?? null) ? $user['apiKey'] : null,
                    'scopes' => KraTenantContext::apiKeyScopes(),
                    'catalog' => KraEntitlements::catalog(),
                    'deploymentMode' => KraTenantContext::deploymentMode(),
                ]);
            }
            respond(['ok' => true, 'authenticated' => true] + authSessionPayload($user, $workspace));
        } catch (Throwable $e) {
            respond(['ok' => false, 'authenticated' => true, 'user' => $user, 'error' => 'Workspace belum dapat disiapkan: ' . $e->getMessage()], 500);
        }
    }

    if ($action === 'logout') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'logout requires POST.'], 405);
        }
        if (!KraAuth::logout()) {
            respond(['ok' => false, 'error' => 'Could not revoke the current session on the server.'], 503);
        }
        respond(['ok' => true, 'loggedOut' => true]);
    }

    if ($action === 'login') {
        $user = KraAuth::login($_POST['username'] ?? '', $_POST['password'] ?? '');
        if ($user) {
            if (isset($user['error'])) {
                respond(['ok' => false, 'error' => $user['error']]);
            } else {
                try {
                    $sessionUser = $user['user'];
                    $workspace = establishTenantContext($sessionUser, requestedWorkspaceId(), true);
                    respond(['ok' => true, 'token' => $user['token']] + authSessionPayload($sessionUser, $workspace));
                } catch (Throwable $e) {
                    // Authentication itself succeeded. Workspace provisioning can
                    // be retried by auth-status after the database is available.
                    error_log('[KraLoginWorkspace] ' . $e->getMessage());
                    respond(['ok' => true, 'token' => $user['token'], 'user' => $user['user'], 'workspaceError' => $e->getMessage(), 'catalog' => KraEntitlements::catalog()]);
                }
            }
        } else {
            respond(['ok' => false, 'error' => 'Username atau password salah']);
        }
    }

    if ($action === 'register') {
        $res = KraAuth::register($_POST);
        respond(['ok' => isset($res['success']), 'error' => $res['error'] ?? null]);
    }

    if ($action === 'auth-officers') {
        if (!KraTenantContext::isPlatformAdmin() && !KraTenantContext::isWorkspaceAdmin()) {
            respond(['ok' => false, 'error' => 'Direktori pengguna hanya untuk admin SIAS atau admin workspace.'], 403);
        }
        respond([
            'ok' => true,
            'officers' => KraAuth::getOfficerDirectory(),
        ]);
    }

    if ($action === 'decorations') {
        $user = KraAuth::requireUser();
        $floor = (int) ($_GET['floor'] ?? 1);
        respond([
            'ok' => true,
            'floor' => $floor,
            'owner' => $user['id'],
            'items' => KraDb::getDecorations($floor, $user['id']),
        ]);
    }

    if ($action === 'save-decor') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'save-decor requires POST.'], 405);
        }
        $user = KraAuth::requireUser();
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $floor = (int) ($payload['floor'] ?? 1);
        $tileX = (int) ($payload['x'] ?? 0);
        $tileY = (int) ($payload['y'] ?? 0);
        $item = (string) ($payload['item'] ?? '');
        // Client-supplied owner is deliberately ignored to prevent IDOR vulnerabilities
        KraDb::saveDecoration($floor, $tileX, $tileY, $item, $user['id']);
        respond(['ok' => true, 'saved' => true, 'owner' => $user['id']]);
    }

    if ($action === 'clear-decor') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'clear-decor requires POST.'], 405);
        }
        $user = KraAuth::requireUser();
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $floor = (int) ($payload['floor'] ?? 1);
        KraDb::clearDecorations($floor, $user['id']);
        respond(['ok' => true, 'cleared' => true, 'owner' => $user['id']]);
    }

    if ($action === 'runtime') {
        requireWorkspaceAccess('viewer');
        $memoryRoot = getMemoryRoot();
        $memorySettings = KraVaultSettings::current();
        $canViewMemoryPath = KraTenantContext::isPlatformAdmin() || KraTenantContext::isWorkspaceAdmin();
        $memoryWritable = $memoryRoot !== '' && is_writable($memoryRoot);
        $providerConfig = ProviderConfig::load();
        $providerSummary = [];
        foreach (($providerConfig['providers'] ?? []) as $providerName => $provider) {
            $providerSummary[$providerName] = [
                'provider' => (string) $providerName,
                'configured' => (bool) ($provider['configured'] ?? false),
                'online' => null,
                'status' => 'not_checked',
            ];
        }
        respond([
            'ok' => true,
            'service' => 'KRA Local Bridge',
            'php' => PHP_VERSION,
            'projectRoot' => $canViewMemoryPath ? $projectRoot : '',
            'workspaceId' => KraTenantContext::workspaceId(),
            'deploymentMode' => KraTenantContext::deploymentMode(),
            'entitlement' => KraTenantContext::entitlement(),
            'database' => KraDb::connect() instanceof PDO,
            'taskCount' => count(KraTaskEngine::loadTasks()),
            'executionStates' => ['WAITING_APPROVAL', 'EXECUTING', 'EXECUTED', 'FAILED', 'REJECTED'],
            'memoryRoot' => $canViewMemoryPath ? $memoryRoot : '',
            'memoryRootFromEnv' => $memorySettings['source'] === 'environment',
            'memoryRootSource' => $memorySettings['source'],
            'memoryExists' => $memoryRoot !== '' && is_dir($memoryRoot),
            'memoryWritable' => $memoryWritable,
            'defaultProvider' => (string) ($providerConfig['defaultProvider'] ?? ''),
            'providers' => $providerSummary,
        ]);
    }

    if ($action === 'model-propose') {
        requireWorkspaceAccess('member');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Model proposals require POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: [];
        $provider = (string) ($payload['provider'] ?? ProviderConfig::load()['defaultProvider'] ?? '');
        if ($provider === '9router') {
            try {
                $result = KraRouterGateway::complete($payload);
            } catch (Throwable $error) {
                $config = ProviderConfig::load();
                $fallback = (string) ($config['providers']['9router']['fallbackProvider'] ?? '');
                if ($fallback === '' || $fallback === '9router') throw $error;
                $result = KraRouterGateway::complete(array_replace($payload, ['provider' => $fallback]));
                $result['fallbackFrom'] = '9router';
            }
        } else {
            $result = KraModelDispatcher::propose($payload);
        }
        respond(['ok' => true, 'result' => $result]);
    }

    if ($action === 'router-health') {
        requireWorkspaceAccess('viewer');
        $provider = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['provider'] ?? ''));
        respond(['ok' => true, 'health' => KraRouterGateway::health($provider)]);
    }

    if ($action === 'router-models') {
        requireWorkspaceAccess('viewer');
        $provider = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['provider'] ?? ''));
        respond(['ok' => true, 'catalog' => KraRouterGateway::models($provider)]);
    }

    if ($action === 'vault-settings') {
        requireWorkspaceAccess('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'vault-settings requires GET.'], 405);
        }
        respond(['ok' => true] + KraVaultSettings::current());
    }

    if ($action === 'vault-browse') {
        requireWorkspaceAccess('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'vault-browse requires GET.'], 405);
        }
        try {
            respond(['ok' => true] + KraVaultSettings::browse((string) ($_GET['path'] ?? '')));
        } catch (InvalidArgumentException $error) {
            respond(['ok' => false, 'error' => $error->getMessage()], 400);
        }
    }

    if ($action === 'vault-select') {
        requireWorkspaceAccess('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'vault-select requires POST.'], 405);
        }
        $rawVaultBody = (string) file_get_contents('php://input');
        if (strlen($rawVaultBody) > 8192) respond(['ok' => false, 'error' => 'Vault setting request is too large.'], 413);
        $payload = json_decode($rawVaultBody, true);
        if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
            respond(['ok' => false, 'error' => 'Vault selection must be valid JSON.'], 400);
        }
        try {
            respond(['ok' => true] + KraVaultSettings::save((string) ($payload['path'] ?? '')));
        } catch (InvalidArgumentException $error) {
            respond(['ok' => false, 'error' => $error->getMessage()], 400);
        }
    }

    if ($action === 'vault-sync') {
        requireWorkspaceAccess('admin');
        requireCommercialFeature('vault_manual', 'Sinkronisasi Vault Obsidian');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Vault sync requires POST.'], 405);
        }
        respond(KraVaultSync::sync($projectRoot));
    }

    if ($action === 'meeting-record') {
        requireWorkspaceAccess('member');
        requireCommercialFeature('vault_manual', 'Catatan rapat di Vault');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'meeting-record requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $topic = (string) ($payload['topic'] ?? 'Executive Alignment');
        $participants = (array) ($payload['participants'] ?? ['Rama', 'Jarvis']);
        $dialogues = (array) ($payload['dialogues'] ?? []);
        $verdict = (string) ($payload['verdict'] ?? 'APPROVED');
        $actionItems = (array) ($payload['actionItems'] ?? []);
        respond(KraVaultSync::recordMeeting($topic, $participants, $dialogues, $verdict, $actionItems));
    }

    if ($action === 'vault-recall') {
        requireWorkspaceAccess('viewer');
        $query = (string) ($_GET['q'] ?? '');
        $mode = (string) ($_GET['mode'] ?? 'semantic');
        if ($mode === 'semantic') {
            requireCommercialFeature('vault_semantic_memory', 'Memori semantik Obsidian');
            respond([
                'ok' => true,
                'mode' => 'semantic_rag',
                'results' => KraSemanticMemory::recall($query),
            ]);
        }
        respond(KraVaultSync::recall($query));
    }

    if ($action === 'dataset-export') {
        requirePlatformAdmin($currentUser);
        respond(KraDatasetEngine::exportDataset());
    }

    if ($action === 'vision-inspect') {
        requirePlatformAdmin($currentUser);
        respond(KraVisionEngine::captureAndInspect($projectRoot));
    }

    if ($action === 'workflow-list') {
        requireWorkspaceAccess('viewer');
        respond(['ok' => true, 'workflows' => KraWorkflowEngine::listWorkflows()]);
    }

    if ($action === 'workflow-create') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'workflow-create requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $title = (string) ($payload['title'] ?? 'Autonomous Swarm Plan');
        requireWorkspaceAccess('member');
        $nodes = !empty($payload['creatorStarter'])
            ? KraCreatorWorkflowFactory::starterNodes($title)
            : (array) ($payload['nodes'] ?? []);
        $hasCreatorNode = !empty($payload['creatorStarter']);
        foreach ($nodes as $node) {
            $nodeAgent = is_array($node) ? (string) ($node['agentId'] ?? $node['agent'] ?? '') : '';
            if ($nodeAgent !== '' && KraAgentChat::isCreatorAgentId($nodeAgent)) { $hasCreatorNode = true; break; }
        }
        if ($hasCreatorNode) {
            requireCommercialFeature('creator_studio', 'Content Creator Studio');
            requireCommercialFeature('workflows_advanced', 'Workflow Creator lanjutan');
        }
        respond(KraWorkflowEngine::create($title, $nodes));
    }

    if ($action === 'workflow-plan') {
        requireWorkspaceAccess('viewer');
        $id = (string) ($_GET['id'] ?? '');
        respond(KraWorkflowEngine::plan($id));
    }

    if ($action === 'workflow-stage') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'workflow-stage requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        requireWorkspaceAccess('member');
        $id = (string) ($payload['id'] ?? '');
        $wave = (int) ($payload['wave'] ?? 0);
        $visibleWorkflows = KraWorkflowEngine::loadWorkflows();
        $workflow = $visibleWorkflows[$id] ?? null;
        if (is_array($workflow)) {
            $hasCreatorNode = false;
            foreach ((array) ($workflow['nodes'] ?? []) as $node) {
                $nodeAgent = is_array($node) ? (string) ($node['agentId'] ?? $node['agent'] ?? '') : '';
                if ($nodeAgent !== '' && KraAgentChat::isCreatorAgentId($nodeAgent)) { $hasCreatorNode = true; break; }
            }
            if ($hasCreatorNode) {
                requireCommercialFeature('creator_studio', 'Content Creator Studio');
                requireCommercialFeature('workflows_advanced', 'Workflow Creator lanjutan');
            }
        }
        respond(KraWorkflowEngine::stageWave($id, $wave));
    }

    if ($action === 'n100n-status') {
        if (($currentUser['id'] ?? '') !== 'n100n-bridge') { requireWorkspaceAccess('viewer'); requireCommercialFeature('n100n_workflows', 'Integrasi N100N'); }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'n100n-status requires GET.'], 405);
        }
        $status = KraN100nClient::status();
        $connected = (bool) ($status['ok'] ?? false);
        respond([
            'ok' => true,
            'connected' => $connected,
            'configured' => (bool) ($status['configured'] ?? false),
            'message' => $connected
                ? 'KRA can reach the N100N service.'
                : (string) ($status['error'] ?? 'N100N is not reachable from the KRA server.'),
            'n100n' => $status,
            'antrean' => KraFlowBridge::ringkasan(),
        ]);
    }

    if ($action === 'n100n-workflows') {
        if (($currentUser['id'] ?? '') !== 'n100n-bridge') { requireWorkspaceAccess('viewer'); requireCommercialFeature('n100n_workflows', 'Integrasi N100N'); }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'n100n-workflows requires GET.'], 405);
        }
        try {
            $response = KraN100nClient::workflows();
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'N100N workflow list failed: ' . $e->getMessage()], 502);
        }
        $workflows = $response['workflows'] ?? $response['data'] ?? $response;
        if (!is_array($workflows)) $workflows = [];
        $workflows = array_values(array_filter($workflows, 'is_array'));
        respond(['ok' => true, 'workflows' => $workflows]);
    }

    if ($action === 'n100n-run') {
        requireWorkspaceAccess('admin');
        requireCommercialFeature('creator_studio', 'Content Creator Studio');
        requireCommercialFeature('n100n_workflows', 'Integrasi N100N');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'n100n-run requires POST.'], 405);
        }
        $rawN100nBody = (string) file_get_contents('php://input');
        if (strlen($rawN100nBody) > 1024 * 1024) {
            respond(['ok' => false, 'error' => 'N100N workflow input exceeds the 1 MB request limit.'], 413);
        }
        $payload = json_decode($rawN100nBody, true);
        if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
            respond(['ok' => false, 'error' => 'N100N workflow input must be valid JSON.'], 400);
        }
        $workflowId = filter_var($payload['workflow_id'] ?? null, FILTER_VALIDATE_INT);
        if ($workflowId === false || $workflowId === null || $workflowId < 1) {
            respond(['ok' => false, 'error' => 'Choose a valid N100N workflow ID.'], 400);
        }
        if (!isset($payload['items']) || !is_array($payload['items']) || !array_is_list($payload['items'])) {
            respond(['ok' => false, 'error' => 'N100N workflow items must be a JSON array.'], 400);
        }
        try {
            $n100nLimit = KraEntitlements::limit('n100nRunsMonthly');
            KraEntitlements::assertUnderLimit('n100nRunsMonthly', KraDb::usageCount('n100n_run', $n100nLimit === null ? 10000 : $n100nLimit + 1), 'eksekusi N100N bulan ini');
        } catch (DomainException $e) {
            respond(['ok' => false, 'code' => 'quota_exceeded', 'error' => $e->getMessage(), 'entitlement' => KraTenantContext::entitlement(), 'catalog' => KraEntitlements::catalog()], 402);
        }
        try {
            $result = KraN100nClient::runAsync((int) $workflowId, $payload['items']);
            KraDb::recordUsage('n100n_run', 1, ['workflowId' => (int) $workflowId, 'workspaceId' => KraTenantContext::workspaceId()]);
        } catch (Throwable $e) {
            KraTelegramBridge::notify('⚠️ Gagal memulai workflow N100N #' . (int) $workflowId . ': ' . $e->getMessage());
            respond(['ok' => false, 'error' => 'N100N workflow start failed: ' . $e->getMessage()], 502);
        }
        $nestedResult = is_array($result['data'] ?? null) ? $result['data'] : [];
        $execution = $result['execution'] ?? $nestedResult['execution'] ?? null;
        $executionId = $result['execution_id'] ?? $result['executionId']
            ?? $nestedResult['execution_id'] ?? $nestedResult['executionId']
            ?? (is_array($execution) ? ($execution['id'] ?? '') : '');
        if (!is_scalar($executionId) || trim((string) $executionId) === '') {
            respond(['ok' => false, 'error' => 'N100N did not return an execution ID.'], 502);
        }
        respond([
            'ok' => true,
            'executionId' => (string) $executionId,
            'status' => 'running',
            'result' => $result,
        ]);
    }

    if ($action === 'n100n-execution') {
        if (($currentUser['id'] ?? '') !== 'n100n-bridge') { requireWorkspaceAccess('viewer'); requireCommercialFeature('n100n_workflows', 'Integrasi N100N'); }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'n100n-execution requires GET.'], 405);
        }
        $executionId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if ($executionId === false || $executionId === null || $executionId < 1) {
            respond(['ok' => false, 'error' => 'A valid N100N execution ID is required.'], 400);
        }
        try {
            respond(['ok' => true, 'execution' => KraN100nClient::execution((int) $executionId)]);
        } catch (Throwable $e) {
            respond(['ok' => false, 'error' => 'N100N execution lookup failed: ' . $e->getMessage()], 502);
        }
    }

    if ($action === 'vault-dashboard') {
        requireWorkspaceAccess('viewer');
        $vaultDir = KraVaultSync::getVaultDir();
        $dashFile = KraVaultSync::dashboardPath(false);
        $found = $dashFile !== '' && is_file($dashFile);
        $content = $found ? (string) file_get_contents($dashFile) : '';
        $milestoneCount = (int) preg_match_all('/^\d+\.\s+\*\*/m', $content);
        $reportCount = (int) preg_match_all('/^\|\s*2026-\d{2}-\d{2}\s*\|/m', $content);
        respond([
            'ok' => true,
            'vault' => (KraTenantContext::isPlatformAdmin() || KraTenantContext::isWorkspaceAdmin()) ? $vaultDir : '',
            'workspaceId' => KraTenantContext::workspaceId(),
            'connected' => $found,
            'milestones' => $milestoneCount,
            'reports' => $reportCount,
            'systemStatus' => $found ? 'Memory Connected: Dashboard KRA' : 'Vault Offline',
        ]);
    }

    if (in_array($action, ['workspace-files', 'workspace-read', 'task-preview'], true)) {
        requireWorkspaceAccess('viewer');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            respond(['ok' => false, 'error' => 'Workspace preview is read-only and accepts GET only.'], 405);
        }
        try {
            if ($action === 'workspace-files') {
                $root = (string) ($_GET['root'] ?? '');
                $path = (string) ($_GET['path'] ?? '');
                respond(['ok' => true] + KraWorkspaceBrowser::listDirectory($root, $path));
            }
            if ($action === 'workspace-read') {
                $root = (string) ($_GET['root'] ?? '');
                $path = (string) ($_GET['path'] ?? '');
                respond(['ok' => true] + KraWorkspaceBrowser::readFile($root, $path));
            }
            respond(KraWorkspaceBrowser::previewTask((string) ($_GET['taskId'] ?? '')));
        } catch (InvalidArgumentException $e) {
            respond(['ok' => false, 'error' => $e->getMessage()], 400);
        } catch (Throwable) {
            respond(['ok' => false, 'error' => 'Workspace preview could not be loaded.'], 500);
        }
    }

    if ($action === 'project-path') {
        requireWorkspaceAccess(in_array((string) ($_GET['mode'] ?? 'suggest'), ['browse', 'check'], true) ? 'admin' : 'member');
        $mode = (string) ($_GET['mode'] ?? 'suggest');
        if ($mode === 'browse') {
            $dir = (string) ($_GET['dir'] ?? KraProjectPath::workspaceProjectsRoot(KraTenantContext::workspaceId()));
            respond(['ok' => true] + KraProjectPath::browse($dir));
        }
        if ($mode === 'check') {
            respond(KraProjectPath::validateForWorkspace((string) ($_GET['path'] ?? ''), KraTenantContext::workspaceId()));
        }
        $name = (string) ($_GET['name'] ?? 'aplikasi-baru');
        $suggested = KraProjectPath::suggest($name, KraTenantContext::workspaceId());
        respond(['ok' => true, 'projectsRoot' => KraProjectPath::workspaceProjectsRoot(KraTenantContext::workspaceId()), 'suggested' => $suggested, 'workspaceId' => KraTenantContext::workspaceId()]
            + KraProjectPath::validateForWorkspace($suggested, KraTenantContext::workspaceId()));
    }

    if ($action === 'terminal-run') {
        requirePlatformAdmin($currentUser);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Terminal execution requires POST.'], 405);
        }
        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
            respond(['ok' => false, 'error' => 'Terminal execution is available only from the local machine.'], 403);
        }
        $raw = (string) file_get_contents('php://input');
        if (strlen($raw) > 8192) respond(['ok' => false, 'error' => 'Command request is too large.'], 413);
        $payload = json_decode($raw, true) ?: [];
        $command = (string) ($payload['command'] ?? '');
        respond(KraTerminalBridge::run($command, $projectRoot));
    }

    if ($action === 'propose') {
        $workspace = requireWorkspaceAccess('member');
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true) ?: $_POST;
        $agent = $payload['agentId'] ?? $_GET['agentId'] ?? 'creator';
        $type = $payload['actionType'] ?? $_GET['actionType'] ?? 'create';
        $title = $payload['title'] ?? $_GET['title'] ?? 'Proposed change';
        $target = $payload['targetFile'] ?? $_GET['targetFile'] ?? 'scratch.txt';
        $content = $payload['proposedContent'] ?? $_GET['proposedContent'] ?? '';
        $summary = $payload['summary'] ?? $_GET['summary'] ?? 'Pending approval';
        $taskProjectRoot = isset($payload['projectRoot']) ? trim((string) $payload['projectRoot']) : '';
        if ($taskProjectRoot !== '') {
            $pathCheck = KraProjectPath::validateForWorkspace($taskProjectRoot, (string) $workspace['id']);
            if (!($pathCheck['ok'] ?? false)) {
                respond([
                    'ok' => false,
                    'error' => 'Project path rejected: ' . implode(' ', $pathCheck['reasons']),
                    'projectPath' => $pathCheck,
                ], 400);
            }
            $taskProjectRoot = $pathCheck['path'];
        } else {
            $taskProjectRoot = null;
        }

        $creatorBuiltins = ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer'];
        $creatorHire = false;
        if (!in_array((string) $agent, $creatorBuiltins, true)) {
            foreach (KraDb::getHiredAgents() as $hiredAgent) {
                if (($hiredAgent['id'] ?? '') === $agent && strtolower((string) ($hiredAgent['workspace']['mode'] ?? '')) === 'creator') {
                    $creatorHire = true;
                    break;
                }
            }
        }
        $scope = in_array((string) $agent, $creatorBuiltins, true) || $creatorHire ? 'creator' : 'office';
        if ($scope === 'creator') requireCommercialFeature('creator_studio', 'Content Creator Studio');
        $projectId = trim((string) ($payload['projectId'] ?? ''));
        $registeredProject = null;
        if ($projectId !== '') {
            $registeredProject = KraWorkspaces::projectById($workspace, $projectId);
            if ($registeredProject === null) respond(['ok' => false, 'error' => 'Proyek tidak terdaftar pada workspace aktif.'], 403);
            if ($taskProjectRoot === null || $taskProjectRoot === '') $taskProjectRoot = (string) $registeredProject['rootPath'];
        } elseif ($taskProjectRoot !== null && $taskProjectRoot !== '') {
            $registeredProject = KraWorkspaces::projectByRoot($workspace, $taskProjectRoot);
            if ($registeredProject === null) {
                if (KraTenantContext::isWorkspaceAdmin()) {
                    try {
                        $registeredProject = KraWorkspaces::registerProject($workspace, basename(str_replace('\\', '/', rtrim($taskProjectRoot, '\\/'))), $taskProjectRoot, false);
                    } catch (DomainException $e) {
                        $isQuota = str_starts_with($e->getMessage(), 'Batas ');
                        respond([
                            'ok' => false,
                            'code' => $isQuota ? 'quota_exceeded' : 'project_not_registered',
                            'error' => $e->getMessage(),
                            'entitlement' => KraTenantContext::entitlement(),
                            'catalog' => KraEntitlements::catalog(),
                        ], $isQuota ? 402 : 400);
                    }
                } else {
                    $workspaceArea = KraProjectPath::workspaceProjectsRoot((string) $workspace['id'], !empty($workspace['legacyClaim']));
                    if (!str_starts_with(strtolower(str_replace('/', DIRECTORY_SEPARATOR, $taskProjectRoot)), strtolower(str_replace('/', DIRECTORY_SEPARATOR, rtrim($workspaceArea, DIRECTORY_SEPARATOR)) . DIRECTORY_SEPARATOR))) {
                        respond(['ok' => false, 'error' => 'Folder proyek harus didaftarkan oleh admin workspace terlebih dahulu.'], 403);
                    }
                }
            }
            $projectId = (string) ($registeredProject['id'] ?? '');
        }
        $task = KraTaskEngine::propose($agent, $type, $title, $target, $content, $summary, $taskProjectRoot, ['scope' => $scope, 'projectId' => $projectId]);
        respond(['ok' => true, 'task' => $task]);
    }

    if ($action === 'approve' || $action === 'reject') {
        requireWorkspaceAccess('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Approval decisions require POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $taskId = (string) ($payload['taskId'] ?? '');
        if ($taskId === '') {
            respond(['ok' => false, 'error' => 'Missing taskId parameter.'], 400);
        }
        $visibleTasks = KraTaskEngine::loadTasks();
        $visibleTask = $visibleTasks[$taskId] ?? null;
        if (!is_array($visibleTask)) {
            foreach ($visibleTasks as $candidateTask) {
                if ((string) ($candidateTask['id'] ?? '') === $taskId) { $visibleTask = $candidateTask; break; }
            }
        }
        if (!is_array($visibleTask)) respond(['ok' => false, 'error' => 'Task tidak ditemukan pada workspace aktif.'], 404);
        if (strtolower((string) ($visibleTask['scope'] ?? $visibleTask['context']['scope'] ?? '')) === 'creator') {
            requireCommercialFeature('creator_studio', 'Content Creator Studio');
        }
        if ($action === 'approve') {
            $approver = (string) ($currentUser['username'] ?? $currentUser['id'] ?? 'supervisor');
            $isStream = (($_GET['stream'] ?? '') === '1') || !empty($payload['stream']);
            if ($isStream) {
                @ini_set('zlib.output_compression', '0');
                if (function_exists('apache_setenv')) {
                    @apache_setenv('no-gzip', '1');
                }
                header('Content-Type: application/x-ndjson; charset=utf-8');
                header('Cache-Control: no-cache, no-transform');
                header('X-Accel-Buffering: no');
                header('Connection: keep-alive');
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
                ob_implicit_flush(true);

                $emit = static function (array $data): void {
                    echo json_encode($data, JSON_UNESCAPED_SLASHES) . "\n";
                    flush();
                };

                try {
                    $task = KraTaskEngine::approve($taskId, $approver, static function (array $event) use ($emit): void {
                        $emit($event);
                    });
                    $emit(['type' => 'done', 'ok' => true, 'task' => $task]);
                } catch (Throwable $e) {
                    $emit(['type' => 'error', 'ok' => false, 'error' => $e->getMessage()]);
                }
                exit;
            }
            $task = KraTaskEngine::approve($taskId, $approver);
        } else {
            $task = KraTaskEngine::reject($taskId, 'Rejected by user');
        }
        respond(['ok' => true, 'task' => $task]);
    }

    if ($action === 'undo') {
        requireWorkspaceAccess('admin');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Undo requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $taskId = (string) ($payload['taskId'] ?? '');
        if ($taskId === '') {
            respond(['ok' => false, 'error' => 'Missing taskId parameter.'], 400);
        }
        $visibleTasks = KraTaskEngine::loadTasks();
        $visibleTask = $visibleTasks[$taskId] ?? null;
        if (is_array($visibleTask) && strtolower((string) ($visibleTask['scope'] ?? $visibleTask['context']['scope'] ?? '')) === 'creator') {
            requireCommercialFeature('creator_studio', 'Content Creator Studio');
        }
        respond(['ok' => true, 'task' => KraTaskEngine::undo($taskId)]);
    }

    if ($action === 'providers') {
        requireWorkspaceAccess('viewer');
        respond(['ok' => true, 'config' => ProviderConfig::publicSummary()]);
    }

    if ($action === 'templates') {
        requireWorkspaceAccess('viewer');
        respond([
            'ok' => true,
            'count' => count(KraTemplateRegistry::listTemplates()),
            'templates' => KraTemplateRegistry::listTemplates(),
        ]);
    }

    if ($action === 'skills') {
        requireWorkspaceAccess('viewer');
        $catalog = KraSkillEngine::catalog();
        $agentId = strtolower(trim((string) ($_GET['agentId'] ?? '')));
        $query = (string) ($_GET['q'] ?? '');
        $pending = [];
        foreach ($catalog as $id => $skill) {
            if (($skill['approved'] ?? false) !== true) {
                $pending[] = $id;
            }
        }
        respond([
            'ok' => true,
            'count' => count($catalog),
            'approved' => count($catalog) - count($pending),
            'pending' => $pending,
            'skills' => $catalog,
            'active' => $agentId !== '' ? KraSkillEngine::activeFor($agentId, $query) : [],
            'mode' => KraSkillEngine::mode($query),
        ]);
    }

    if ($action === 'skill-read') {
        requireWorkspaceAccess('viewer');
        $id = (string) ($_GET['id'] ?? '');
        if (str_starts_with($id, 'creator-') && !KraSkillEngine::planAllowsSkill($id)) {
            requireCommercialFeature('creator_all_skills', 'Skill Creator lanjutan');
        }
        $content = KraSkillEngine::read($id);
        if ($content === null) {
            respond(['ok' => false, 'error' => 'Unknown or unsafe skill id.'], 404);
        }
        respond(['ok' => true, 'id' => $id, 'content' => $content]);
    }

    if ($action === 'skill-hub') {
        requireWorkspaceAccess('viewer');
        respond([
            'ok' => true,
            'hub' => KraSkillEngine::hubState(),
        ]);
    }

    if ($action === 'skill-toggle') {
        requireWorkspaceAccess('viewer');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'Skill toggle requires POST.'], 405);
        }
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        $catalog = KraSkillEngine::catalog();
        if (($payload['approved'] ?? false) === true) {
            requireWorkspaceAccess('admin');
            $toggleSkillId = trim((string) ($payload['skillId'] ?? ''));
            if (str_starts_with($toggleSkillId, 'creator-') && !KraSkillEngine::planAllowsSkill($toggleSkillId)) {
                requireCommercialFeature('creator_all_skills', 'Skill Creator lanjutan');
            }
            $applied = KraSkillHub::apply($payload, $catalog);
            if (!($applied['ok'] ?? false)) {
                respond($applied, 400);
            }
            respond($applied);
        }
        $preview = KraSkillHub::preview($payload, $catalog);
        if (!($preview['ok'] ?? false)) {
            respond($preview, 400);
        }
        respond($preview);
    }

    if ($action === 'audit') {
        requirePlatformAdmin($currentUser);
        $target = $_GET['target'] ?? $projectRoot;
        $real = realpath($target);
        $rootPrefix = rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        $insideRoot = $real !== false && (
            strtolower($real) === strtolower($projectRoot)
            || str_starts_with(strtolower(rtrim($real, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR), strtolower($rootPrefix))
        );
        if (!$insideRoot) {
            respond([
                'ok' => false,
                'error' => 'Target path must be inside project root: ' . $projectRoot,
            ], 400);
        }
        respond([
            'ok' => true,
            'audit' => KraAudit::run($real),
        ]);
    }

    // ---------------- integrasi n100n (antrean tugas, generik) ----------------
    if ($action === 'flow-kategori') {
        respond([
            'ok' => true,
            'kategori' => KraFlowBridge::kategori(),
            'diambil' => gmdate('c'),
        ]);
    }

    if ($action === 'flow-tugas') {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // body dibaca lebih dulu walau nanti ditolak: menjaga koneksi keep-alive
            $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
            if (KraTenantContext::hasWorkspace()) {
                $flowFeatures = (array) ((KraTenantContext::entitlement() ?? [])['features'] ?? []);
                if (!in_array('n100n_workflows', $flowFeatures, true)) {
                    respond(['ok' => false, 'code' => 'subscription_required', 'error' => 'Workspace tujuan belum memiliki fitur N100N (PLUS/PLATINUM atau admin SIAS).'], 402);
                }
                $flowAgent = (string) (($payload['agen'] ?? $payload['agentId'] ?? $payload['agent'] ?? ''));
                if ($flowAgent !== '' && KraAgentChat::isCreatorAgentId($flowAgent) && !in_array('creator_studio', $flowFeatures, true)) {
                    respond(['ok' => false, 'code' => 'subscription_required', 'error' => 'Workspace tujuan belum memiliki akses Creator Studio.'], 402);
                }
            }
            $hasil = KraFlowBridge::terimaTugas(is_array($payload) ? $payload : []);
            respond($hasil, ($hasil['ok'] ?? false) ? 202 : 400);
        }
        $status = isset($_GET['status']) ? (string) $_GET['status'] : null;
        $agen = isset($_GET['agen']) ? (string) $_GET['agen'] : null;
        $limit = (int) ($_GET['limit'] ?? 50);
        $items = KraFlowBridge::daftarTugas($status, $limit, $agen);
        respond([
            'ok' => true,
            'items' => $items,
            'jumlah' => count($items),
            'ringkasan' => KraFlowBridge::ringkasan(),
        ]);
    }

    if ($action === 'flow-selesai') {
        $payload = json_decode((string) file_get_contents('php://input'), true) ?: $_POST;
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respond(['ok' => false, 'error' => 'flow-selesai requires POST.'], 405);
        }
        $hasil = KraFlowBridge::selesaikan(
            (string) ($payload['task_id'] ?? $_GET['task_id'] ?? ''),
            (string) ($payload['hasil'] ?? ''),
            ['mode' => (string) ($payload['mode'] ?? 'manual')]
        );
        respond($hasil, ($hasil['ok'] ?? false) ? 200 : 400);
    }

    if ($action === 'flow-status') {
        respond(['ok' => true, 'ringkasan' => KraFlowBridge::ringkasan()]);
    }

    $available = 'status, agents, save-agent, hired-agents, log-chat, chat-history, chat-agent, tasks, propose,'
        . 'model-propose, router-health, router-models, approve, reject, undo, presence, meeting-record,'
        . 'skills, skill-read, skill-hub, skill-toggle, providers, audit, templates, workflow-list,'
        . 'workflow-create, workflow-plan, workflow-stage, n100n-status, n100n-workflows, n100n-run,'
        . 'n100n-execution, n100n-config, github-changer-status, github-changer-repos, github-changer-activity, github-changer-sync, github-changer-config, github-changer-event, rna-router-status, rna-router-models, rna-router-chat, rna-router-config, rna-router-event, youtube-config, youtube-status, youtube-oauth-start, youtube-oauth-callback, youtube-disconnect, youtube-upload, youtube-analytics, telegram-config, telegram-pairing, telegram-test, telegram-set-webhook, telegram-disconnect, telegram-webhook, vault-settings, vault-browse, vault-select, vault-sync, vault-recall,'
        . 'flow-kategori, flow-tugas, flow-selesai, flow-status, subscription-catalog, subscription-status, subscription-checkout-request, subscription-start-trial, subscription-cancel, subscription-orders, subscription-admin-list, subscription-admin-upsert, subscription-admin-order-paid, billing-webhook, license-status, license-import, workspaces, workspace-update, workspace-members, projects, project-default, provider-settings, memory-compile, memory-notes, setup-status, api-keys, api-key-status, logout.';
    respond([
        'ok' => false,
        'error' => 'Unknown action: ' . $action . '. Available: ' . $available,
    ], 404);
} catch (Throwable $e) {
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
