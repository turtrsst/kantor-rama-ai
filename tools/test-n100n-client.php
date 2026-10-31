<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraN100nClient.php';

function n100nClientCheck(bool $condition, string $label): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$label}\n");
        exit(1);
    }
    fwrite(STDOUT, "[PASS] {$label}\n");
}

$names = ['KRA_N100N_BASE_URL', 'KRA_N100N_URL', 'KRA_N100N_API_KEY', 'KRA_N100N_TOKEN'];
$original = [];
foreach ($names as $name) {
    $value = getenv($name);
    $original[$name] = $value === false ? null : $value;
    putenv($name);
}

try {
    n100nClientCheck(KraN100nClient::baseUrl() === 'http://127.0.0.1:5679', 'N100N client uses a local-only default URL.');
    n100nClientCheck(KraN100nClient::token() === '' && !KraN100nClient::isConfigured(), 'N100N is unconfigured without a server-side REST key.');
    $clientSource = (string) file_get_contents(__DIR__ . '/../api/lib/KraN100nClient.php');
    n100nClientCheck(str_contains($clientSource, "strtoupper(\$method) === 'GET' ? 1 : 0"), 'Only idempotent GET requests receive automatic retries.');
    n100nClientCheck(str_contains($clientSource, 'CURLOPT_FOLLOWLOCATION => false') && str_contains($clientSource, 'CURLOPT_SSL_VERIFYPEER => true') && str_contains($clientSource, 'CURLOPT_SSL_VERIFYHOST => 2'), 'N100N requests prohibit redirects and verify TLS certificates.');

    putenv('KRA_N100N_URL=https://legacy.example.test/');
    putenv('KRA_N100N_TOKEN=synthetic-legacy-key');
    n100nClientCheck(KraN100nClient::baseUrl() === 'https://legacy.example.test', 'Legacy N100N URL setting remains supported and normalized.');
    n100nClientCheck(KraN100nClient::token() === 'synthetic-legacy-key', 'Legacy N100N token setting remains supported.');

    putenv('KRA_N100N_BASE_URL=https://current.example.test/');
    putenv('KRA_N100N_API_KEY=synthetic-current-key');
    n100nClientCheck(KraN100nClient::baseUrl() === 'https://current.example.test', 'Documented N100N base URL takes precedence over the legacy alias.');
    n100nClientCheck(KraN100nClient::token() === 'synthetic-current-key' && KraN100nClient::isConfigured(), 'Documented server-side API key takes precedence over the legacy alias.');

    putenv('KRA_N100N_BASE_URL=https://url-user:url-pass@example.test/service?token=hidden');
    n100nClientCheck(KraIntegrationSettings::publicN100nBaseUrl() === 'https://example.test/service', 'Browser-facing N100N status strips embedded credentials and query strings.');
    try {
        KraN100nClient::health();
        n100nClientCheck(false, 'N100N HTTP requests reject unsafe credential-bearing service URLs.');
    } catch (RuntimeException $error) {
        n100nClientCheck(str_contains($error->getMessage(), 'valid HTTP or HTTPS'), 'N100N HTTP requests reject unsafe credential-bearing service URLs.');
    }
} finally {
    foreach ($original as $name => $value) {
        if ($value === null) putenv($name);
        else putenv($name . '=' . $value);
    }
}

echo "N100N CLIENT CONFIG TEST PASSED\n";
