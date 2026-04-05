<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dir = dirname(__DIR__) . '/uploads/questionnaires/';
$files = glob($dir . '*.json') ?: [];
$variants = [];
foreach ($files as $f) {
    $name = basename($f, '.json');
    if ($name === 'original_pgraph') continue;
    $variants[] = $name;
}
echo json_encode(['variants' => $variants]);
