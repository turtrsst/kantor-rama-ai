<?php
declare(strict_types=1);

final class KraRemotionBridge
{
    private const REMOTION_ROOT = 'remotion';
    private const RENDER_OUT = 'assets/renders/video';
    private const MAX_RENDER_TIMEOUT_SEC = 180;

    public static function render(string $composition, array $props = []): array
    {
        $projectRoot = realpath(__DIR__ . '/../..');
        if ($projectRoot === false) {
            return ['ok' => false, 'error' => 'Could not resolve project root.'];
        }

        $remotionDir = $projectRoot . DIRECTORY_SEPARATOR . self::REMOTION_ROOT;
        $outputDir = $projectRoot . DIRECTORY_SEPARATOR . self::RENDER_OUT;
        $entryPoint = 'src/index.ts';

        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0777, true);
        }

        $filename = preg_replace('/[^a-z0-9_\-]/i', '_', $composition) . '_' . time() . '.mp4';
        $outputPath = $outputDir . DIRECTORY_SEPARATOR . $filename;
        $propsJson = json_encode($props, JSON_UNESCAPED_SLASHES);

        // Run npx remotion render directly inside the remotion directory
        $cmd = 'npx.cmd remotion render ' . escapeshellarg($entryPoint) . ' '
            . escapeshellarg($composition) . ' ' . escapeshellarg($outputPath);
        if (!empty($props)) {
            $cmd .= ' --props=' . escapeshellarg($propsJson);
        }

        $result = KraTerminalBridge::run($cmd, $remotionDir, self::MAX_RENDER_TIMEOUT_SEC);

        if (!$result['ok']) {
            return [
                'ok' => false,
                'error' => 'Remotion render failed: ' . $result['output'],
                'command' => $cmd,
            ];
        }

        return [
            'ok' => true,
            'composition' => $composition,
            'outputFile' => $filename,
            'url' => 'assets/renders/video/' . $filename,
            'fullPath' => $outputPath,
        ];
    }

    public static function listCompositions(): array
    {
        return [
            ['id' => 'PromoClip', 'durationInFrames' => 150, 'fps' => 30, 'width' => 1920, 'height' => 1080]
        ];
    }
}
