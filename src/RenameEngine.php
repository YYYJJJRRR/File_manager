<?php

class RenameEngine
{
    public function preview(string $path, array $files, array $rules): array
    {
        $mappings = [];
        $index = 0;

        foreach ($files as $file) {
            $fileName = is_string($file) ? $file : ($file['name'] ?? '');
            $name = pathinfo($fileName, PATHINFO_FILENAME);
            $ext  = pathinfo($fileName, PATHINFO_EXTENSION);

            $newName = $this->applyRules($name, $ext, $rules, $index);
            $to = $newName . '.' . $ext;

            $mappings[] = [
                'from'     => $fileName,
                'to'       => $to,
                'conflict' => $fileName !== $to && file_exists($path . DIRECTORY_SEPARATOR . $to),
                'changed'  => $fileName !== $to,
            ];
            $index++;
        }

        return $mappings;
    }

    private function applyRules(string $name, string &$ext, array $rules, int $index): string
    {
        $n = $name;

        if (!empty($rules['remove_spaces'])) {
            $n = preg_replace('/\s+/', '', $n);
        }

        if (!empty($rules['remove_special_chars'])) {
            $n = preg_replace('/[^\p{Han}\w\-\.]/u', '', $n);
        }

        if (!empty($rules['lowercase'])) {
            $n = mb_strtolower($n);
        }

        if (!empty($rules['ext_lowercase'])) {
            $ext = strtolower($ext);
        }

        if (!empty($rules['find_replace'])) {
            foreach ($rules['find_replace'] as $fr) {
                if (isset($fr['find'], $fr['replace'])) {
                    $n = str_replace($fr['find'], $fr['replace'], $n);
                }
            }
        }

        $prefix = '';
        if (!empty($rules['add_date_prefix'])) {
            $fmt = $rules['date_format'] ?? 'Ymd';
            $prefix = date($fmt) . '_';
        }

        $seq = '';
        if (!empty($rules['add_sequence'])) {
            $pad = $rules['sequence_padding'] ?? 3;
            $seq = str_pad($index + 1, $pad, '0', STR_PAD_LEFT) . '_';
        }

        return $prefix . $seq . $n . ($rules['add_suffix'] ?? '');
    }
}
