<?php

class Whitelist
{
    private static array $blockedPrefixes = [
        'C:\\Windows',
        'C:\\Program Files',
        'C:\\Program Files (x86)',
        '/etc',
        '/sys',
        '/proc',
    ];

    public static function check(string $path): bool
    {
        $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        $real = realpath($path);
        if ($real === false) {
            return false;
        }
        foreach (self::$blockedPrefixes as $blocked) {
            $blocked = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $blocked);
            if (str_starts_with($real, $blocked)) {
                return false;
            }
        }
        return true;
    }

    public static function allowedPaths(): array
    {
        return [
            getenv('USERPROFILE') . '\\Downloads',
            getenv('USERPROFILE') . '\\Documents',
            getenv('USERPROFILE') . '\\Desktop',
        ];
    }
}
