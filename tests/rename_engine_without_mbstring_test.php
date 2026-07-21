<?php

require_once __DIR__ . '/../src/RenameEngine.php';

function assertSameValue(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
    }
}

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'file_manager_rename_' . bin2hex(random_bytes(4));
mkdir($directory);
file_put_contents($directory . DIRECTORY_SEPARATOR . 'REPORT-报告.PDF', 'test');

try {
    $mappings = (new RenameEngine())->preview($directory, ['REPORT-报告.PDF'], ['lowercase' => true, 'ext_lowercase' => true]);
    assertSameValue('report-报告.pdf', $mappings[0]['to'] ?? null, 'Rename preview should lowercase ASCII names without requiring mbstring.');
    echo "PASS: RenameEngine supports hosts without mbstring.\n";
} finally {
    @unlink($directory . DIRECTORY_SEPARATOR . 'REPORT-报告.PDF');
    @rmdir($directory);
}
