<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraRnaRouterClient.php';

function rnaClientCheck(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$label}\n");
}

// Isolasi: direktori privat di luar project root + environment bersih.
$privateDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kra-rna-test-' . bin2hex(random_bytes(8));
if (!mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    fwrite(STDERR, "Cannot create isolated private settings directory.\n");
    exit(1);
}
$envNames = [
    'KRA_PRIVATE_CONFIG_DIR', 'KRA_RNA_ROUTER_URL', 'KRA_RNA_ROUTER_API_KEY',
    'KRA_RNA_ROUTER_MODEL', 'KRA_RNA_ROUTER_EVENT_SECRET',
];
$original = [];
foreach ($envNames as $name) {
    $value = getenv($name);
    $original[$name] = $value === false ? null : $value;
    putenv($name);
}
putenv('KRA_PRIVATE_CONFIG_DIR=' . $privateDir);

try {
    rnaClientCheck(KraRnaRouterClient::baseUrl() === 'http://127.0.0.1:3000', 'RNA Router client uses a local-only default URL.');
    rnaClientCheck(KraRnaRouterClient::model() === 'muse-spark-1.2-free', 'Default gateway model is the free Muse Spark model.');
    rnaClientCheck(KraRnaRouterClient::token() === '', 'No service key is configured by default (x-api-key is optional).');
    rnaClientCheck(KraRnaRouterClient::publicBaseUrl() === 'http://127.0.0.1:3000', 'Browser-facing URL exposes only scheme, host, port, and path.');

    $clientSource = (string) file_get_contents(__DIR__ . '/../api/lib/KraRnaRouterClient.php');
    rnaClientCheck(str_contains($clientSource, "strtoupper(\$method) === 'GET' ? 1 : 0"), 'Only idempotent GET requests receive automatic retries.');
    rnaClientCheck(str_contains($clientSource, 'CURLOPT_FOLLOWLOCATION => false') && str_contains($clientSource, 'CURLOPT_SSL_VERIFYPEER => true'), 'Gateway requests prohibit redirects and verify TLS.');
    rnaClientCheck(str_contains($clientSource, 'private static function sanitize'), 'Responses are redacted before reaching the browser.');

    // Port 1 menolak koneksi seketika: status() harus menurun tanpa exception.
    putenv('KRA_RNA_ROUTER_URL=http://127.0.0.1:1');
    $status = KraRnaRouterClient::status();
    rnaClientCheck($status['ok'] === false && $status['healthy'] === false && isset($status['error']), 'status() degrades gracefully when the gateway is offline.');

    putenv('KRA_RNA_ROUTER_URL=https://url-user:url-pass@example.test/service?token=hidden');
    rnaClientCheck(KraIntegrationSettings::publicRnaRouterBaseUrl() === 'https://example.test/service', 'Browser-facing status strips embedded credentials and query strings.');
    try {
        KraRnaRouterClient::models();
        rnaClientCheck(false, 'HTTP requests reject unsafe credential-bearing service URLs.');
    } catch (RuntimeException $error) {
        rnaClientCheck(str_contains($error->getMessage(), 'valid HTTP or HTTPS'), 'HTTP requests reject unsafe credential-bearing service URLs.');
    }
    putenv('KRA_RNA_ROUTER_URL');
    putenv('KRA_RNA_ROUTER_API_KEY');
    putenv('KRA_RNA_ROUTER_MODEL');

    try {
        KraIntegrationSettings::saveRnaRouter('ftp://example.test/', null, '', false);
        rnaClientCheck(false, 'saveRnaRouter() rejects non-HTTP schemes.');
    } catch (InvalidArgumentException $error) {
        rnaClientCheck(str_contains($error->getMessage(), 'http:// or https://'), 'saveRnaRouter() rejects non-HTTP schemes.');
    }
    try {
        KraRnaRouterClient::chat('', '');
        rnaClientCheck(false, 'chat() rejects an empty test message before any HTTP call.');
    } catch (InvalidArgumentException $error) {
        rnaClientCheck(str_contains($error->getMessage(), 'Pesan uji'), 'chat() rejects an empty test message before any HTTP call.');
    }
    try {
        KraRnaRouterClient::chat('halo', 'bad model;rm -rf');
        rnaClientCheck(false, 'chat() rejects an unsafe model name.');
    } catch (InvalidArgumentException $error) {
        rnaClientCheck(str_contains($error->getMessage(), 'Model RNA Router'), 'chat() rejects an unsafe model name.');
    }

    KraIntegrationSettings::saveRnaRouter('http://127.0.0.1:3000/', 'saved-rna-key', 'deepseek-chat', false);
    rnaClientCheck(KraRnaRouterClient::token() === 'saved-rna-key' && KraRnaRouterClient::model() === 'deepseek-chat', 'Saved URL/key/model are usable server-side.');
    KraIntegrationSettings::saveRnaRouter('http://127.0.0.1:3000/', null, '', true);
    rnaClientCheck(KraRnaRouterClient::token() === '', 'Clearing the saved key returns the gateway to anonymous mode.');

    putenv('KRA_RNA_ROUTER_EVENT_SECRET=event-secret-synthetic');
    rnaClientCheck(KraIntegrationSettings::rnaRouterEventSecret() === 'event-secret-synthetic', 'Event secret is read from the PHP environment only.');
    KraIntegrationSettings::saveRnaRouterEvent([
        'at' => gmdate(DATE_ATOM),
        'source' => 'rna-router',
        'trigger' => 'schedule',
        'gateway' => 'http://127.0.0.1:3000',
        'healthy' => true,
        'version' => '1.0.0',
        'modelCount' => 5,
        'fallbackActive' => true,
        'features' => ['auto-fallback'],
        'models' => [['id' => 'muse-spark-1.2-free', 'provider' => 'muse']],
        'error' => '',
        'apiKey' => 'must-not-be-stored',
    ]);
    $event = KraIntegrationSettings::rnaRouterEvent();
    rnaClientCheck(($event['healthy'] ?? false) === true && ($event['modelCount'] ?? 0) === 5, 'Last automation event is persisted for the KRA panel.');
    rnaClientCheck(!array_key_exists('apiKey', $event) && array_key_exists('error', $event), 'Event storage whitelists fields and drops unexpected secrets.');
} finally {
    foreach ($original as $name => $value) {
        if ($value === null) putenv($name);
        else putenv($name . '=' . $value);
    }
    $settingsFile = $privateDir . DIRECTORY_SEPARATOR . 'integrations.json';
    if (is_file($settingsFile)) unlink($settingsFile);
    @rmdir($privateDir);
}

fwrite(STDOUT, "RNA Router client/config tests passed.\n");
