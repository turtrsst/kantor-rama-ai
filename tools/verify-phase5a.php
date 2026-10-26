<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/ProviderConfig.php';
require_once __DIR__ . '/../api/lib/KraRouterGateway.php';

function check5a(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "[FAIL] {$msg}\n");
        exit(1);
    }
    echo "[PASS] {$msg}\n";
}

$config = ProviderConfig::load();
check5a(isset($config['providers']['9router']), '9Router is registered in ProviderConfig.');
$r = $config['providers']['9router'];
check5a($r['baseUrl'] === 'http://127.0.0.1:20128/v1', '9Router baseUrl points to localhost port 20128.');
check5a($r['apiKeyEnv'] === 'ROUTER_9ROUTER_API_KEY', '9Router apiKeyEnv is ROUTER_9ROUTER_API_KEY.');

// Test simulator gateway path
$simHealth = KraRouterGateway::health('simulator');
check5a($simHealth['online'] === true, 'Simulator gateway health is online.');

$simModels = KraRouterGateway::models('simulator');
check5a(!empty($simModels['models']), 'Simulator gateway returns model catalog.');

$simComplete = KraRouterGateway::complete([
    'provider' => 'simulator',
    'prompt' => 'Test 5A connection',
]);
check5a($simComplete['content'] === 'SIMULATOR_OK', 'Simulator gateway completes prompt.');

// Test live HTTP endpoints
$base = rtrim((string) (getenv('KRA_API_BASE') ?: 'http://100.76.172.67:8088/api/index.php'), '/');
$healthRaw = file_get_contents($base . '?action=router-health');
$health = json_decode((string) $healthRaw, true);
check5a(is_array($health) && $health['ok'] === true, 'HTTP action=router-health returns ok=true.');

$modelsRaw = file_get_contents($base . '?action=router-models');
$models = json_decode((string) $modelsRaw, true);
check5a(is_array($models) && $models['ok'] === true, 'HTTP action=router-models returns ok=true.');

// Test model-propose with fallback capability
$ctx = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode(['provider' => '9router', 'prompt' => 'Phase 5A probe']),
        'timeout' => 10,
        'ignore_errors' => true,
    ],
]);
$proposeRaw = file_get_contents($base . '?action=model-propose', false, $ctx);
$propose = json_decode((string) $proposeRaw, true);
check5a(is_array($propose) && $propose['ok'] === true, 'HTTP action=model-propose handles 9Router with fallback.');

echo "PHASE 5A VERIFICATION PASSED\n";
