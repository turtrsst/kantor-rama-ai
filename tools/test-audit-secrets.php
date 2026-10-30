<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraAudit.php';

$root = rtrim(sys_get_temp_dir(), "\\/") . DIRECTORY_SEPARATOR . 'kra-audit-secrets-' . bin2hex(random_bytes(5));
if (!mkdir($root, 0700, true) && !is_dir($root)) throw new RuntimeException('Could not create audit test directory.');
try {
    file_put_contents($root . DIRECTORY_SEPARATOR . 'README.md', "Synthetic scanner test fixture.\n");
    file_put_contents($root . DIRECTORY_SEPARATOR . '.gitignore', "\n");
    $fixture = <<<'PHP'
<?php
$apiKey = getenv('KRA_API_KEY');
$runtimeToken = bin2hex(random_bytes(32));
$placeholder = 'CAVE_API_KEY';
$testValue = 'do-not-show';
$fixtureOnly = FIXTURE_TOKEN;
$api_key = PLACEHOLDER_VALUE;
token: UNQUOTED_PLACEHOLDER
PHP;
    $syntheticQuotedToken = 'ghp_' . str_repeat('1', 32);
    $syntheticUnquotedToken = implode('', range('a', 'z')) . '012345';
    $fixture = str_replace(
        ['FIXTURE_TOKEN', 'UNQUOTED_PLACEHOLDER'],
        ["'{$syntheticQuotedToken}'", $syntheticUnquotedToken],
        $fixture
    );
    file_put_contents($root . DIRECTORY_SEPARATOR . 'fixture.php', $fixture);

    $result = KraAudit::run($root);
    if (($result['summary']['possibleSecrets'] ?? -1) !== 2) {
        throw new RuntimeException('Audit should ignore placeholders/generated tokens and catch quoted and unquoted synthetic credential fixtures.');
    }
    fwrite(STDOUT, "AUDIT SECRET DETECTION TEST PASSED\n");
} finally {
    foreach (glob($root . DIRECTORY_SEPARATOR . '*') ?: [] as $file) @unlink($file);
    foreach (glob($root . DIRECTORY_SEPARATOR . '.*') ?: [] as $file) if (is_file($file)) @unlink($file);
    @rmdir($root);
}
