<?php
declare(strict_types=1);

/**
 * KRA SSH & sFTP Bridge.
 *
 * Uses the platform's OpenSSH client (ssh / sftp) when it is present and the
 * configured host answers a TCP probe. When OpenSSH is missing or the host is
 * unreachable, every operation returns `mode: 'unavailable'` with the reason
 * instead of fabricated output.
 *
 * Host records live in .temp/ssh_hosts.json (workspace admin writes them).
 */
final class KraSshBridge
{
    private const CONFIG_FILE = __DIR__ . '/../../.temp/ssh_hosts.json';
    private const PROBE_TIMEOUT = 3;
    private const CMD_TIMEOUT = 30;

    public static function loadHosts(): array
    {
        if (is_file(self::CONFIG_FILE)) {
            $data = json_decode((string) file_get_contents(self::CONFIG_FILE), true);
            if (is_array($data) && isset($data['hosts']) && is_array($data['hosts'])) {
                return $data['hosts'];
            }
        }
        // No persisted hosts yet. Return the empty list rather than inventing
        // plausible-looking demo hosts the operator might mistake for real ones.
        return [];
    }

    public static function saveHosts(array $hosts): bool
    {
        $clean = [];
        foreach ($hosts as $host) {
            if (!is_array($host)) continue;
            $h = trim((string) ($host['host'] ?? ''));
            if ($h === '') continue;
            $clean[] = [
                'id' => (string) ($host['id'] ?? ('host_' . substr(hash('sha1', $h . ($host['port'] ?? 22)), 0, 10))),
                'name' => trim((string) ($host['name'] ?? $h)),
                'host' => $h,
                'port' => max(1, min(65535, (int) ($host['port'] ?? 22))),
                'user' => trim((string) ($host['user'] ?? '')),
                'auth' => in_array(($host['auth'] ?? 'key'), ['key', 'password'], true) ? $host['auth'] : 'key',
                'keyPath' => trim((string) ($host['keyPath'] ?? '')),
                'remotePath' => trim((string) ($host['remotePath'] ?? '')),
            ];
        }
        $dir = dirname(self::CONFIG_FILE);
        if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
            return false;
        }
        return file_put_contents(self::CONFIG_FILE, json_encode(['hosts' => $clean], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) !== false;
    }

    private static function binary(string $name): string
    {
        $envKey = strtoupper($name) . '_BINARY';
        $override = (string) (getenv($name . '_BINARY') ?: getenv($envKey) ?: '');
        if ($override !== '' && is_file($override)) {
            return $override;
        }
        $candidates = $name === 'ssh'
            ? ['C:\\Windows\\System32\\OpenSSH\\ssh.exe', '/usr/bin/ssh']
            : ['C:\\Windows\\System32\\OpenSSH\\sftp.exe', '/usr/bin/sftp'];
        foreach ($candidates as $candidate) {
            if (is_file($candidate)) return $candidate;
        }
        return '';
    }

    /** TCP connect probe: returns latency in ms, or null when the port is closed. */
    private static function probe(string $host, int $port): ?int
    {
        $start = microtime(true);
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client(
            'tcp://' . $host . ':' . $port,
            $errno,
            $errstr,
            self::PROBE_TIMEOUT,
            STREAM_CLIENT_CONNECT
        );
        if ($socket === false) {
            return null;
        }
        fclose($socket);
        return (int) round((microtime(true) - $start) * 1000);
    }

    private static function findHost(string $hostId): ?array
    {
        foreach (self::loadHosts() as $host) {
            if ((string) ($host['id'] ?? '') === $hostId) return $host;
        }
        return null;
    }

    private static function sshArgs(array $host): array
    {
        $args = [
            '-p', (string) (int) ($host['port'] ?? 22),
            '-o', 'BatchMode=yes',
            '-o', 'StrictHostKeyChecking=accept-new',
            '-o', 'ConnectTimeout=' . self::PROBE_TIMEOUT,
            '-o', 'NumberOfPasswordPrompts=0',
        ];
        $keyPath = trim((string) ($host['keyPath'] ?? ''));
        if (($host['auth'] ?? 'key') === 'key' && $keyPath !== '') {
            $args[] = '-i';
            $args[] = $keyPath;
        }
        $target = trim((string) ($host['user'] ?? ''));
        $target = $target !== '' ? $target . '@' . $host['host'] : (string) $host['host'];
        $args[] = $target;
        return $args;
    }

    private static function run(string $binary, array $args, string $stdin = ''): array
    {
        $cmd = escapeshellarg($binary);
        foreach ($args as $arg) {
            $cmd .= ' ' . escapeshellarg((string) $arg);
        }
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = @proc_open($cmd, $descriptors, $pipes);
        if (!is_resource($process)) {
            return ['ok' => false, 'error' => 'Tidak dapat menjalankan ' . basename($binary) . '.'];
        }
        if ($stdin !== '') {
            fwrite($pipes[0], $stdin);
        }
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $deadline = microtime(true) + self::CMD_TIMEOUT;
        while (microtime(true) < $deadline) {
            $stdout .= (string) stream_get_contents($pipes[1]);
            $stderr .= (string) stream_get_contents($pipes[2]);
            $status = proc_get_status($process);
            if (!$status['running']) break;
            usleep(50000);
        }
        $status = proc_get_status($process);
        $exitCode = $status['running'] ? -1 : (int) $status['exitcode'];
        if ($status['running']) {
            proc_terminate($process, 9);
            $stderr .= "\n[timeout setelah " . self::CMD_TIMEOUT . "s]";
        }
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);

        return [
            'ok' => $exitCode === 0,
            'exitCode' => $exitCode,
            'stdout' => trim($stdout),
            'stderr' => trim($stderr),
        ];
    }

    public static function status(): array
    {
        $ssh = self::binary('ssh');
        $sftp = self::binary('sftp');
        return [
            'ok' => true,
            'mode' => ($ssh !== '' || $sftp !== '') ? 'ready' : 'unavailable',
            'sshBinary' => $ssh !== '' ? $ssh : 'none',
            'sftpBinary' => $sftp !== '' ? $sftp : 'none',
            'hostCount' => count(self::loadHosts()),
            'notice' => ($ssh === '' && $sftp === '')
                ? 'OpenSSH client tidak terdeteksi. Pasang OpenSSH atau set SSH_BINARY.'
                : 'OpenSSH client terdeteksi.',
        ];
    }

    public static function testConnection(string $hostId): array
    {
        $host = self::findHost($hostId);
        if ($host === null) {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Host tidak ditemukan.'];
        }
        $port = (int) ($host['port'] ?? 22);
        $latency = self::probe((string) $host['host'], $port);
        if ($latency === null) {
            return [
                'ok' => false,
                'mode' => 'unavailable',
                'host' => $host['host'],
                'port' => $port,
                'error' => 'Port ' . $port . ' pada ' . $host['host'] . ' tidak menerima koneksi.',
            ];
        }

        $ssh = self::binary('ssh');
        if ($ssh === '') {
            return [
                'ok' => true,
                'mode' => 'tcp-only',
                'host' => $host['host'],
                'port' => $port,
                'latencyMs' => $latency,
                'notice' => 'TCP terbuka, tapi OpenSSH client tidak tersedia untuk verifikasi autentikasi.',
            ];
        }

        $result = self::run($ssh, array_merge(self::sshArgs($host), ['echo KRA_SSH_OK']));
        $handshakeOk = str_contains($result['stdout'], 'KRA_SSH_OK');
        return [
            'ok' => $handshakeOk,
            'mode' => $handshakeOk ? 'live' : 'auth-failed',
            'host' => $host['host'],
            'port' => $port,
            'user' => $host['user'] ?? '',
            'latencyMs' => $latency,
            'handshake' => $handshakeOk ? 'Autentikasi diterima' : 'Autentikasi gagal',
            'error' => $handshakeOk ? '' : trim($result['stderr']),
        ];
    }

    public static function listSftp(string $hostId, string $remotePath = ''): array
    {
        $host = self::findHost($hostId);
        if ($host === null) {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Host tidak ditemukan.'];
        }
        $sftp = self::binary('sftp');
        if ($sftp === '') {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'sftp client tidak tersedia di server KRA.'];
        }
        $path = $remotePath !== '' ? $remotePath : (string) ($host['remotePath'] ?? '');
        if ($path === '') {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Path remote belum diisi pada host ini.'];
        }

        // sftp -b reads a batch script from stdin.
        $batch = 'ls -l ' . $path . "\n";
        $result = self::run($sftp, array_merge(self::sshArgs($host), ['-b', '-']), $batch);
        if (!$result['ok']) {
            return [
                'ok' => false,
                'mode' => 'unavailable',
                'hostId' => $hostId,
                'path' => $path,
                'error' => $result['stderr'] !== '' ? $result['stderr'] : 'sftp gagal membaca direktori remote.',
            ];
        }

        $entries = [];
        foreach (preg_split('/\r?\n/', $result['stdout']) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, 'Connected to') || str_starts_with($line, 'sftp>')) continue;
            // Parses `ls -l` output: perms links owner group size date time name
            if (preg_match('/^([dl-][rwx-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(.+)$/', $line, $m)) {
                $rest = trim($m[3]);
                // Drop the date columns, keep the trailing name.
                $parts = preg_split('/\s+/', $rest, 4) ?: [];
                $name = (string) end($parts);
                if ($name === '' || $name === '.' || $name === '..') continue;
                $entries[] = [
                    'name' => $name,
                    'kind' => $m[1][0] === 'd' ? 'directory' : 'file',
                    'size' => (int) $m[2],
                    'perm' => $m[1],
                ];
            }
        }

        return [
            'ok' => true,
            'mode' => 'live',
            'hostId' => $hostId,
            'path' => $path,
            'entries' => $entries,
        ];
    }

    public static function runRemote(string $hostId, string $command): array
    {
        $command = trim($command);
        if ($command === '') {
            return ['ok' => false, 'error' => 'Command kosong.'];
        }
        $host = self::findHost($hostId);
        if ($host === null) {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'Host tidak ditemukan.'];
        }
        $ssh = self::binary('ssh');
        if ($ssh === '') {
            return ['ok' => false, 'mode' => 'unavailable', 'error' => 'OpenSSH client tidak tersedia di server KRA.'];
        }
        $result = self::run($ssh, array_merge(self::sshArgs($host), [$command]));
        return [
            'ok' => $result['ok'],
            'mode' => 'live',
            'hostId' => $hostId,
            'command' => $command,
            'exitCode' => $result['exitCode'],
            'output' => $result['stdout'] !== '' ? $result['stdout'] : $result['stderr'],
        ];
    }
}
