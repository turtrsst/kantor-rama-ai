<?php
declare(strict_types=1);

/**
 * Self-contained verification for KraProjectPath.
 * Usage: php tools/test-project-path.php
 */

if (!defined('STDOUT')) {
    define('STDOUT', fopen('php://output', 'wb'));
}

require_once __DIR__ . '/../api/lib/KraProjectPath.php';

function check(string $name, bool $pass, string $detail = ''): void
{
    $label = $pass ? '[PASS]' : '[FAIL]';
    fwrite(STDOUT, "{$label} {$name}" . ($detail !== '' ? " ({$detail})" : '') . "\n");
    if (!$pass) {
        exit(1);
    }
}

fwrite(STDOUT, "KRA PROJECT PATH GATE TEST\n");
fwrite(STDOUT, str_repeat('=', 50) . "\n");

$kra = KraProjectPath::kraRoot();
fwrite(STDOUT, "Detected KRA root: {$kra}\n");
$defaultParent = KraProjectPath::projectsRoot();
fwrite(STDOUT, "Default projects root: {$defaultParent}\n\n");

// 1. Empty rejected
$r = KraProjectPath::validate('');
check('Empty path rejected', !$r['ok']);

// 2. Relative rejected
$r = KraProjectPath::validate('my-app/sub');
check('Relative path rejected', !$r['ok']);

// 3. Path traversal rejected
$r = KraProjectPath::validate($defaultParent . '/../escaped');
check('Traversal with ".." rejected', !$r['ok']);

// 4. Drive root rejected
$r = KraProjectPath::validate('C:');
check('Drive root rejected', !$r['ok']);

// 5. System directory rejected
$r = KraProjectPath::validate('C:\Windows');
check('Windows system dir rejected', !$r['ok']);

// 6. HARD RULE: Target inside KRA must be rejected
$insideDirect = $kra . DIRECTORY_SEPARATOR . 'my-new-app';
$r = KraProjectPath::validate($insideDirect);
check('Direct child of KRA rejected', !$r['ok'] && $r['insideKra']);

$insideSub = $kra . DIRECTORY_SEPARATOR . 'web' . DIRECTORY_SEPARATOR . 'apps';
$r = KraProjectPath::validate($insideSub);
check('Subdirectory of KRA rejected', !$r['ok'] && $r['insideKra']);

// 7. Outside KRA accepted
$outside = $defaultParent . DIRECTORY_SEPARATOR . 'aplikasi-keuangan-test';
$r = KraProjectPath::validate($outside);
check('Sibling of KRA accepted', $r['ok'] && !$r['insideKra'], $outside);

// 8. Slug generator
$slug = KraProjectPath::slug('Aplikasi Keuangan Cashflow 2026!');
check('Slug generation', $slug === 'aplikasi-keuangan-cashflow-2026', $slug);

// 9. Browse returns valid structure
$browse = KraProjectPath::browse($defaultParent);
check('Browse returns directory', is_dir($browse['dir']));
check('Browse lists directories', is_array($browse['dirs']));

fwrite(STDOUT, "\nAll Project Path Gate checks passed.\n");
