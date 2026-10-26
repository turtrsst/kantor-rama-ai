<?php
declare(strict_types=1);

$atlasPath = __DIR__ . '/../assets/voxel/atlas/office_furniture.json';
$atlas = json_decode((string) file_get_contents($atlasPath), true);

function atlasCheck(bool $ok, string $message): void
{
    if (!$ok) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }
    echo "[PASS] {$message}\n";
}

atlasCheck(is_array($atlas), 'Atlas JSON parses.');
$hasRequiredFields = isset(
    $atlas['grid_size'],
    $atlas['texture_file'],
    $atlas['emission_file'],
    $atlas['sprites']
);
atlasCheck($hasRequiredFields, 'Atlas metadata includes required top-level fields.');

$base = dirname($atlasPath);
$dimension = static function (string $file) use ($base): ?array {
    $path = $base . DIRECTORY_SEPARATOR . basename($file);
    if (!is_file($path)) {
        $path = $base . DIRECTORY_SEPARATOR . pathinfo($file, PATHINFO_FILENAME) . '.svg';
    }
    if (!is_file($path)) return null;
    $imageInfo = getimagesize($path);
    if (is_array($imageInfo)) return [(int) $imageInfo[0], (int) $imageInfo[1]];

    $content = (string) file_get_contents($path);
    if (!preg_match('/<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/i', $content, $matches)) return null;
    return [(int) $matches[1], (int) $matches[2]];
};

$diffuseDimensions = $dimension((string) $atlas['texture_file']);
$emissionDimensions = $dimension((string) $atlas['emission_file']);
atlasCheck($diffuseDimensions !== null, 'Diffuse atlas exists and declares pixel dimensions.');
atlasCheck($emissionDimensions !== null, 'Emission atlas exists and declares pixel dimensions.');
atlasCheck($diffuseDimensions === $emissionDimensions, 'Diffuse and emission atlas dimensions match.');

$gridSize = (int) $atlas['grid_size'];
atlasCheck($gridSize > 0, 'Grid size is positive.');

foreach ($atlas['sprites'] as $name => $sprite) {
    $frame = $sprite['frame'] ?? [];
    $pivot = $sprite['pivot'] ?? [];
    $occupancy = $sprite['grid_occupancy'] ?? [];
    $validFrame = isset($frame['x'], $frame['y'], $frame['w'], $frame['h'])
        && $frame['x'] >= 0 && $frame['y'] >= 0 && $frame['w'] > 0 && $frame['h'] > 0
        && $frame['x'] + $frame['w'] <= $diffuseDimensions[0]
        && $frame['y'] + $frame['h'] <= $diffuseDimensions[1];
    atlasCheck($validFrame, "{$name}: frame is positive and within both atlases.");

    $validPivot = isset($pivot['x'], $pivot['y'])
        && $pivot['x'] >= 0 && $pivot['x'] <= $frame['w']
        && $pivot['y'] >= 0 && $pivot['y'] <= $frame['h'];
    atlasCheck($validPivot, "{$name}: pivot lies within its frame.");

    $validOccupancy = isset($occupancy['cols'], $occupancy['rows'])
        && $occupancy['cols'] > 0 && $occupancy['rows'] > 0;
    atlasCheck($validOccupancy, "{$name}: grid occupancy is positive.");
    atlasCheck(isset($sprite['has_emission']) && is_bool($sprite['has_emission']), "{$name}: has_emission is a boolean.");
}

echo "\n[SUCCESS] Atlas metadata and map layout verified.\n";
