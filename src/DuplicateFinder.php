<?php

require_once __DIR__ . '/Progress.php';

class DuplicateFinder
{
    private int $maxFiles = 5000;

    public function find(string $path): array
    {
        $path = rtrim($path, '\\/');
        if (!is_dir($path)) {
            return ['error' => '路径不存在', 'groups' => []];
        }

        Progress::set('duplicate', 0, 0, 'scanning');
        $files = $this->collectFiles($path);
        if (count($files) > $this->maxFiles) {
            Progress::clear();
            return ['error' => "文件数过多（{$this->maxFiles} 上限），请缩小范围", 'groups' => []];
        }

        $bySize = [];
        foreach ($files as $f) {
            $bySize[$f['size']][] = $f;
        }

        $groups = [];
        $totalGroups = count($bySize);
        $progressI = 0;

        foreach ($bySize as $size => $sameSize) {
            if (count($sameSize) < 2) { $progressI++; continue; }

            $byHash = [];
            foreach ($sameSize as $f) {
                $hash = md5_file($f['fullPath']);
                if ($hash === false) continue;
                $byHash[$hash][] = $f;
            }

            foreach ($byHash as $hash => $sameHash) {
                if (count($sameHash) < 2) continue;

                usort($sameHash, fn($a, $b) => $a['mtime'] - $b['mtime']);
                $keeper = $sameHash[0];
                $dupes = array_slice($sameHash, 1);

                $files = array_map(fn($f) => [
                    'name'   => $f['name'],
                    'size'   => $f['size'],
                    'mtime'  => $f['mtime'],
                    'hash'   => $hash,
                    'keeper' => $f['fullPath'] === $keeper['fullPath'],
                ], $sameHash);

                $groups[] = [
                    'total_size' => $size * count($sameHash),
                    'wasted'     => $size * count($dupes),
                    'files'      => $files,
                ];
            }
            $progressI++;
            if ($progressI % 50 === 0) {
                Progress::set('duplicate', $progressI, $totalGroups, 'hashing');
            }
        }

        usort($groups, fn($a, $b) => $b['wasted'] - $a['wasted']);

        Progress::clear();
        return ['groups' => $groups];
    }

    private function collectFiles(string $path): array
    {
        $files = [];
        $iterator = new DirectoryIterator($path);

        foreach ($iterator as $fileinfo) {
            if ($fileinfo->isDot()) continue;
            if ($fileinfo->isDir()) continue;
            $name = $fileinfo->getFilename();
            if (in_array($name[0] ?? '', ['.', '_'], true)) continue;
            if ($fileinfo->getSize() === 0) continue;

            $files[] = [
                'name'     => $name,
                'size'     => $fileinfo->getSize(),
                'mtime'    => $fileinfo->getMTime(),
                'fullPath' => $fileinfo->getPathname(),
            ];
        }

        return $files;
    }

    public static function clean(string $path, array $files): array
    {
        $results = [];
        foreach ($files as $f) {
            $fullPath = $path . DIRECTORY_SEPARATOR . $f;
            if (!file_exists($fullPath)) {
                $results[] = ['file' => $f, 'status' => 'error', 'message' => '文件不存在'];
                continue;
            }
            try {
                unlink($fullPath);
                $results[] = ['file' => $f, 'status' => 'ok', 'message' => ''];
            } catch (\Throwable $e) {
                $results[] = ['file' => $f, 'status' => 'error', 'message' => $e->getMessage()];
            }
        }
        return $results;
    }
}
