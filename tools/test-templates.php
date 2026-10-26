<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/lib/KraTemplateRegistry.php';

echo 'Testing KraTemplateRegistry...' . PHP_EOL;
$templates = KraTemplateRegistry::listTemplates();
echo 'Templates found: ' . count($templates) . PHP_EOL;

$firstFive = array_slice($templates, 0, 5, true);
foreach ($firstFive as $id => $tpl) {
    echo "  - {$tpl['name']} (id: {$id}, accent: {$tpl['accent']})" . PHP_EOL;
    echo "    desc: " . substr($tpl['description'], 0, 70) . "..." . PHP_EOL;
}

$skills = KraTemplateRegistry::listSkills();
echo PHP_EOL . 'Skills found: ' . count($skills) . PHP_EOL;
foreach (array_slice($skills, 0, 5, true) as $id => $s) {
    echo "  - {$id}: {$s['description']}" . PHP_EOL;
}
