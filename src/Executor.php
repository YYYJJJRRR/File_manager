<?php

class Executor
{
    private int $maxFiles = 2000;

    public function execute(string $path, array $mappings, bool $dryRun = true): array
    {
        $path = rtrim($path, '\\/');
        $results = [];

        if (count($mappings) > $this->maxFiles) {
            return ['error' => "单次处理上限为 {$this->maxFiles} 个文件", 'results' => []];
        }

        foreach ($mappings as $m) {
            $fromName = $m['from'] ?? '';
            $toName   = $m['to'] ?? '';

            if ($fromName === $toName) {
                $results[] = $this->makeResult($fromName, $toName, 'skipped', '无需改动');
                continue;
            }

            if (!empty($m['conflict'])) {
                $results[] = $this->makeResult($fromName, $toName, 'skipped', '目标文件已存在，跳过');
                continue;
            }

            $fromPath = $path . DIRECTORY_SEPARATOR . $fromName;
            $toPath   = $path . DIRECTORY_SEPARATOR . $toName;

            if (!file_exists($fromPath)) {
                $results[] = $this->makeResult($fromName, $toName, 'error', '源文件不存在');
                continue;
            }

            if ($dryRun) {
                $results[] = $this->makeResult($fromName, $toName, 'dry_run', 'Dry-run 模式，未执行');
                continue;
            }

            try {
                if (!is_writable($path)) {
                    throw new RuntimeException('目录不可写');
                }
                if (!rename($fromPath, $toPath)) {
                    throw new RuntimeException('rename 失败');
                }
                $results[] = $this->makeResult($fromName, $toName, 'ok', '');
            } catch (\Throwable $e) {
                $results[] = $this->makeResult($fromName, $toName, 'error', $e->getMessage());
            }
        }

        $logId = null;
        if (!$dryRun) {
            $logId = Log::write($results, $path);
        }

        $response = ['results' => $results];
        if ($logId !== null) {
            $response['_logId'] = $logId;
        }

        return $response;
    }

    private function makeResult(string $from, string $to, string $status, string $message): array
    {
        return [
            'from'    => $from,
            'to'      => $to,
            'status'  => $status,
            'message' => $message,
        ];
    }
}
