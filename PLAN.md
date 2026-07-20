# 开发计划

## 端口

```
部署端口: 9090
```

---

## 步骤 1：入口 + 路由 + HTML 骨架

**目标**：访问 `http://localhost:9090` 看到页面框架

**文件**：

| 文件 | 作用 |
|------|------|
| `public/index.php` | 路由分发 + 页面入口 |
| `public/assets/app.css` | 样式 |
| `public/assets/app.js` | 前端交互 |

**`public/index.php` 骨架**：

```php
<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($uri === '/') {
    // 加载页面
    readfile(__DIR__ . '/templates/main.html');
    exit;
}
// API 路由
$apiRoutes = [
    '/api/scan'     => 'ScannerController',
    '/api/preview'  => 'RenamePreviewController',
    '/api/execute'  => 'ExecuteController',
    '/api/rollback' => 'RollbackController',
];
if (isset($apiRoutes[$uri])) {
    header('Content-Type: application/json');
    require __DIR__ . '/../src/index.php';
    exit;
}
http_response_code(404);
echo json_encode(['error' => 'Not Found']);
```

**HTML 骨架**（可先直接在 `index.php` 内 echo，后续抽模板）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>文件整理工作台</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="/assets/app.css" rel="stylesheet">
</head>
<body>
    <div class="container-fluid" id="app">
        <h1 class="mt-3">🗂 文件整理工作台</h1>
        <div id="content"></div>
    </div>
    <script src="/assets/app.js"></script>
</body>
</html>
```

---

## 步骤 2：Whitelist.php

**文件**：`src/Whitelist.php`

```php
<?php

class Whitelist
{
    public static function check(string $path): bool
    {
        // 禁止系统目录
        $blocked = ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', '/etc', '/sys', '/proc'];
        foreach ($blocked as $b) {
            if (str_starts_with($path, $b)) {
                return false;
            }
        }
        // 路径必须存在
        return is_dir($path);
    }

    public static function allowedPaths(): array
    {
        return [
            getenv('USERPROFILE') . '\\Downloads',
            getenv('USERPROFILE') . '\\Documents',
            getenv('USERPROFILE') . '\\Desktop',
            'D:\\Downloads',
            'D:\\Docs',
        ];
    }
}
```

**测试**：

```
路径存在 & 不在系统目录 → true
系统目录 → false
不存在路径 → false
```

---

## 步骤 3：Scanner.php + /api/scan

**文件**：`src/Scanner.php`

```php
<?php

class Scanner
{
    // 默认排除隐藏文件和目录
    private array $skipPrefixes = ['.', '_'];

    public function scan(string $path, array $exts = []): array
    {
        $files = [];
        $iterator = new \DirectoryIterator($path);
        foreach ($iterator as $fileinfo) {
            if ($fileinfo->isDot()) continue;
            $name = $fileinfo->getFilename();
            // 跳过隐藏文件
            if (in_array($name[0] ?? '', $this->skipPrefixes, true)) continue;
            // 跳过目录
            if ($fileinfo->isDir()) continue;
            $ext = strtolower($fileinfo->getExtension());
            // 筛选扩展名
            if (!empty($exts) && !in_array($ext, $exts, true)) continue;
            $files[] = [
                'name'   => $name,
                'size'   => $fileinfo->getSize(),
                'mtime'  => $fileinfo->getMTime(),
                'ext'    => $ext,
                'fullPath' => $fileinfo->getPathname(),
            ];
        }
        // 按名称排序
        usort($files, fn($a, $b) => strcmp($a['name'], $b['name']));
        return $files;
    }
}
```

**API 调用**：

```
POST /api/scan
Body: { "path": "D:\\test", "exts": ["jpg","png","pdf"] }
返回: { "files": [...] }
```

---

## 步骤 4：RenameEngine.php + /api/preview

**文件**：`src/RenameEngine.php`

规则执行顺序：

1. 去空格（全角/半角）
2. 去特殊字符（保留中文、字母、数字、横线、下划线、点）
3. 统一小写
4. 扩展名小写
5. 查找替换
6. 加日期前缀
7. 序号填充
8. 加后缀
9. 冲突检测

```php
<?php

class RenameEngine
{
    public function preview(string $path, array $files, array $rules): array
    {
        $mappings = [];
        $index = 0;
        foreach ($files as $file) {
            $name = pathinfo($file['name'], PATHINFO_FILENAME);
            $ext  = pathinfo($file['name'], PATHINFO_EXTENSION);
            $newName = $this->applyRules($name, $ext, $rules, $index);
            $to = $newName . '.' . $ext;
            $mappings[] = [
                'from'     => $file['name'],
                'to'       => $to,
                'conflict' => $file['name'] !== $to && file_exists($path . DIRECTORY_SEPARATOR . $to),
                'changed'  => $file['name'] !== $to,
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
                $n = str_replace($fr['find'], $fr['replace'], $n);
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
```

**API 调用**：

```
POST /api/preview
Body: { "path": "D:\\test", "files": ["1.jpg", "2.png"], "rules": {...} }
返回: { "mappings": [{from, to, conflict, changed}] }
```

---

## 步骤 5：Executor.php + /api/execute

**文件**：`src/Executor.php`

```php
<?php

class Executor
{
    public function execute(string $path, array $mappings, bool $dryRun = true): array
    {
        $results = [];
        foreach ($mappings as $m) {
            if (!$m['changed'] || $m['conflict']) {
                $results[] = [
                    'from'    => $m['from'],
                    'to'      => $m['to'],
                    'status'  => 'skipped',
                    'message' => $m['conflict'] ? '目标文件名已存在' : '无需改动',
                ];
                continue;
            }
            $from = $path . DIRECTORY_SEPARATOR . $m['from'];
            $to   = $path . DIRECTORY_SEPARATOR . $m['to'];
            if ($dryRun) {
                $results[] = [
                    'from'    => $m['from'],
                    'to'      => $m['to'],
                    'status'  => 'dry_run',
                    'message' => 'Dry-run 模式，未执行',
                ];
                continue;
            }
            try {
                rename($from, $to);
                $results[] = [
                    'from'   => $m['from'],
                    'to'     => $m['to'],
                    'status' => 'ok',
                    'message' => '',
                ];
            } catch (\Throwable $e) {
                $results[] = [
                    'from'   => $m['from'],
                    'to'     => $m['to'],
                    'status' => 'error',
                    'message' => $e->getMessage(),
                ];
            }
        }
        // 非 dry-run 写入日志
        if (!$dryRun) {
            $logId = Log::write($results, $path);
            $results['_logId'] = $logId;
        }
        return $results;
    }
}
```

**API 调用**：

```
POST /api/execute
Body: { "path": "D:\\test", "mappings": [{from, to}], "dryRun": true }
返回: { results: [{from, to, status, message}] }
```

---

## 步骤 6：Log.php

**文件**：`src/Log.php`

```php
<?php

class Log
{
    private static string $logDir = __DIR__ . '/../storage/logs';

    public static function write(array $results, string $path): string
    {
        $logId = date('Ymd_His') . '_' . bin2hex(random_bytes(4));
        $entry = [
            'logId'     => $logId,
            'time'      => date('Y-m-d H:i:s'),
            'path'      => $path,
            'mappings'  => $results,
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
        $file = self::$logDir . DIRECTORY_SEPARATOR . $logId . '.json';
        if (!file_exists($file)) return null;
        return json_decode(file_get_contents($file), true);
    }

    public static function all(): array
    {
        $logs = [];
        foreach (glob(self::$logDir . '/*.json') as $file) {
            $logs[] = json_decode(file_get_contents($file), true);
        }
        // 按时间倒序
        usort($logs, fn($a, $b) => strcmp($b['time'], $a['time']));
        return $logs;
    }

    public static function rollback(string $logId): array
    {
        $entry = self::get($logId);
        if (!$entry || $entry['rolledBack']) {
            return ['error' => '无法回滚', 'results' => []];
        }
        $results = [];
        foreach ($entry['mappings'] as $m) {
            if ($m['status'] !== 'ok') continue;
            $from = $entry['path'] . DIRECTORY_SEPARATOR . $m['to'];
            $to   = $entry['path'] . DIRECTORY_SEPARATOR . $m['from'];
            if (!file_exists($from)) {
                $results[] = ['from' => $m['to'], 'to' => $m['from'], 'status' => 'error', 'message' => '源文件不存在'];
                continue;
            }
            rename($from, $to);
            $results[] = ['from' => $m['to'], 'to' => $m['from'], 'status' => 'ok', 'message' => ''];
        }
        // 标记已回滚
        $entry['rolledBack'] = true;
        $entry['rolledBackAt'] = date('Y-m-d H:i:s');
        $entry['rollbackResults'] = $results;
        file_put_contents(
            self::$logDir . DIRECTORY_SEPARATOR . $logId . '.json',
            json_encode($entry, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
        return ['logId' => $logId, 'results' => $results];
    }
}
```

**API 调用**：

```
POST /api/rollback
Body: { "logId": "20260327_160000_abcd1234" }
返回: { results: [{from, to, status}] }
```

---

## 步骤 7：前端交互

**文件**：`public/assets/app.js`

核心流程：

```
1. 用户输入路径 → scan() → 渲染文件列表
2. 选择规则 → preview() → 渲染 diff 对比表
3. 用户勾选 → execute() → 显示结果
4. 日志页 → 显示历史操作 → 可点击回滚
```

---

## 步骤 8：边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 路径不存在 | `/api/scan` 返回 `{error: "路径不存在"}` |
| 白名单拦截 | 返回 `{error: "路径不在白名单"}` |
| 空目录 | 返回 `{files: []}` |
| 文件数超 2000 | 提示上限，只处理前 2000 个 |
| 重名冲突 | `conflict: true` 标红，执行时跳过 |
| 改名后和原来一样 | `changed: false` 跳过 |
| Dry-run | 所有操作标记为 `dry_run` 不落盘 |
| 执行失败 | `status: error` 展示具体原因 |
| 回滚时文件已被删 | `status: error` 提示源文件不存在 |
