<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraGitHubChangerClient.php';

function ghcClientCheck(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$label}\n");
}

// Isolasi penuh: direktori privat di luar project root + environment bersih.
$privateDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kra-ghc-test-' . bin2hex(random_bytes(8));
if (!mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    fwrite(STDERR, "Cannot create isolated private settings directory.\n");
    exit(1);
}
$envNames = [
    'KRA_PRIVATE_CONFIG_DIR', 'KRA_GITHUB_CHANGER_URL', 'KRA_GITHUB_CHANGER_BASE_URL',
    'KRA_GITHUB_CHANGER_API_KEY', 'KRA_GITHUB_CHANGER_EVENT_SECRET',
];
$original = [];
foreach ($envNames as $name) {
    $value = getenv($name);
    $original[$name] = $value === false ? null : $value;
    putenv($name);
}
putenv('KRA_PRIVATE_CONFIG_DIR=' . $privateDir);

try {
    ghcClientCheck(KraGitHubChangerClient::baseUrl() === 'http://127.0.0.1:4173', 'GitHub Changer client uses a local-only default URL.');
    ghcClientCheck(KraGitHubChangerClient::token() === '' && !KraGitHubChangerClient::isConfigured(), 'Bridge is unconfigured without a server-side service key.');
    $status = KraGitHubChangerClient::status();
    ghcClientCheck($status['configured'] === false && $status['ok'] === false && isset($status['error']), 'status() degrades gracefully without a key and never throws.');
    ghcClientCheck(KraGitHubChangerClient::publicBaseUrl() === 'http://127.0.0.1:4173', 'Browser-facing URL exposes only scheme, host, port, and path.');

    $clientSource = (string) file_get_contents(__DIR__ . '/../api/lib/KraGitHubChangerClient.php');
    ghcClientCheck(str_contains($clientSource, "strtoupper(\$method) === 'GET' ? 1 : 0"), 'Only idempotent GET requests receive automatic retries.');
    ghcClientCheck(str_contains($clientSource, 'CURLOPT_FOLLOWLOCATION => false') && str_contains($clientSource, 'CURLOPT_SSL_VERIFYPEER => true'), 'Bridge requests prohibit redirects and verify TLS.');

    putenv('KRA_GITHUB_CHANGER_URL=https://ghc.example.test:4173/');
    putenv('KRA_GITHUB_CHANGER_API_KEY=synthetic-bridge-key');
    ghcClientCheck(KraGitHubChangerClient::baseUrl() === 'https://ghc.example.test:4173', 'Environment URL wins and is normalized.');
    ghcClientCheck(KraIntegrationSettings::publicGitHubChangerBaseUrl() === 'https://ghc.example.test:4173', 'Public URL keeps the explicit port.');
    ghcClientCheck(KraGitHubChangerClient::token() === 'synthetic-bridge-key' && KraGitHubChangerClient::isConfigured(), 'Environment service key is used server-side.');

    putenv('KRA_GITHUB_CHANGER_URL=https://url-user:url-pass@example.test/service?token=hidden');
    ghcClientCheck(KraIntegrationSettings::publicGitHubChangerBaseUrl() === 'https://example.test/service', 'Browser-facing status strips embedded credentials and query strings.');
    try {
        KraGitHubChangerClient::repos();
        ghcClientCheck(false, 'HTTP requests reject unsafe credential-bearing service URLs.');
    } catch (RuntimeException $error) {
        ghcClientCheck(str_contains($error->getMessage(), 'valid HTTP or HTTPS'), 'HTTP requests reject unsafe credential-bearing service URLs.');
    }
    putenv('KRA_GITHUB_CHANGER_URL');
    putenv('KRA_GITHUB_CHANGER_API_KEY');

    try {
        KraIntegrationSettings::saveGitHubChanger('ftp://example.test/', null, false);
        ghcClientCheck(false, 'saveGitHubChanger() rejects non-HTTP schemes.');
    } catch (InvalidArgumentException $error) {
        ghcClientCheck(str_contains($error->getMessage(), 'http:// or https://'), 'saveGitHubChanger() rejects non-HTTP schemes.');
    }
    KraIntegrationSettings::saveGitHubChanger('https://ghc.example.test/', 'saved-key', false);
    ghcClientCheck(KraGitHubChangerClient::token() === 'saved-key', 'Settings saved privately on the KRA server are usable.');
    KraIntegrationSettings::saveGitHubChanger('https://ghc.example.test/', null, true);
    ghcClientCheck(!KraGitHubChangerClient::isConfigured(), 'Clearing the saved key disables the bridge.');

    putenv('KRA_GITHUB_CHANGER_EVENT_SECRET=event-secret-synthetic');
    ghcClientCheck(KraIntegrationSettings::githubChangerEventSecret() === 'event-secret-synthetic', 'Event secret is read from the server environment only.');
    KraIntegrationSettings::saveGitHubChangerEvent([
        'at' => gmdate(DATE_ATOM),
        'trigger' => 'webhook',
        'action' => 'pull',
        'ok' => 2,
        'failed' => 0,
        'skipped' => 1,
        'repos' => [['name' => 'kantor-rama-ai', 'result' => 'ok', 'reason' => '']],
        'webhookSecret' => 'must-not-be-stored',
    ]);
    $event = KraIntegrationSettings::githubChangerEvent();
    ghcClientCheck(($event['trigger'] ?? '') === 'webhook' && ($event['ok'] ?? 0) === 2, 'Last automation event is persisted for the KRA panel.');
    ghcClientCheck(!array_key_exists('webhookSecret', $event), 'Event storage whitelists fields and drops unexpected secrets.');
} finally {
    foreach ($original as $name => $value) {
        if ($value === null) putenv($name);
        else putenv($name . '=' . $value);
    }
    $settingsFile = $privateDir . DIRECTORY_SEPARATOR . 'integrations.json';
    if (is_file($settingsFile)) unlink($settingsFile);
    @rmdir($privateDir);
}

fwrite(STDOUT, "GitHub Changer client/config tests passed.\n");
