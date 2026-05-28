<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$name = isset($_GET['name']) ? $_GET['name'] : '';
if (!preg_match('/^[\p{L}0-9_\-]+$/u', $name)) {
    http_response_code(400);
    echo json_encode(['error' => 'Ungültiger Name']);
    exit;
}

$path = dirname(__DIR__) . '/uploads/questionnaires/' . $name . '.json';
if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(['error' => 'Variante nicht gefunden']);
    exit;
}

echo file_get_contents($path);
