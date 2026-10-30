<?php
declare(strict_types=1);

/**
 * Explicit local developer-command runner.
 * It tokenizes a deliberately small command grammar and launches argv directly;
 * no shell is involved. Callers must also be protected by the API loopback gate.
 */
final class KraTerminalBridge
{
    private const MAX_TIMEOUT_SEC = 15;
    private const MAX_OUTPUT_BYTES = 64000;
    private const ALLOWED_COMMANDS = ['php', 'node', 'npm', 'npx', 'git', 'python', 'python3', 'composer'];

    public static function run(string $command, string $projectRoot, int $timeoutSeconds = self::MAX_TIMEOUT_SEC): array
    {
        $cmd = trim($command);
        if ($cmd === '') return self::failure('Command cannot be empty.', 1);
        if (strlen($cmd) > 4096) return self::failure('Command is too long (maximum 4096 bytes).', 1);

        $argv = self::tokenize($cmd);
        if ($argv === null || $argv === []) {
            return self::failure('Unsupported shell syntax. Use one executable and plain arguments; pipes, redirects, chaining, substitutions, and control characters are disabled.', 126);
        }
        $executable = strtolower(basename(str_replace('\\', '/', $argv[0])));
        if (!in_array($executable, self::ALLOWED_COMMANDS, true) || str_contains($argv[0], '/') || str_contains($argv[0], '\\')) {
            return self::failure('Executable is not in the local developer allowlist.', 126);
        }
        $argv[0] = $executable;
        foreach (array_slice($argv, 1) as $arg) {
            if (in_array(strtolower($arg), ['-e', '--eval', '-r', '-encodedcommand', '-enc'], true)) {
                return self::failure('Inline code / encoded command flags are disabled. Run a reviewed project file instead.', 126);
            }
        }

        $realRoot = realpath($projectRoot);
        if ($realRoot === false || !is_dir($realRoot)) {
            throw new RuntimeException('Invalid project root for terminal execution.');
        }

        $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $proc = @proc_open($argv, $descriptors, $pipes, $realRoot, null, ['bypass_shell' => true]);
        if (!is_resource($proc)) return self::failure('Failed to spawn allowlisted process.', 1);

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $output = '';
        $started = microtime(true);
        $timeout = max(1, min($timeoutSeconds, 60));
        $exitCode = null;
        $truncated = false;

        while (true) {
            $read = [$pipes[1], $pipes[2]];
            $write = null;
            $except = null;
            $changed = @stream_select($read, $write, $except, 0, 100000);
            if ($changed > 0) {
                foreach ($read as $stream) {
                    $chunk = fread($stream, 8192);
                    if ($chunk === false || $chunk === '') continue;
                    $remaining = self::MAX_OUTPUT_BYTES - strlen($output);
                    if ($remaining > 0) $output .= substr($chunk, 0, $remaining);
                    if (strlen($chunk) > $remaining) {
                        $truncated = true;
                        proc_terminate($proc, 9);
                    }
                }
            }

            $status = proc_get_status($proc);
            if (!$status['running']) {
                if (isset($status['exitcode']) && $status['exitcode'] >= 0) $exitCode = $status['exitcode'];
                foreach ([1, 2] as $idx) {
                    $chunk = stream_get_contents($pipes[$idx]);
                    if ($chunk !== false && $chunk !== '') {
                        $remaining = self::MAX_OUTPUT_BYTES - strlen($output);
                        if ($remaining > 0) $output .= substr($chunk, 0, $remaining);
                        if (strlen($chunk) > $remaining) $truncated = true;
                    }
                }
                break;
            }

            if ((microtime(true) - $started) > $timeout) {
                proc_terminate($proc, 9);
                foreach ([1, 2] as $idx) if (is_resource($pipes[$idx])) fclose($pipes[$idx]);
                proc_close($proc);
                return [
                    'ok' => false,
                    'output' => substr($output, 0, self::MAX_OUTPUT_BYTES) . "\nExecution timed out after {$timeout} seconds.",
                    'exitCode' => 124,
                    'cwd' => $realRoot,
                ];
            }
            usleep(20000);
        }

        foreach ([1, 2] as $idx) if (is_resource($pipes[$idx])) fclose($pipes[$idx]);
        $closedCode = proc_close($proc);
        if ($exitCode === null) $exitCode = $closedCode;
        if ($truncated) $output .= "\n... [output capped; process stopped]";
        $output = trim($output);
        return [
            'ok' => $exitCode === 0 && !$truncated,
            'output' => $output !== '' ? $output : '(command completed with no output)',
            'exitCode' => $truncated ? 124 : $exitCode,
            'cwd' => $realRoot,
        ];
    }

    /** @return list<string>|null */
    private static function tokenize(string $command): ?array
    {
        if (preg_match('/[\\x00-\\x1F\\x7F;&|<>`$()]/', $command)) return null;
        $args = [];
        $token = '';
        $quote = null;
        $escaped = false;
        $started = false;
        $length = strlen($command);
        for ($i = 0; $i < $length; $i++) {
            $char = $command[$i];
            if ($escaped) {
                if ($char !== '\\' && $char !== '"' && $char !== "'") return null;
                $token .= $char;
                $escaped = false;
                $started = true;
                continue;
            }
            if ($char === '\\' && $quote !== "'") {
                $escaped = true;
                $started = true;
                continue;
            }
            if ($quote !== null) {
                if ($char === $quote) $quote = null;
                else $token .= $char;
                $started = true;
                continue;
            }
            if ($char === '"' || $char === "'") {
                $quote = $char;
                $started = true;
                continue;
            }
            if (ctype_space($char)) {
                if ($started) {
                    $args[] = $token;
                    $token = '';
                    $started = false;
                }
                continue;
            }
            $token .= $char;
            $started = true;
        }
        if ($escaped || $quote !== null) return null;
        if ($started) $args[] = $token;
        return $args;
    }

    private static function failure(string $message, int $code): array
    {
        return ['ok' => false, 'output' => $message, 'exitCode' => $code];
    }
}
