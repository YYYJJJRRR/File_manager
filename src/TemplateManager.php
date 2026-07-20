<?php

class TemplateManager
{
    private static string $templateDir = __DIR__ . '/../storage/templates';

    public static function all(): array
    {
        self::ensureDir();
        $templates = [];
        $files = glob(self::$templateDir . '/*.json');
        if ($files === false) return [];

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data !== null) {
                $templates[] = [
                    'name' => $data['name'],
                    'rules' => $data['rules'],
                    'created_at' => $data['created_at'] ?? '',
                ];
            }
        }
        usort($templates, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
        return $templates;
    }

    public static function save(string $name, array $rules): array
    {
        self::ensureDir();
        $fileName = self::sanitizeName($name) . '.json';
        $data = [
            'name'       => $name,
            'rules'      => $rules,
            'created_at' => date('Y-m-d H:i:s'),
        ];
        file_put_contents(
            self::$templateDir . DIRECTORY_SEPARATOR . $fileName,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
        return $data;
    }

    public static function delete(string $name): bool
    {
        self::ensureDir();
        $file = self::$templateDir . DIRECTORY_SEPARATOR . self::sanitizeName($name) . '.json';
        if (file_exists($file)) {
            unlink($file);
            return true;
        }
        return false;
    }

    private static function sanitizeName(string $name): string
    {
        $name = preg_replace('/[^\p{Han}\w\-]/u', '_', $name);
        return $name ?: 'template';
    }

    private static function ensureDir(): void
    {
        if (!is_dir(self::$templateDir)) {
            mkdir(self::$templateDir, 0777, true);
        }
    }
}
