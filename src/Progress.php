<?php

class Progress
{
    private static string $progressFile = __DIR__ . '/../storage/progress.json';

    public static function set(string $task, int $current, int $total, string $status = 'running'): void
    {
        file_put_contents(self::$progressFile, json_encode([
            'task'    => $task,
            'current' => $current,
            'total'   => $total,
            'pct'     => $total > 0 ? round($current / $total * 100, 1) : 0,
            'status'  => $status,
            'updated' => date('H:i:s'),
        ]));
    }

    public static function get(): ?array
    {
        if (!file_exists(self::$progressFile)) return null;
        $data = json_decode(file_get_contents(self::$progressFile), true);
        return $data;
    }

    public static function clear(): void
    {
        if (file_exists(self::$progressFile)) {
            unlink(self::$progressFile);
        }
    }
}
