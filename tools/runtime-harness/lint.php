<?php
/* Real-parser lint for every PHP file under api/ plus the commercial CLI/test. */
$base = '__KRA_ROOT__';
if (str_starts_with($base, '__')) $base = dirname(__DIR__, 2);
$root = $base . DIRECTORY_SEPARATOR . 'api';
$rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
$bad = 0; $n = 0;
$lintFile = static function (string $pathname) use (&$bad, &$n): void {
    $n++;
    try {
        token_get_all((string) file_get_contents($pathname), TOKEN_PARSE);
    } catch (ParseError $e) {
        $bad++;
        echo 'PARSE-FAIL ' . $pathname . ' — ' . $e->getMessage() . "\n";
    }
};
foreach ($rii as $file) {
    if ($file->isDir() || !str_ends_with($file->getFilename(), '.php')) continue;
    $lintFile($file->getPathname());
}
foreach ([
    $base . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . 'license-issue.php',
    $base . DIRECTORY_SEPARATOR . 'tools' . DIRECTORY_SEPARATOR . 'runtime-harness' . DIRECTORY_SEPARATOR . 'test-commercial.php',
] as $extra) {
    if (is_file($extra)) $lintFile($extra);
}
echo "lint: $n file diperiksa, $bad gagal\n";
