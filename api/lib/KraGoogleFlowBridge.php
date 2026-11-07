<?php
declare(strict_types=1);

require_once __DIR__ . '/KraTenantContext.php';

/**
 * KraGoogleFlowBridge — Bridge untuk alur video Google Flow (Veo 3.1)
 *
 * Mengoptimalkan kredit Google AI Pro tanpa menyentuh/menyimpan cookie Google:
 * 1. Generate shot list & prompt berstandar Google Flow (visual + kamera + audio prompt).
 * 2. Menyediakan tombol One-Click Copy untuk di-paste ke flow.google.com.
 * 3. Menyediakan media importer (MP4 hasil download Flow langsung masuk ke folder media KRA).
 * 4. Menyambungkan hasil klip langsung ke Concat (stitch/cut) dan YouTube Studio Uploader.
 */
final class KraGoogleFlowBridge
{
    private const ALLOWED_EXT = ['mp4', 'mov', 'webm'];

    /** @return list<string> Daftar folder media KRA */
    public static function mediaDirs(): array
    {
        $root = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        $dirs = [
            $root . DIRECTORY_SEPARATOR . '.temp',
            $root . DIRECTORY_SEPARATOR . 'files',
            $root . DIRECTORY_SEPARATOR . 'n100n' . DIRECTORY_SEPARATOR . 'files',
        ];
        $extra = trim((string) getenv('KRA_MEDIA_DIR'));
        if ($extra !== '') $dirs[] = $extra;
        return $dirs;
    }

    /**
     * Generate shot list terstruktur siap paste ke Google Flow (Veo 3.1).
     * @param string $topicOrScript Ide/topik/skrip video
     * @param string $aspectRatio '16:9' (Horizontal) atau '9:16' (Shorts)
     * @param string $style Gaya visual ('cinematic', 'anime', 'documentary', 'photorealistic')
     * @return array
     */
    public static function generateShotList(string $topicOrScript, string $aspectRatio = '16:9', string $style = 'cinematic'): array
    {
        $topic = trim($topicOrScript);
        if ($topic === '') {
            throw new InvalidArgumentException('Topik atau skrip video tidak boleh kosong.');
        }

        $lines = preg_split('/[\r\n]+/', $topic) ?: [$topic];
        $lines = array_values(array_filter($lines, static fn($l) => trim($l) !== ''));

        $shots = [];
        $aspectNote = $aspectRatio === '9:16' ? 'Vertical 9:16 portrait composition, mobile-first framing.' : 'Cinematic 16:9 widescreen composition.';
        $stylePrefix = match (strtolower($style)) {
            'anime' => 'Makoto Shinkai aesthetic, vibrant anime lighting, clean lineart, soft glows, ',
            'documentary' => 'National Geographic documentary realism, natural lighting, raw 35mm texture, ',
            'photorealistic' => 'Hyper-realistic 8k video shot on Arri Alexa, masterclass cinematography, natural subsurface scattering, ',
            default => 'Cinematic film grading, 35mm lens, volumetric atmospheric lighting, shallow depth of field, ',
        };

        $total = max(3, min(count($lines), 8));
        for ($i = 0; $i < $total; $i++) {
            $sceneNum = $i + 1;
            $line = $lines[$i] ?? ($lines[0] . " - Part $sceneNum");

            $camera = match ($i % 5) {
                0 => 'Slow establishing pan from left to right with wide-angle lens',
                1 => 'Smooth slow-motion dolly in towards the main subject with shallow depth of field',
                2 => 'Low-angle tracking shot moving forward with dynamic ambient motion',
                3 => 'Extreme close-up with gentle rack focus revealing subtle details',
                default => 'Over-the-shoulder medium shot with cinematic framing',
            };

            $audio = '[Sound: atmospheric cinematic soundscape] Ambient room tone, subtle synchronized sound effects.';
            if (preg_match('/["\']([^"\']+)["\']/', $line, $m)) {
                $audio = '[Sound: clear voiceover] The speaker says "' . addslashes($m[1]) . '" with natural cadence.';
            }

            $visual = $stylePrefix . $line . '. ' . $aspectNote . ' Realistic physics, seamless motion blur.';
            $fullPrompt = $visual . ' [Camera: ' . $camera . '] ' . $audio;

            $shots[] = [
                'scene' => $sceneNum,
                'title' => 'Adegan ' . $sceneNum,
                'summary' => $line,
                'visual_prompt' => $visual,
                'camera_movement' => $camera,
                'audio_prompt' => $audio,
                'duration' => '8s',
                'aspect_ratio' => $aspectRatio,
                'full_prompt' => $fullPrompt,
            ];
        }

        return [
            'ok' => true,
            'topic' => $topic,
            'aspect_ratio' => $aspectRatio,
            'style' => $style,
            'total_shots' => count($shots),
            'estimated_credits' => count($shots) * 20, // ~20 credits per generation di Flow
            'shots' => $shots,
        ];
    }

    /**
     * Daftar video MP4 yang ada di folder media (.temp/ atau files/).
     */
    public static function listMedia(): array
    {
        $files = [];
        foreach (self::mediaDirs() as $dir) {
            if (!is_dir($dir)) continue;
            $items = @scandir($dir);
            if (!is_array($items)) continue;
            foreach ($items as $item) {
                if ($item === '.' || $item === '..' || str_starts_with($item, '.')) continue;
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                if (!in_array($ext, self::ALLOWED_EXT, true)) continue;
                $full = $dir . DIRECTORY_SEPARATOR . $item;
                if (!is_file($full)) continue;
                $files[] = [
                    'name' => $item,
                    'relative_path' => $item,
                    'size' => (int) @filesize($full),
                    'size_formatted' => round(((int) @filesize($full)) / (1024 * 1024), 2) . ' MB',
                    'updated_at' => date('Y-m-d H:i:s', (int) @filemtime($full)),
                ];
            }
        }

        // Sort descending by modified date
        usort($files, static fn($a, $b) => strcmp($b['updated_at'], $a['updated_at']));
        return ['ok' => true, 'media' => $files];
    }

    /**
     * Import video MP4 yang di-upload dari browser atau base64 ke folder media KRA.
     */
    public static function importMedia(string $filename, string $binaryOrBase64): array
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED_EXT, true)) {
            throw new InvalidArgumentException('Format file tidak didukung (.mp4, .mov, .webm saja).');
        }

        $content = str_starts_with($binaryOrBase64, 'data:')
            ? (base64_decode(explode(',', $binaryOrBase64, 2)[1] ?? '', true) ?: '')
            : $binaryOrBase64;

        if ($content === '') {
            throw new InvalidArgumentException('Isi file video kosong atau encoding tidak valid.');
        }

        $root = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        $targetDir = $root . DIRECTORY_SEPARATOR . '.temp';
        if (!is_dir($targetDir)) @mkdir($targetDir, 0777, true);

        $cleanName = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $filename);
        if (!str_ends_with(strtolower($cleanName), '.' . $ext)) $cleanName .= '.' . $ext;
        $targetPath = $targetDir . DIRECTORY_SEPARATOR . 'flow_' . time() . '_' . $cleanName;

        if (@file_put_contents($targetPath, $content) === false) {
            throw new RuntimeException('Gagal menyimpan file ke ' . $targetPath);
        }

        $basename = basename($targetPath);
        return [
            'ok' => true,
            'file' => $basename,
            'relative_path' => $basename,
            'full_path' => $targetPath,
            'size' => strlen($content),
            'message' => 'Video berhasil di-import ke media KRA (' . $basename . '), siap untuk Concat dan YouTube Upload.',
        ];
    }

    /**
     * Susun payload workflow Concat untuk menggabungkan beberapa klip MP4.
     */
    public static function prepareConcatWorkflow(array $files, string $outputTitle = 'final-video.mp4'): array
    {
        $cleanFiles = array_values(array_filter($files, static fn($f) => is_string($f) && trim($f) !== ''));
        if (count($cleanFiles) < 2) {
            throw new InvalidArgumentException('Pilih minimal 2 klip video untuk digabungkan oleh Concat.');
        }

        $cleanOutput = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $outputTitle);
        if (!str_ends_with(strtolower($cleanOutput), '.mp4')) $cleanOutput .= '.mp4';

        $payload = [
            'action' => 'concat_stitch',
            'clips' => $cleanFiles,
            'output' => $cleanOutput,
            'transition' => 'crossfade_0.5s',
            'human_approved' => true,
            'created_at' => gmdate(DATE_ATOM),
        ];

        return [
            'ok' => true,
            'workflow' => 'contoh-concat-edit',
            'output_file' => $cleanOutput,
            'items' => [$payload],
            'message' => 'Workflow Concat siap dijalankan dengan ' . count($cleanFiles) . ' klip.',
        ];
    }
}
