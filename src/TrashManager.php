<?php

class TrashManager
{
    private string $root;
    private int $retentionSeconds = 604800;

    public function __construct(?string $root = null)
    {
        $this->root = $root ?? __DIR__ . '/../storage/trash';
    }

    public function trash(string $sourcePath): array
    {
        $this->purgeExpired();
        if (!is_file($sourcePath)) {
            return $this->error('源文件不存在');
        }
        if (!$this->ensureRoot()) {
            return $this->error('回收站目录不可用');
        }

        $id = date('Ymd_His') . '_' . bin2hex(random_bytes(8));
        $entryDir = $this->root . DIRECTORY_SEPARATOR . $id;
        if (!mkdir($entryDir, 0777, true)) {
            return $this->error('无法创建回收站条目');
        }

        $storedName = basename($sourcePath);
        $storedPath = $entryDir . DIRECTORY_SEPARATOR . $storedName;
        if (!$this->moveFile($sourcePath, $storedPath)) {
            $this->removeDirectory($entryDir);
            return $this->error('无法移入回收站');
        }

        $metadata = [
            'id' => $id,
            'originalPath' => $sourcePath,
            'originalName' => $storedName,
            'storedName' => $storedName,
            'trashedAt' => date(DATE_ATOM),
            'expiresAt' => date(DATE_ATOM, time() + $this->retentionSeconds),
        ];
        $metadataPath = $entryDir . DIRECTORY_SEPARATOR . 'metadata.json';
        if (file_put_contents($metadataPath, json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            if ($this->moveFile($storedPath, $sourcePath)) {
                $this->removeDirectory($entryDir);
                return $this->error('无法写入回收站记录，文件已保留在原路径');
            }
            return $this->error('无法写入回收站记录，文件已保留在回收站目录');
        }

        return ['status' => 'trashed'] + $metadata;
    }

    public function all(): array
    {
        $this->purgeExpired();
        if (!is_dir($this->root)) return [];

        $items = [];
        foreach (new DirectoryIterator($this->root) as $entry) {
            if ($entry->isDot() || !$entry->isDir()) continue;
            $metadata = $this->readMetadata($entry->getPathname(), $entry->getFilename());
            if ($metadata !== null) $items[] = $metadata;
        }
        usort($items, fn(array $a, array $b) => strcmp($b['trashedAt'], $a['trashedAt']));
        return $items;
    }

    public function restore(string $id): array
    {
        $this->purgeExpired();
        if (!preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
            return $this->error('回收站条目无效');
        }

        $entryDir = $this->root . DIRECTORY_SEPARATOR . $id;
        $metadata = $this->readMetadata($entryDir, $id);
        if ($metadata === null) return $this->error('回收站条目不存在或已损坏');

        $storedPath = $entryDir . DIRECTORY_SEPARATOR . $metadata['storedName'];
        if (!is_file($storedPath)) return $this->error('回收文件不存在');
        if (file_exists($metadata['originalPath']) || is_link($metadata['originalPath'])) {
            return $this->error('原路径已有同名文件，未覆盖');
        }

        $originalDir = dirname($metadata['originalPath']);
        if (!is_dir($originalDir) && !mkdir($originalDir, 0777, true)) {
            return $this->error('无法创建原始目录');
        }
        if (!$this->moveFile($storedPath, $metadata['originalPath'])) {
            return $this->error('无法恢复文件');
        }

        $this->removeDirectory($entryDir);
        return ['status' => 'restored'] + $metadata;
    }

    public function purgeExpired(): int
    {
        if (!is_dir($this->root)) return 0;
        $removed = 0;
        foreach (new DirectoryIterator($this->root) as $entry) {
            if ($entry->isDot() || !$entry->isDir()) continue;
            $metadata = $this->readMetadata($entry->getPathname(), $entry->getFilename());
            if ($metadata === null) continue;
            $expiresAt = strtotime($metadata['expiresAt']);
            if ($expiresAt !== false && $expiresAt <= time() && $this->removeDirectory($entry->getPathname())) {
                $removed++;
            }
        }
        return $removed;
    }

    private function ensureRoot(): bool
    {
        return is_dir($this->root) || mkdir($this->root, 0777, true);
    }

    private function readMetadata(string $entryDir, string $id): ?array
    {
        $metadataPath = $entryDir . DIRECTORY_SEPARATOR . 'metadata.json';
        if (!is_file($metadataPath)) return null;
        $metadata = json_decode(file_get_contents($metadataPath), true);
        if (!is_array($metadata) || ($metadata['id'] ?? '') !== $id) return null;
        foreach (['originalPath', 'originalName', 'storedName', 'trashedAt', 'expiresAt'] as $field) {
            if (!is_string($metadata[$field] ?? null) || $metadata[$field] === '') return null;
        }
        return $metadata;
    }

    private function moveFile(string $from, string $to): bool
    {
        if ($this->tryRename($from, $to)) return true;
        if (!@copy($from, $to)) return false;
        if (@unlink($from)) return true;
        @unlink($to);
        return false;
    }

    protected function tryRename(string $from, string $to): bool
    {
        return @rename($from, $to);
    }

    private function removeDirectory(string $directory): bool
    {
        if (!is_dir($directory)) return true;
        foreach (new DirectoryIterator($directory) as $item) {
            if ($item->isDot()) continue;
            $path = $item->getPathname();
            if ($item->isDir()) {
                if (!$this->removeDirectory($path)) return false;
            } elseif (!@unlink($path)) {
                return false;
            }
        }
        return @rmdir($directory);
    }

    private function error(string $message): array
    {
        return ['status' => 'error', 'message' => $message];
    }
}
