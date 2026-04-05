<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$baseDir = dirname(__DIR__) . '/uploads/';

// ── Branch 1: JSON-Variante (application/json + ?filename=xyz.json) ──────────
$filename = isset($_GET['filename']) ? $_GET['filename'] : '';
if ($filename !== '') {
    // Sicherheit: Pfadtraversal und ungültige Dateinamen verhindern
    $filename = basename($filename);
    if (!preg_match('/^[a-zA-Z0-9_\-]+\.json$/', $filename)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ungültiger Dateiname. Nur Buchstaben, Zahlen, _ und - erlaubt.']);
        exit;
    }
    if ($filename === 'original_pgraph.json') {
        http_response_code(403);
        echo json_encode(['error' => 'Das Original darf nicht überschrieben werden.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Leerer Inhalt']);
        exit;
    }

    // JSON-Validierung
    json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Ungültiges JSON: ' . json_last_error_msg()]);
        exit;
    }

    $dest = $baseDir . 'questionnaires/' . $filename;
    if (file_put_contents($dest, $raw) === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Schreiben fehlgeschlagen']);
        exit;
    }

    echo json_encode(['ok' => true, 'url' => '/uploads/questionnaires/' . $filename]);
    exit;
}

// ── Branch 2: Bild-Upload (multipart/form-data) ───────────────────────────────
if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Keine Datei empfangen']);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload-Fehler: ' . $file['error']]);
    exit;
}

// Größe prüfen (max. 500 kB)
if ($file['size'] > 500 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'Datei zu groß (max. 500 kB)']);
    exit;
}

// MIME-Typ prüfen
$allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nicht erlaubter Dateityp: ' . $mime]);
    exit;
}

// Eindeutigen Dateinamen generieren
$originalName = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', basename($file['name']));
$uniqueName = uniqid() . '_' . $originalName;
$dest = $baseDir . 'icons/' . $uniqueName;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Speichern fehlgeschlagen']);
    exit;
}

echo json_encode(['ok' => true, 'url' => '/uploads/icons/' . $uniqueName]);
