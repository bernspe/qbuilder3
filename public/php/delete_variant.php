<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Nur POST erlaubt']);
    exit;
}

$name = isset($_GET['name']) ? $_GET['name'] : '';
if (!preg_match('/^[\p{L}0-9_\-]+$/u', $name)) {
    http_response_code(400);
    echo json_encode(['error' => 'Ungültiger Name']);
    exit;
}

if ($name === 'original_pgraph') {
    http_response_code(403);
    echo json_encode(['error' => 'Das Original darf nicht gelöscht werden']);
    exit;
}

$dir     = dirname(__DIR__) . '/uploads/questionnaires/';
$trash   = $dir . 'Deleted/';
$src     = $dir . $name . '.json';

if (!file_exists($src)) {
    http_response_code(404);
    echo json_encode(['error' => 'Variante nicht gefunden']);
    exit;
}

if (!is_dir($trash)) {
    mkdir($trash, 0755, true);
}

// Avoid overwriting an existing deleted file by appending a timestamp
$dst = $trash . $name . '_' . date('Ymd_His') . '.json';

if (!rename($src, $dst)) {
    http_response_code(500);
    echo json_encode(['error' => 'Verschieben fehlgeschlagen']);
    exit;
}

echo json_encode(['ok' => true]);
