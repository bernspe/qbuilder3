<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$path = dirname(__DIR__) . '/uploads/questionnaires/original_pgraph.json';
if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(['error' => 'Original nicht gefunden']);
    exit;
}
echo file_get_contents($path);
