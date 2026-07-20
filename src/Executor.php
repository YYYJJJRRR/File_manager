<?php

require_once __DIR__ . '/Progress.php';

class Executor
{
    private int $maxFiles = 2000;
    private int $progressInterval = 50;

    public function execute(string $path, array $mappings, bool $dryRun = true): array
    {
        $path = rtrim($path, '\\/');
        $results = [];
        $total = count($mappings);

        if ($total > $this->maxFiles) {
            Progress::set('execute', 0, $total, 'error');
            return ['error' => "单次处理上限为 {$this->maxFiles} 个文件", 'results' => []];
        }

        if ($total > 200) {
            Progress::set('execute', 0, $total, 'running');
        }

        foreach ($mappings as $i => $m) {
            $fromName = $m['from'] ?? '';
            $toName   = $m['to'] ?? '';

            if ($fromName === $toName) {
                $results[] = $this->makeResult($fromName, $toName, 'skipped', '无需改动');
                $this->updateProgress($i + 1, $total);
                continue;
            }

            if (!empty($m['conflict'])) {
                $results[] = $this->makeResult($fromName, $toName, 'skipped', '目标文件已存在，跳过');
                $this->updateProgress($i + 1, $total);
                continue;
            }

            $fromPath = $path . DIRECTORY_SEPARATOR . $fromName;
            $toPath   = $path . DIRECTORY_SEPARATOR . $toName;

            if (!file_exists($fromPath)) {
                $results[] = $this->makeResult($fromName, $toName, 'error', '源文件不存在');
                $this->updateProgress($i + 1, $total);
                continue;
            }

            if ($dryRun) {
                $results[] = $this->makeResult($fromName, $toName, 'dry_run', 'Dry-run 模式，未执行');
                $this->updateProgress($i + 1, $total);
                continue;
            }

            try {
                if (!is_writable($path)) {
                    throw new RuntimeException('目录不可写');
                }
                $toDir = dirname($toPath);
                if (!is_dir($toDir)) {
                    if (!mkdir($toDir, 0777, true)) {
                        throw new RuntimeException('无法创建目录: ' . $toDir);
                    }
                }
                if (!rename($fromPath, $toPath)) {
                    throw new RuntimeException('rename 失败');
                }
                $results[] = $this->makeResult($fromName, $toName, 'ok', '');
            } catch (\Throwable $e) {
                $results[] = $this->makeResult($fromName, $toName, 'error', $e->getMessage());
            }
            $this->updateProgress($i + 1, $total);
        }

        if ($total > 200) {
            Progress::set('execute', $total, $total, 'done');
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

    private function updateProgress(int $current, int $total): void
    {
        if ($total > 200 && $current % $this->progressInterval === 0) {
            Progress::set('execute', $current, $total, 'running');
        }
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
