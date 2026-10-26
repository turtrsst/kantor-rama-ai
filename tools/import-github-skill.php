<?php
declare(strict_types=1);

/**
 * Import a GitHub-hosted SKILL.md with pinned provenance.
 *
 * Usage:
 *   php tools/import-github-skill.php <owner/repo> <path/SKILL.md> [name]
 *       [--ref=<branch|tag|sha>] [--license=<label>]
 *
 * The ref is resolved to a full commit SHA before download. The raw file is
 * fetched at that immutable commit, never at a moving branch.
 */

$args = array_slice($argv, 1);
$ref = 'main';
$license = 'See upstream LICENSE';
$positional = [];
foreach ($args as $arg) {
    if (str_starts_with($arg, '--ref=')) {
        $ref = substr($arg, 6);
        continue;
    }
    if (str_starts_with($arg, '--license=')) {
        $license = substr($arg, 10);
        continue;
    }
    if (str_starts_with($arg, '--')) {
        fwrite(STDERR, "Unknown option: {$arg}\n");
        exit(1);
    }
    $positional[] = $arg;
}

if (count($positional) < 2) {
    fwrite(STDERR, "Usage: php tools/import-github-skill.php <owner/repo> <path/SKILL.md> "
        . "[name] [--ref=<branch|tag|sha>] [--license=<label>]\n");
    exit(1);
}

$repo = trim($positional[0]);
$sourcePath = ltrim(trim($positional[1]), '/');
$name = $positional[2] ?? basename(dirname($sourcePath));
if (!preg_match('/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/', $repo)) {
    fwrite(STDERR, "Invalid repository. Use owner/repository.\n");
    exit(1);
}
if (!preg_match('/^[A-Za-z0-9_ .\/\\-]+\/SKILL\.md$/i', $sourcePath)) {
    fwrite(STDERR, "Path must end with SKILL.md.\n");
    exit(1);
}
if (!preg_match('/^[A-Za-z0-9_.-]+$/', $name)) {
    fwrite(STDERR, "Invalid local skill name.\n");
    exit(1);
}
if (!preg_match('/^[A-Za-z0-9._\/-]+$/', $ref)) {
    fwrite(STDERR, "Invalid ref. Use a branch, tag, or commit SHA.\n");
    exit(1);
}

/**
 * Fetch a URL and return status plus body.
 *
 * @return array{status:int, body:string}
 */
function kraFetch(string $url, string $accept): array
{
    $context = stream_context_create([
        'http' => [
            'timeout' => 20,
            'ignore_errors' => true,
            'header' => "User-Agent: KRA-Skill-Importer\r\nAccept: {$accept}\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    $status = 0;
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $header, $match) === 1) {
            $status = (int) $match[1];
        }
    }
    return ['status' => $status, 'body' => $body === false ? '' : $body];
}

$commit = '';
if (preg_match('/^[0-9a-f]{40}$/', $ref) === 1) {
    $commit = $ref;
} else {
    $apiUrl = 'https://api.github.com/repos/' . $repo . '/commits/' . rawurlencode($ref);
    $resolved = kraFetch($apiUrl, 'application/vnd.github+json');
    if ($resolved['status'] !== 200) {
        fwrite(STDERR, "Unable to resolve ref '{$ref}' to a commit (HTTP {$resolved['status']}).\n");
        exit(1);
    }
    $payload = json_decode($resolved['body'], true);
    $commit = is_array($payload) ? (string) ($payload['sha'] ?? '') : '';
}
if (preg_match('/^[0-9a-f]{40}$/', $commit) !== 1) {
    fwrite(STDERR, "Ref '{$ref}' did not resolve to a full commit SHA.\n");
    exit(1);
}

$url = 'https://raw.githubusercontent.com/' . $repo . '/' . $commit . '/' . $sourcePath;
$fetched = kraFetch($url, 'text/plain');
if ($fetched['status'] !== 200 || trim($fetched['body']) === '') {
    fwrite(STDERR, "Unable to fetch skill at commit {$commit} (HTTP {$fetched['status']}).\n");
    exit(1);
}
$content = $fetched['body'];
if (strlen($content) > 100000 || preg_match('/<script|javascript:|eval\s*\(/i', $content)) {
    fwrite(STDERR, "Skill rejected by safety preflight.\n");
    exit(1);
}

$target = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR
    . 'skills' . DIRECTORY_SEPARATOR . $name . DIRECTORY_SEPARATOR . 'SKILL.md';
if (!is_dir(dirname($target))) {
    mkdir(dirname($target), 0777, true);
}
file_put_contents($target, $content, LOCK_EX);

$provenance = [
    'source' => 'github',
    'repo' => $repo,
    'path' => $sourcePath,
    'ref' => $ref,
    'commit' => $commit,
    'url' => $url,
    'sha256' => hash('sha256', $content),
    'bytes' => strlen($content),
    'fetchedAt' => gmdate('c'),
    'license' => $license,
    'reviewState' => 'imported-unreviewed',
];
$provenancePath = dirname($target) . DIRECTORY_SEPARATOR . 'SOURCE.json';
$encoded = json_encode($provenance, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
file_put_contents($provenancePath, (string) $encoded . PHP_EOL, LOCK_EX);

fwrite(STDOUT, "Imported {$repo}/{$sourcePath} as {$name} at {$commit}.\n");
fwrite(STDOUT, "Provenance recorded. Run tools/skills-lock.php build then approve after review.\n");
