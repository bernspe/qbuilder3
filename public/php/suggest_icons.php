<?php
// suggest_icons.php
// POST { nodes: [{ id, label, question?, icfCode? }] }
// Returns { [nodeId]: "iconify:name" }
// Caches results in uploads/icon-cache.json — LLM only called for unknown nodes

declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

$env = getenv('APP_ENV') ?: 'local';
loadEnv($env === 'local' ? __DIR__ . '/../../.env.server' : '/home/.env.server');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { jsonError(405, 'Method not allowed'); }

$body  = json_decode(file_get_contents('php://input'), true);
$nodes = $body['nodes'] ?? [];

if (!is_array($nodes) || count($nodes) === 0) {
    echo json_encode((object)[]); exit;
}

// ── Load server-side cache ───────────────────────────────────────────────────
$cacheFile = dirname(__DIR__) . '/uploads/icon-cache.json';
$cache = [];
if (file_exists($cacheFile)) {
    $cache = json_decode(file_get_contents($cacheFile), true) ?: [];
}

// ── Find nodes not yet in cache ──────────────────────────────────────────────
$uncached = array_values(array_filter($nodes, fn($n) => !isset($cache[$n['id'] ?? ''])));

if (!empty($uncached)) {
    $suggested = callLlm(
        $uncached,
        rtrim($_ENV['LLM_BASE_URL'] ?? '', '/'),
        $_ENV['LLM_API_KEY'] ?? '',
        $_ENV['LLM_MODEL']   ?? '',
    );
    foreach ($suggested as $id => $icon) {
        if (is_string($id) && is_string($icon) && $id !== '') {
            $cache[$id] = $icon;
        }
    }
    @mkdir(dirname($cacheFile), 0755, true);
    file_put_contents($cacheFile, json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

// ── Return only the requested ids ───────────────────────────────────────────
$result = [];
foreach ($nodes as $n) {
    $id = $n['id'] ?? '';
    if ($id !== '' && isset($cache[$id])) {
        $result[$id] = $cache[$id];
    }
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);


// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

function callLlm(array $nodes, string $baseUrl, string $apiKey, string $model): array
{
    $lines = array_map(fn($n) =>
        sprintf('{"id":"%s","label":"%s"%s%s}',
            addslashes($n['id']      ?? ''),
            addslashes($n['label']   ?? ''),
            isset($n['question'])  && $n['question']  !== '' ? ',"question":"'  . addslashes($n['question'])  . '"' : '',
            isset($n['icfCode'])   && $n['icfCode']   !== '' ? ',"icfCode":"'   . addslashes($n['icfCode'])   . '"' : ''
        ),
        $nodes
    );

    $systemPrompt = <<<'PROMPT'
You are an icon suggestion assistant for an ICF (International Classification of Functioning) health survey app.
Given a list of question nodes (id, label, optional question text, optional ICF code), return the most semantically fitting Iconify icon for each.

Rules:
- Prefer the "mdi" set (Material Design Icons) — it is the most comprehensive (~7000 icons).
- You may also use: healthicons, streamline-freehand, fluent-emoji-high-contrast, lucide, ri, mingcute, medical-icon.
- Return ONLY a valid JSON object: { "nodeId": "set:icon-name", ... }
- No markdown fences, no explanation — raw JSON only.
- Choose icons that clearly represent the topic even without a label.
PROMPT;

    $userMsg = "Suggest icons for these nodes:\n[\n" . implode(",\n", $lines) . "\n]";

    $payload = json_encode([
        'model'       => $model,
        'temperature' => 0.1,
        'messages'    => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user',   'content' => $userMsg],
        ],
    ], JSON_UNESCAPED_UNICODE);

    $response = @file_get_contents(
        "$baseUrl/chat/completions",
        false,
        stream_context_create(['http' => [
            'method'        => 'POST',
            'header'        => "Content-Type: application/json\r\nAuthorization: Bearer $apiKey",
            'content'       => $payload,
            'timeout'       => 30,
            'ignore_errors' => true,
        ]])
    );

    if ($response === false) return [];

    $data = json_decode($response, true);
    $raw  = $data['choices'][0]['message']['content'] ?? '{}';

    $cleaned = preg_replace('/```(?:json)?|```/', '', $raw);
    $start   = strpos($cleaned, '{');
    $end     = strrpos($cleaned, '}');
    if ($start === false || $end === false) return [];

    $parsed = json_decode(substr($cleaned, $start, $end - $start + 1), true);
    return is_array($parsed) ? $parsed : [];
}

function loadEnv(string $path): void
{
    if (!file_exists($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        [$k, $v] = array_map('trim', explode('=', $line, 2)) + ['', ''];
        $_ENV[$k] = $v = trim($v, '"\'');
        putenv("$k=$v");
    }
}

function jsonError(int $code, string $msg): never
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}
