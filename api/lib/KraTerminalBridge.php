<?php
declare(strict_types=1);

final class KraTerminalBridge
{
    private const MAX_TIMEOUT_SEC = 15;
    private const MAX_OUTPUT_BYTES = 64000;

    public static function run(string $command, string $projectRoot): array
    {
        $cmd = trim($command);
        if ($cmd === '') {
            return ['ok' => false, 'output' => 'Command cannot be empty.', 'exitCode' => 1];
        }

        // Safety gate: block dangerous system-level destructive patterns
        $lower = strtolower($cmd);
        $blocked = ['format ', 'rd /s /q c:', 'rmdir /s /q c:', 'rm -rf /', 'diskpart', 'shutdown'];
        foreach ($blocked as $b) {
            if (str_contains($lower, $b)) {
                return [
                    'ok' => false,
                    'output' => 'Safety gate: Destructive system command blocked by KRA.',
                    'exitCode' => 126,
                ];
            }
        }

        $realRoot = realpath($projectRoot);
        if ($realRoot === false || !is_dir($realRoot)) {
            throw new RuntimeException('Invalid project root for terminal execution.');
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        // On Windows run through cmd /c or powershell
        $isWin = PHP_OS_FAMILY === 'Windows';
        $fullCmd = $isWin ? 'cmd.exe /c ' . $cmd : $cmd;

        $proc = @proc_open($fullCmd, $descriptors, $pipes, $realRoot);
        if (!is_resource($proc)) {
            return [
                'ok' => false,
                'output' => 'Failed to spawn process in workspace.',
                'exitCode' => 1,
            ];
        }

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $startTime = time();

        while (true) {
            $read = [$pipes[1], $pipes[2]];
            $write = null;
            $except = null;
            $numChanged = @stream_select($read, $write, $except, 0, 100000);

            if ($numChanged > 0) {
                foreach ($read as $r) {
                    if ($r === $pipes[1]) {
                        $chunk = fread($pipes[1], 8192);
                        if ($chunk !== false) $stdout .= $chunk;
                    } elseif ($r === $pipes[2]) {
                        $chunk = fread($pipes[2], 8192);
                        if ($chunk !== false) $stderr .= $chunk;
                    }
                }
            }

            $status = proc_get_status($proc);
            if (!$status['running']) {
                // Drain remainder
                $chunk1 = stream_get_contents($pipes[1]);
                $chunk2 = stream_get_contents($pipes[2]);
                if ($chunk1) $stdout .= $chunk1;
                if ($chunk2) $stderr .= $chunk2;
                break;
            }

            if ((time() - $startTime) > self::MAX_TIMEOUT_SEC) {
                proc_terminate($proc, 9);
                fclose($pipes[1]);
                fclose($pipes[2]);
                proc_close($proc);
                return [
                    'ok' => false,
                    'output' => "Execution timed out after " . self::MAX_TIMEOUT_SEC . " seconds.\n" . $stdout,
                    'exitCode' => 124,
                ];
            }
            usleep(20000);
        }

        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($proc);

        $combined = trim($stdout . ($stderr !== '' ? "\n" . $stderr : ''));
        if (strlen($combined) > self::MAX_OUTPUT_BYTES) {
            $combined = substr($combined, 0, self::MAX_OUTPUT_BYTES) . "\n... [output truncated]";
        }

        return [
            'ok' => $exitCode === 0,
            'output' => $combined !== '' ? $combined : '(command completed with no output)',
            'exitCode' => $exitCode,
            'cwd' => $realRoot,
        ];
    }
}
