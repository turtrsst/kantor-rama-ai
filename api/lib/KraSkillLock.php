<?php
declare(strict_types=1);

/**
 * KRA Skill Lock
 *
 * Owns the signed-off inventory of installed skills. A skill is only active
 * when its content hash matches the lockfile and its status is approved.
 */
final class KraSkillLock
{
    private const SCHEMA = 1;

    private static ?array $cache = null;

    public static function root(): string
    {
        return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . 'skills';
    }

    public static function path(): string
    {
        return self::root() . DIRECTORY_SEPARATOR . 'SKILLS_LOCK.json';
    }

    public static function load(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $empty = ['schema' => self::SCHEMA, 'generatedAt' => null, 'skills' => []];
        $file = self::path();
        if (!is_file($file)) {
            self::$cache = $empty;
            return self::$cache;
        }
        $decoded = json_decode((string) @file_get_contents($file), true);
        if (!is_array($decoded) || !isset($decoded['skills']) || !is_array($decoded['skills'])) {
            self::$cache = $empty;
            return self::$cache;
        }
        $decoded['schema'] = (int) ($decoded['schema'] ?? 0);
        self::$cache = $decoded;
        return self::$cache;
    }

    public static function flush(): void
    {
        self::$cache = null;
    }

    public static function entry(string $id): array
    {
        $lock = self::load();
        $entry = $lock['skills'][$id] ?? [];
        return is_array($entry) ? $entry : [];
    }

    public static function isApproved(string $id): bool
    {
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $id)) {
            return false;
        }
        $entry = self::entry($id);
        if (($entry['status'] ?? '') !== 'approved') {
            return false;
        }
        $file = self::root() . DIRECTORY_SEPARATOR . $id . DIRECTORY_SEPARATOR . 'SKILL.md';
        if (!is_file($file)) {
            return false;
        }
        if (hash_file('sha256', $file) !== (string) ($entry['sha256'] ?? '')) {
            return false;
        }
        if (($entry['source'] ?? 'local') !== 'local') {
            $source = self::readJson(dirname($file) . DIRECTORY_SEPARATOR . 'SOURCE.json');
            if ($source === [] || ($source['sha256'] ?? '') !== (string) ($entry['sha256'] ?? '')) {
                return false;
            }
            if (preg_match('/^[0-9a-f]{40}$/', (string) ($source['commit'] ?? '')) !== 1) {
                return false;
            }
        }
        return true;
    }

    public static function scan(): array
    {
        $dirs = glob(self::root() . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) ?: [];
        $skills = [];
        foreach ($dirs as $dir) {
            $file = $dir . DIRECTORY_SEPARATOR . 'SKILL.md';
            if (!is_file($file)) {
                continue;
            }
            $id = basename($dir);
            $content = (string) @file_get_contents($file);
            $source = self::readJson($dir . DIRECTORY_SEPARATOR . 'SOURCE.json');
            $skills[$id] = [
                'id' => $id,
                'sha256' => hash('sha256', $content),
                'bytes' => strlen($content),
                'source' => (string) ($source['repo'] ?? 'local'),
                'path' => (string) ($source['path'] ?? ''),
                'ref' => (string) ($source['ref'] ?? ''),
                'commit' => (string) ($source['commit'] ?? ''),
                'license' => (string) ($source['license'] ?? 'project'),
                'reviewState' => (string) ($source['reviewState'] ?? 'local'),
            ];
        }
        ksort($skills);
        return $skills;
    }

    public static function build(): array
    {
        $existing = self::load()['skills'] ?? [];
        $scanned = self::scan();
        $skills = [];
        $pending = [];
        foreach ($scanned as $id => $skill) {
            $previous = is_array($existing[$id] ?? null) ? $existing[$id] : [];
            $sameHash = ($previous['sha256'] ?? '') === $skill['sha256'];
            $status = $sameHash ? (string) ($previous['status'] ?? 'pending-review') : 'pending-review';
            $skills[$id] = [
                'sha256' => $skill['sha256'],
                'bytes' => $skill['bytes'],
                'source' => $skill['source'],
                'path' => $skill['path'],
                'ref' => $skill['ref'],
                'commit' => $skill['commit'],
                'license' => $skill['license'],
                'reviewState' => $status === 'approved'
                    ? 'approved'
                    : ($skill['source'] === 'local' ? 'local' : 'imported-unreviewed'),
                'status' => $status,
                'approvedAt' => $sameHash ? ($previous['approvedAt'] ?? null) : null,
                'approvedBy' => $sameHash ? ($previous['approvedBy'] ?? null) : null,
            ];
            if ($status !== 'approved') {
                $pending[] = $id;
            }
        }
        $lock = [
            'schema' => self::SCHEMA,
            'generatedAt' => gmdate('c'),
            'skills' => $skills,
        ];
        self::write($lock);
        return ['count' => count($skills), 'pending' => $pending, 'lock' => $lock];
    }

    public static function approve(string $id, string $by = 'rama'): array
    {
        $lock = self::load();
        if (!isset($lock['skills'][$id]) || !is_array($lock['skills'][$id])) {
            return ['ok' => false, 'error' => 'Skill is not present in the lockfile: ' . $id];
        }
        $lock['skills'][$id]['status'] = 'approved';
        $lock['skills'][$id]['reviewState'] = 'approved';
        $lock['skills'][$id]['approvedAt'] = gmdate('c');
        $lock['skills'][$id]['approvedBy'] = $by;
        self::write($lock);
        self::markSource($id, $by);
        return ['ok' => true, 'id' => $id, 'approvedBy' => $by];
    }

    public static function approveAll(string $by = 'rama'): array
    {
        $lock = self::load();
        $approved = [];
        foreach (array_keys($lock['skills']) as $id) {
            $result = self::approve((string) $id, $by);
            if ($result['ok']) {
                $approved[] = (string) $id;
            }
        }
        return ['ok' => true, 'approved' => $approved, 'count' => count($approved)];
    }

    public static function verify(): array
    {
        $issues = [];
        $lock = self::load();
        $scanned = self::scan();
        if (!is_file(self::path())) {
            $issues[] = ['id' => '*', 'issue' => 'Lockfile is missing: resources/skills/SKILLS_LOCK.json'];
        }
        if ((int) ($lock['schema'] ?? 0) !== self::SCHEMA) {
            $issues[] = ['id' => '*', 'issue' => 'Unsupported lockfile schema.'];
        }
        $approved = 0;
        foreach ($scanned as $id => $skill) {
            $entry = is_array($lock['skills'][$id] ?? null) ? $lock['skills'][$id] : [];
            if ($entry === []) {
                $issues[] = ['id' => $id, 'issue' => 'Installed skill is not registered in the lockfile.'];
                continue;
            }
            if (($entry['source'] ?? 'local') !== $skill['source']) {
                $issues[] = ['id' => $id, 'issue' => 'Source metadata drift between lock and provenance.'];
            }
            if (($entry['commit'] ?? '') !== $skill['commit']) {
                $issues[] = ['id' => $id, 'issue' => 'Commit metadata drift between lock and provenance.'];
            }
            if (($entry['sha256'] ?? '') !== $skill['sha256']) {
                $issues[] = ['id' => $id, 'issue' => 'Checksum drift: installed content differs from the lock.'];
            }
            if (($entry['status'] ?? '') !== 'approved') {
                $issues[] = ['id' => $id, 'issue' => 'Skill is not approved for activation.'];
            } else {
                $approved++;
                if (($entry['approvedAt'] ?? '') === '' || ($entry['approvedBy'] ?? '') === '') {
                    $issues[] = ['id' => $id, 'issue' => 'Approved skill is missing approval metadata.'];
                }
            }
            if ($skill['source'] === 'local') {
                continue;
            }
            if (preg_match('/^[0-9a-f]{40}$/', $skill['commit']) !== 1) {
                $issues[] = ['id' => $id, 'issue' => 'Imported skill is not pinned to a full commit SHA.'];
            }
            $sourceFile = self::root() . DIRECTORY_SEPARATOR . $id . DIRECTORY_SEPARATOR . 'SOURCE.json';
            if (!is_file($sourceFile)) {
                $issues[] = ['id' => $id, 'issue' => 'Imported skill has no SOURCE.json provenance.'];
                continue;
            }
            $source = self::readJson($sourceFile);
            if (($source['sha256'] ?? '') !== $skill['sha256']) {
                $issues[] = ['id' => $id, 'issue' => 'Provenance checksum does not match the installed content.'];
            }
        }
        foreach ($lock['skills'] as $id => $entry) {
            if (!isset($scanned[$id])) {
                $issues[] = ['id' => (string) $id, 'issue' => 'Lockfile entry has no installed skill folder.'];
            }
        }
        return [
            'ok' => $issues === [],
            'issues' => $issues,
            'checked' => count($scanned),
            'approved' => $approved,
        ];
    }

    private static function markSource(string $id, string $by): void
    {
        $file = self::root() . DIRECTORY_SEPARATOR . $id . DIRECTORY_SEPARATOR . 'SOURCE.json';
        if (!is_file($file)) {
            return;
        }
        $source = self::readJson($file);
        if ($source === []) {
            return;
        }
        $source['reviewState'] = 'approved';
        $source['reviewedAt'] = gmdate('c');
        $source['reviewedBy'] = $by;
        self::writeJson($file, $source);
    }

    private static function write(array $lock): void
    {
        self::writeJson(self::path(), $lock);
        self::$cache = null;
    }

    private static function writeJson(string $file, array $data): void
    {
        $dir = dirname($file);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        $encoded = json_encode(
            $data,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
        file_put_contents($file, (string) $encoded . PHP_EOL, LOCK_EX);
    }

    private static function readJson(string $file): array
    {
        if (!is_file($file)) {
            return [];
        }
        $decoded = json_decode((string) @file_get_contents($file), true);
        return is_array($decoded) ? $decoded : [];
    }
}
