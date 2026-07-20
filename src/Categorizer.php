<?php

class Categorizer
{
    private static array $typeMap = [
        'images'   => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'],
        'docs'     => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'],
        'videos'   => ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'],
        'audios'   => ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'],
        'archives' => ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        'code'     => ['php', 'js', 'ts', 'css', 'scss', 'html', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h'],
    ];

    public static function getType(string $ext): ?string
    {
        $ext = strtolower($ext);
        foreach (self::$typeMap as $type => $exts) {
            if (in_array($ext, $exts, true)) {
                return $type;
            }
        }
        return null;
    }

    public static function getTypeLabel(string $type): string
    {
        $labels = [
            'images'   => '图片',
            'docs'     => '文档',
            'videos'   => '视频',
            'audios'   => '音频',
            'archives' => '压缩包',
            'code'     => '代码',
        ];
        return $labels[$type] ?? $type;
    }

    public static function allTypes(): array
    {
        return array_keys(self::$typeMap);
    }
}
