<?php

require_once __DIR__ . '/../src/Scanner.php';

function assertSameValue(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
}

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'file_manager_scanner_' . bin2hex(random_bytes(4));
mkdir($directory);
file_put_contents($directory . DIRECTORY_SEPARATOR . '报告.pdf', 'test');

try {
    $files = (new Scanner())->scan($directory);
    assertSameValue('报告.pdf', $files[0]['name'] ?? null, 'Scanner should support Unicode file names even when mbstring is unavailable.');
    echo "PASS: Scanner supports hosts without mbstring.\n";
} finally {
    @unlink($directory . DIRECTORY_SEPARATOR . '报告.pdf');
    @rmdir($directory);
}
