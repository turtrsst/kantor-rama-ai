<?php
declare(strict_types=1);

if (!defined('STDOUT')) define('STDOUT', fopen('php://output', 'wb'));
require_once __DIR__ . '/../api/lib/KraWorkspaceBrowser.php';

function workspaceCheck(string $label, bool $ok): void
{
    fwrite(STDOUT, ($ok ? '[PASS] ' : '[FAIL] ') . $label . "\n");
    if (!$ok) exit(1);
}

function removeWorkspaceFixture(string $path): void
{
    if (is_link($path) || is_file($path)) {
        @unlink($path);
        return;
    }
    if (!is_dir($path)) return;
    foreach (scandir($path) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        removeWorkspaceFixture($path . DIRECTORY_SEPARATOR . $entry);
    }
    @rmdir($path);
}

$base = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'kra-workspace-' . bin2hex(random_bytes(5));
$project = $base . DIRECTORY_SEPARATOR . 'demo-app';
mkdir($project . DIRECTORY_SEPARATOR . 'src', 0777, true);
mkdir($project . DIRECTORY_SEPARATOR . '.git', 0777, true);
mkdir($project . DIRECTORY_SEPARATOR . 'secrets', 0777, true);
file_put_contents($project . DIRECTORY_SEPARATOR . 'secrets' . DIRECTORY_SEPARATOR . 'data.txt', 'private');
file_put_contents($project . DIRECTORY_SEPARATOR . 'index.html', '<h1>hello</h1>');
file_put_contents($project . DIRECTORY_SEPARATOR . 'config.json', '{"apiKey":"do-not-show"}');
file_put_contents($project . DIRECTORY_SEPARATOR . '.env', 'TOKEN=do-not-show');
file_put_contents($project . DIRECTORY_SEPARATOR . '.git' . DIRECTORY_SEPARATOR . 'config', 'private');
file_put_contents($project . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'app.js', 'console.log("ok");');
file_put_contents($project . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'image.bin', "\0\1\2");
file_put_contents($project . DIRECTORY_SEPARATOR . 'large.txt', str_repeat('x', 262145));
@symlink('/etc/passwd', $project . DIRECTORY_SEPARATOR . 'outside-link');
putenv('KRA_PROJECTS_ROOT=' . $base);

try {
    $listing = KraWorkspaceBrowser::listDirectory($project);
    $names = array_column($listing['entries'], 'name');
    workspaceCheck('Project directory can be browsed', in_array('index.html', $names, true));
    workspaceCheck('Sensitive files and folders, symlinks, and .git are hidden', !in_array('config.json', $names, true)
        && !in_array('.env', $names, true) && !in_array('secrets', $names, true)
        && !in_array('.git', $names, true) && !in_array('outside-link', $names, true));

    $source = KraWorkspaceBrowser::readFile($project, 'src/app.js');
    workspaceCheck('UTF-8 source preview returns file contents', $source['content'] === 'console.log("ok");');

    try {
        KraWorkspaceBrowser::readFile($project, '../outside.txt');
        workspaceCheck('Path traversal is rejected', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Path traversal is rejected', true);
    }

    try {
        KraWorkspaceBrowser::readFile($project, 'config.json');
        workspaceCheck('Secret-bearing config is blocked', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Secret-bearing config is blocked', true);
    }

    try {
        KraWorkspaceBrowser::readFile($project, 'src/image.bin');
        workspaceCheck('Binary content is rejected by text preview', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Binary content is rejected by text preview', true);
    }

    try {
        KraWorkspaceBrowser::listDirectory($project, 'secrets');
        workspaceCheck('Sensitive folders cannot be opened directly', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Sensitive folders cannot be opened directly', true);
    }

    try {
        KraWorkspaceBrowser::readFile($project, 'large.txt');
        workspaceCheck('Large text files exceed the preview limit', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Large text files exceed the preview limit', true);
    }

    try {
        KraWorkspaceBrowser::readFile($project, 'outside-link');
        workspaceCheck('Symbolic links cannot be read', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Symbolic links cannot be read', true);
    }

    try {
        KraWorkspaceBrowser::resolveRoot(KraProjectPath::kraRoot());
        workspaceCheck('KRA installation root is excluded', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('KRA installation root is excluded', true);
    }

    $rootAlias = $base . DIRECTORY_SEPARATOR . 'project-alias';
    @symlink($project, $rootAlias);
    try {
        KraWorkspaceBrowser::resolveRoot($rootAlias);
        workspaceCheck('Symbolic-link project roots are rejected', false);
    } catch (InvalidArgumentException) {
        workspaceCheck('Symbolic-link project roots are rejected', true);
    }

    $taskFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'tasks.json';
    $oldTasks = is_file($taskFile) ? file_get_contents($taskFile) : null;
    if (!is_dir(dirname($taskFile))) mkdir(dirname($taskFile), 0777, true);
    file_put_contents($taskFile, json_encode([
        'KRA-TEST-WORKSPACE' => [
            'id' => 'KRA-TEST-WORKSPACE', 'status' => 'WAITING_APPROVAL',
            'projectRoot' => $project, 'targetFile' => 'index.html', 'proposedContent' => '<h1>new</h1>',
        ],
        'KRA-TEST-LEGACY' => [
            'id' => 'KRA-TEST-LEGACY', 'status' => 'WAITING_APPROVAL',
            'projectRoot' => null, 'targetFile' => 'web/index.html', 'proposedContent' => 'proposal only',
        ],
    ]));
    try {
        $taskPreview = KraWorkspaceBrowser::previewTask('KRA-TEST-WORKSPACE');
        workspaceCheck('Approval preview loads baseline only from the selected workspace',
            $taskPreview['workspaceAvailable'] === true && $taskPreview['beforeContent'] === '<h1>hello</h1>');
        $legacyPreview = KraWorkspaceBrowser::previewTask('KRA-TEST-LEGACY');
        workspaceCheck('Legacy proposals never read files from the KRA installation',
            $legacyPreview['workspaceAvailable'] === false && $legacyPreview['exists'] === null
                && $legacyPreview['beforeContent'] === '' && $legacyPreview['proposedContent'] === 'proposal only');
    } finally {
        if ($oldTasks === null) @unlink($taskFile);
        else file_put_contents($taskFile, $oldTasks);
    }
} finally {
    removeWorkspaceFixture($base);
    putenv('KRA_PROJECTS_ROOT');
}

echo "Workspace browser security tests passed.\n";
