<?php

class Scanner
{
    private array $skipPrefixes = ['.', '_'];

    public function scan(string $path, array $exts = []): array
    {
        $files = [];
        $path = rtrim($path, '\\/');

        if (!is_dir($path)) {
            return [];
        }

        $iterator = new DirectoryIterator($path);
        foreach ($iterator as $fileinfo) {
            if ($fileinfo->isDot()) continue;

            $name = $fileinfo->getFilename();

            if ($fileinfo->isDir()) continue;

            $first = mb_substr($name, 0, 1);
            if (in_array($first, $this->skipPrefixes, true)) continue;

            $ext = strtolower($fileinfo->getExtension());

            if (!empty($exts) && !in_array($ext, $exts, true)) continue;

            $files[] = [
                'name'     => $name,
                'size'     => $fileinfo->getSize(),
                'mtime'    => $fileinfo->getMTime(),
                'ext'      => $ext,
                'fullPath' => $fileinfo->getPathname(),
            ];
        }

        usort($files, fn($a, $b) => strcmp($a['name'], $b['name']));

        return $files;
    }
}
