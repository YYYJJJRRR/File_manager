<?php

class Log
{
    private static string $logDir = __DIR__ . '/../storage/logs';

    public static function write(array $results, string $path): string
    {
        self::ensureLogDir();

        $logId = date('Ymd_His') . '_' . bin2hex(random_bytes(4));
        $entry = [
            'logId'      => $logId,
            'time'       => date('Y-m-d H:i:s'),
            'path'       => $path,
            'results'    => $results,
            'rolledBack' => false,
        ];

        file_put_contents(
            self::$logDir . DIRECTORY_SEPARATOR . $logId . '.json',
            json_encode($entry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return $logId;
    }

    public static function get(string $logId): ?array
    {
        self::ensureLogDir();

        $file = self::$logDir . DIRECTORY_SEPARATOR . $logId . '.json';
        if (!file_exists($file)) {
            return null;
        }

        return json_decode(file_get_contents($file), true);
    }

    public static function all(): array
    {
        self::ensureLogDir();

        $logs = [];
        $files = glob(self::$logDir . '/*.json');
        if ($files === false) {
            return [];
        }

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data !== null) {
                $logs[] = $data;
            }
        }

        usort($logs, fn($a, $b) => strcmp($b['time'] ?? '', $a['time'] ?? ''));

        return $logs;
    }

    public static function rollback(string $logId): array
    {
        $entry = self::get($logId);
        if ($entry === null) {
            return ['error' => '日志不存在', 'results' => []];
        }
        if ($entry['rolledBack']) {
            return ['error' => '该操作已回滚，不能重复回滚', 'results' => []];
        }

        $rollbackResults = [];
        foreach ($entry['results'] as $r) {
            if (($r['status'] ?? '') !== 'ok') continue;

            $fromName = $r['to'];
            $toName   = $r['from'];
            $fromPath = $entry['path'] . DIRECTORY_SEPARATOR . $fromName;
            $toPath   = $entry['path'] . DIRECTORY_SEPARATOR . $toName;

            if (!file_exists($fromPath)) {
                $rollbackResults[] = [
                    'from'    => $fromName,
                    'to'      => $toName,
                    'status'  => 'error',
                    'message' => '源文件不存在，无法回滚',
                ];
                continue;
            }

            try {
                rename($fromPath, $toPath);
                $rollbackResults[] = [
                    'from'    => $fromName,
                    'to'      => $toName,
                    'status'  => 'ok',
                    'message' => '',
                ];
            } catch (\Throwable $e) {
                $rollbackResults[] = [
                    'from'    => $fromName,
                    'to'      => $toName,
                    'status'  => 'error',
                    'message' => $e->getMessage(),
                ];
            }
        }

        $entry['rolledBack'] = true;
        $entry['rolledBackAt'] = date('Y-m-d H:i:s');
        $entry['rollbackResults'] = $rollbackResults;

        file_put_contents(
            self::$logDir . DIRECTORY_SEPARATOR . $logId . '.json',
            json_encode($entry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return ['logId' => $logId, 'results' => $rollbackResults];
    }

    public static function list(): array
    {
        $logs = self::all();
        return array_map(fn($l) => [
            'logId'      => $l['logId'] ?? '',
            'time'       => $l['time'] ?? '',
            'path'       => $l['path'] ?? '',
            'fileCount'  => count($l['results'] ?? []),
            'rolledBack' => $l['rolledBack'] ?? false,
        ], $logs);
    }

    private static function ensureLogDir(): void
    {
        if (!is_dir(self::$logDir)) {
            mkdir(self::$logDir, 0777, true);
        }
    }
}
