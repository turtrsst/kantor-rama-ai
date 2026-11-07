<?php
declare(strict_types=1);

/**
 * Two-gate YouTube flow:
 *   1. script      → Gate #1: approve the one script the crew agreed on
 *   2. render      → agent renders with the tool that fits the video
 *   3. publish     → Gate #2: approve the rendered preview, then upload
 * Both gates land in the Task Board and ping Telegram through KraTaskEngine::propose.
 */
final class KraCreatorWorkflowFactory
{
    public static function starterNodes(string $workflowTitle): array
    {
        $slug = strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $workflowTitle), '-'));
        $slug = substr($slug !== '' ? $slug : 'creator-flow', 0, 48);
        $path = 'docs/content-creator/' . $slug . '/';

        return [
            [
                'id' => 'script', 'agentId' => 'creator_writer',
                'title' => 'Script final (hasil diskusi crew) — GATE 1',
                'targetFile' => $path . '01-script.md',
                'summary' => 'Satu script final dari diskusi research + writer + reviewer. Approve di sini untuk memulai render.',
                'proposedContent' => "# Script final\n\nWorkflow: {$workflowTitle}\nFormat: [SHORTS / LONG-FORM]\nDurasi target: [DETIK]\n\n## Hook (0-3 dtk)\n[ISI]\n\n## Isi\n[ISI]\n\n## Penutup / CTA\n[ISI]\n\n## Judul & deskripsi\n- Judul: [ISI]\n- Deskripsi: [ISI]\n\n## Sumber\n[Daftar sumber terverifikasi]\n\n## Rencana render\n- Tool: [concat / ffmpeg / remotion]\n- Alasan: [kenapa tool itu cocok untuk video ini]\n\nGATE 1 — setelah ini disetujui, agent langsung merender.\n",
            ],
            [
                'id' => 'render', 'agentId' => 'creator_producer',
                'title' => 'Render video + preview — GATE 2',
                'targetFile' => $path . '02-render.md', 'dependsOn' => ['script'],
                'summary' => 'Agent memilih tool render yang cocok (concat/ffmpeg/remotion), merender, lalu menempel preview untuk approval kedua.',
                'proposedContent' => "# Render & preview\n\nScript disetujui: [REFERENSI GATE 1]\n\n## Tool terpilih\n[concat / ffmpeg / remotion] — [alasan]\n\n## Hasil render\n- File: [PATH]\n- Durasi / resolusi: [ISI]\n- Preview: [LINK / PATH]\n\n## QA\n- Audio: [OK / CATATAN]\n- Teks aman dibaca: [OK / CATATAN]\n- Hak cipta materi: [OK / CATATAN]\n\nGATE 2 — approve untuk mengizinkan upload YouTube.\n",
            ],
            [
                'id' => 'publish', 'agentId' => 'creator_reviewer',
                'title' => 'Upload YouTube — setelah GATE 2',
                'targetFile' => $path . '03-publish.md', 'dependsOn' => ['render'],
                'summary' => 'Upload ke channel yang sudah tersambung setelah preview disetujui. Default private.',
                'proposedContent' => "# Publish\n\nApproval GATE 2: [REFERENSI]\n- Channel: [TERSAMBUNG / BELUM]\n- Visibilitas: [PRIVATE / UNLISTED / PUBLIC]\n- Judul final: [ISI]\n- Thumbnail: [PATH]\n\nSetelah APPROVE, uploader mengirim video dan mencatat video ID / Studio URL di sini.\n",
            ],
        ];
    }
}
