<?php
/* Real-parser lint for every PHP file under api/ via token_get_all(TOKEN_PARSE). */
$root = '/home/user/kantor-rama-ai/api';
$rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
$bad = 0; $n = 0;
foreach ($rii as $file) {
    if ($file->isDir() || !str_ends_with($file->getFilename(), '.php')) continue;
    $n++;
    try {
        token_get_all((string) file_get_contents($file->getPathname()), TOKEN_PARSE);
    } catch (ParseError $e) {
        $bad++;
        echo 'PARSE-FAIL ' . $file->getPathname() . ' — ' . $e->getMessage() . "\n";
    }
}
echo "lint: $n file diperiksa, $bad gagal\n";
