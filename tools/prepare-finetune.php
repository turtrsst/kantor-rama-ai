<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraDatasetEngine.php';

final class KraFineTunePrep
{
    public static function generateAlpacaDataset(): array
    {
        $exported = KraDatasetEngine::exportDataset();
        $records = $exported['records'] ?? [];
        $trainingExamples = [];

        foreach ($records as $rec) {
            $source = $rec['source'] ?? '';
            $text = $rec['text'] ?? '';
            if ($text === '') continue;

            if ($source === 'vault_report') {
                $trainingExamples[] = [
                    'instruction' => 'Review the following Kantor-Rama-AI vault report and summarize key compliance objectives.',
                    'input' => substr($text, 0, 1000),
                    'output' => 'Approved under strict Propose-then-Approve governance. All action items and audit checks preserved.',
                ];
            } elseif ($source === 'chat_history') {
                $trainingExamples[] = [
                    'instruction' => 'Respond in character as a Kantor-Rama-AI office officer maintaining anti-slop and technical rigor.',
                    'input' => $text,
                    'output' => 'Acknowledged. Proceeding with strict type safety, zero audit findings, and max 160-char line limits.',
                ];
            } elseif ($source === 'executed_proposal') {
                $trainingExamples[] = [
                    'instruction' => 'Describe the approved code implementation for ' . ($rec['targetFile'] ?? 'file'),
                    'input' => $rec['summary'] ?? '',
                    'output' => substr((string) ($rec['content'] ?? 'Implemented with zero code-level regressions.'), 0, 1000),
                ];
            }
        }

        $jsonlPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.temp' . DIRECTORY_SEPARATOR . 'kra_finetune_dataset.jsonl';
        $dir = dirname($jsonlPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }

        $fp = @fopen($jsonlPath, 'w');
        $count = 0;
        if ($fp) {
            foreach ($trainingExamples as $ex) {
                @fwrite($fp, json_encode($ex, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
                $count++;
            }
            @fclose($fp);
        }

        return [
            'ok' => true,
            'examplesCount' => $count,
            'outputPath' => '.temp/kra_finetune_dataset.jsonl',
            'modelTarget' => 'Llama 3.2 3B Instruct (Local GPU / Server Migration)',
        ];
    }
}
