<?php
/**
 * CLI-only test for delete_variant.php move logic.
 * Run: php public/php/test_delete_variant.php
 */
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('Nur über CLI ausführbar');
}

// ── helpers ──────────────────────────────────────────────────────────────────
$passed = 0;
$failed = 0;

function ok(string $label, bool $cond): void {
    global $passed, $failed;
    if ($cond) { echo "  ✓  $label\n"; $passed++; }
    else        { echo "  ✗  $label\n"; $failed++; }
}

// ── setup: temp dir mimicking uploads/questionnaires/ ────────────────────────
$base  = sys_get_temp_dir() . '/qb_test_' . getmypid();
$qdir  = $base . '/questionnaires/';
$trash = $qdir . 'Deleted/';

mkdir($qdir, 0755, true);

// ── move logic extracted from delete_variant.php ─────────────────────────────
function moveToDeleted(string $name, string $qdir, string $trash): array {
    if (!preg_match('/^[\p{L}0-9_\-]+$/u', $name)) {
        return ['error' => 'Ungültiger Name'];
    }
    if ($name === 'original_pgraph') {
        return ['error' => 'Das Original darf nicht gelöscht werden'];
    }

    $src = $qdir . $name . '.json';
    if (!file_exists($src)) {
        return ['error' => 'Variante nicht gefunden'];
    }

    if (!is_dir($trash)) {
        mkdir($trash, 0755, true);
    }

    $dst = $trash . $name . '_' . date('Ymd_His') . '.json';
    if (!rename($src, $dst)) {
        return ['error' => 'Verschieben fehlgeschlagen'];
    }

    return ['ok' => true, 'dst' => $dst];
}

// ── tests ─────────────────────────────────────────────────────────────────────
echo "\ndelete_variant – move to Deleted/\n";
echo str_repeat('─', 46) . "\n";

// 1. Normal move
file_put_contents($qdir . 'test_v1.json', '{"nodes":[]}');
$r = moveToDeleted('test_v1', $qdir, $trash);
ok('returns ok',                   ($r['ok'] ?? false) === true);
ok('source file removed',          !file_exists($qdir . 'test_v1.json'));
ok('Deleted/ dir created',         is_dir($trash));
ok('file exists in Deleted/',      isset($r['dst']) && file_exists($r['dst']));
ok('filename contains variant id', isset($r['dst']) && str_contains($r['dst'], 'test_v1'));

// 2. No overwrite: second delete of same name gets different dst
sleep(1); // ensure different timestamp
file_put_contents($qdir . 'test_v1.json', '{"nodes":[]}');
$r2 = moveToDeleted('test_v1', $qdir, $trash);
ok('second move also ok',          ($r2['ok'] ?? false) === true);
ok('dst differs from first move',  ($r['dst'] ?? '') !== ($r2['dst'] ?? ''));

// 3. File not found → error
$r3 = moveToDeleted('nonexistent', $qdir, $trash);
ok('missing file → error',         isset($r3['error']));

// 4. original_pgraph protected
ok('original_pgraph → error',      isset(moveToDeleted('original_pgraph', $qdir, $trash)['error']));

// 5. Invalid name rejected
ok('invalid name (../) → error',   isset(moveToDeleted('../etc/passwd', $qdir, $trash)['error']));
ok('empty name → error',           isset(moveToDeleted('', $qdir, $trash)['error']));

// ── path sanity: confirm __DIR__ resolves correctly in real script ───────────
echo "\nPath sanity (real script)\n";
echo str_repeat('─', 46) . "\n";

$phpDir   = __DIR__;
$realQdir = dirname($phpDir) . '/uploads/questionnaires/';
$realJson = $realQdir . 'original_pgraph.json';

ok('questionnaires/ dir exists',   is_dir($realQdir));
ok('original_pgraph.json exists',  file_exists($realJson));
ok('questionnaires/ is writable',  is_writable($realQdir));

// ── cleanup ───────────────────────────────────────────────────────────────────
foreach (glob($trash . '*.json') as $f) unlink($f);
rmdir($trash);
rmdir($qdir);
rmdir($base);

// ── summary ───────────────────────────────────────────────────────────────────
echo "\n" . str_repeat('─', 46) . "\n";
echo "Passed: $passed  Failed: $failed\n\n";
exit($failed > 0 ? 1 : 0);
