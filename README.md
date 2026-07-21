# 文件整理工作台

带 GUI 的本地文件整理工具。选目录 → 可视化配置规则 → 预览 diff → 勾选执行 → 操作日志 → 可回滚。目标是在不改动原文件前让你看清结果。

## 快速启动

```powershell
cd D:\tools\file-workbench
php -S localhost:9090 -t public
start http://localhost:9090
```

---

## 功能清单

### MVP（第一期）

| 模块 | 功能 | 说明 |
|------|------|------|
| 目录选择 | 输入路径 + 浏览选择 | 限制在白名单范围内 |
| 文件列表 | 扫描展示 | 名称/大小/类型/修改时间，支持按扩展名筛选 |
| 重命名规则 | 可视化勾选 | 去空格、去特殊字符、统一大小写、加日期前缀、序号填充、扩展名小写、字符串查找替换 |
| 预览 diff | 执行前对照 | 原名 → 新名，冲突标红 |
| 勾选执行 | 勾选要处理的文件 | 只处理选中项 |
| Dry-run | 默认开启 | 只看预览不动文件 |
| 结果展示 | 成功/失败列表 | 失败原因可查看 |
| 操作日志 | 记录每次改名映射 | 用于追溯和回滚 |

### 第二期

| 功能 | 说明 |
|------|------|
| 按类型归档 | 图片/文档/视频分到子目录 |
| 重复文件检测 | 按 hash 找出重复，确认后移入项目回收站；7 天内可恢复 |
| 时间归档 | 按修改日期建 YYYY/MM 文件夹 |
| 回滚 | 按操作日志把文件名改回去 |
| 规则模板 | 保存/加载 JSON 配置 |
| 大目录异步处理 | 队列 + 进度条 |

---

## 安全约束

- 默认开启 **Dry-run**，确认后才执行
- 路径白名单（如 `D:\Downloads`、`D:\Docs` 等）
- 禁止处理系统目录（`C:\Windows`、`/etc`）
- 重名冲突检测：不覆盖，冲突自动添加序号后缀
- 单次处理上限：2000 个文件

---

## 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 运行 | PHP 8.x `php -S localhost:9090 -t public` | 内置服务器，零配置；不要求 mbstring 扩展 |
| 后端 | 原生 PHP，无框架 | 接口可控、依赖少 |
| 前端 | HTML + CSS + 原生 JS | 或 + Bootstrap 5 |
| 通信 | fetch JSON API | 三个接口即可 |
| 存储 | JSON 日志文件 | 记录 rename 映射 |
| 依赖 | 零 Composer 依赖 | MVP 全用 `scandir` / `rename` 等内置函数 |

---

## 目录结构

```
file-workbench/
├── public/
│   ├── index.php           # 入口，加载页面
│   ├── assets/
│   │   ├── app.css         # Bootstrap 样式覆盖
│   │   └── app.js          # 前端交互逻辑
│   └── favicon.ico
├── src/
│   ├── Scanner.php         # 扫描目录，返回文件列表
│   ├── RenameEngine.php    # 规则引擎：应用规则 → 预览映射
│   ├── Executor.php        # 执行 rename + 写日志
│   ├── Whitelist.php       # 白名单路径校验
│   └── Log.php             # 操作日志读写 + 回滚
├── storage/
│   └── logs/               # 操作日志 JSON
│   └── trash/              # 重复文件回收站，条目保留 7 天
├── PLAN.md                 # 开发步骤
└── README.md               # 本文件
```

---

## API 接口设计

| 接口 | 方法 | 参数 | 返回 |
|------|------|------|------|
| `/api/scan` | POST | `{path, exts: ["jpg","pdf"]}` | `{files: [{name, size, mtime, ext}]}` |
| `/api/preview` | POST | `{path, files: ["1.jpg"], rules: {...}}` | `{mappings: [{from, to, conflict}]}` |
| `/api/execute` | POST | `{path, mappings: [{from, to}], dryRun: true}` | `{results: [{from, to, status}]}` |
| `/api/rollback` | POST | `{logId}` | `{results: [{from, to, status}]}` |

### rules 格式

```json
{
    "remove_spaces": true,
    "remove_special_chars": true,
    "lowercase": true,
    "add_date_prefix": true,
    "date_format": "Ymd",
    "add_sequence": true,
    "sequence_padding": 3,
    "add_suffix": "",
    "ext_lowercase": true,
    "find_replace": [
        {"find": "old", "replace": "new"}
    ]
}
```

---

## 核心类说明

### Scanner.php

```php
class Scanner {
    public function scan(string $path, array $exts = []): array
    // 返回: [{name, size, mtime, ext, fullPath}]
    // 排序: 文件在前按名称排序，目录最后
}
```

### RenameEngine.php

```php
class RenameEngine {
    public function preview(string $path, array $files, array $rules): array
    // 返回: [{from, to, conflict}]
    // conflict: 目标文件名已存在时设为 true
}
```

### Executor.php

```php
class Executor {
    public function execute(array $mappings, string $path): array
    // 返回: [{from, to, status: 'ok'|'error', message}]
    // 执行后写入操作日志
}
```

### Log.php

```php
class Log {
    public static function write(array $mappings, string $path): string
    // 返回 logId
    public static function get(string $logId): ?array
    public static function rollback(string $logId): array
    // 回滚：reverse mappings + 标记已回滚
}
```

### Whitelist.php

```php
class Whitelist {
    public static function check(string $path): bool
    // 校验路径是否在白名单内且不是系统目录
    public static function allowedPaths(): array
    // 返回允许的根目录前缀列表
}
```

---

## 界面布局

```
┌──────────────────────────────────────────────────────────┐
│  🗂 文件整理工作台                    [Dry-run ✓] [执行]   │
├─────────────────────┬────────────────────────────────────┤
│ 1. 选择目录          │  3. 文件列表（筛选、勾选）           │
│  [📁 浏览] D:\docs  │  □ 名称            大小   修改时间   │
│                      │  ☑ photo 1.jpg   1.2MB  2026-03-27 │
│ 2. 重命名规则        │  ☑ 报告(1).pdf   800KB  2026-03-26 │
│ ☐ 去空格            │  □ readme.txt     2KB   2026-03-25 │
│ ☐ 去特殊字符        │                                      │
│ ☑ 统一小写          ├──────────────────────────────────────┤
│ ☑ 加日期前缀        │  4. 预览（原名 → 新名）               │
│ ☐ 序号填充 [3]位    │  photo 1.jpg → 20260327_photo_1.jpg │
│ ☐ 扩展名小写        │  "报告(1).pdf" → "报告1.pdf"        │
│ ☐ 替换 [_____]→[__] │  [✔ 执行成功 23个 / ❌ 失败 0个]    │
│                      │                                      │
│                      │  5. 操作日志 / 回滚                  │
└─────────────────────┴──────────────────────────────────────┘
```

---

## 开发步骤

| 步骤 | 内容 | 产出 |
|------|------|------|
| 1 | 搭 `index.php` 路由 + HTML 骨架 | 页面能打开 |
| 2 | 实现 `src/Whitelist.php` | 路径校验 |
| 3 | 实现 `src/Scanner.php` + `/api/scan` | 能扫目录出列表 |
| 4 | 前端文件列表渲染 | 表格显示 + 勾选 |
| 5 | 实现 `src/RenameEngine.php` + `/api/preview` | 能预览 diff |
| 6 | 前端 diff 表格 + 冲突标红 | 预览可视化 |
| 7 | 实现 `src/Executor.php` + `/api/execute` | 能真正改名 |
| 8 | 实现 Dry-run 模式 | 默认不执行 |
| 9 | 实现 `src/Log.php` + 操作日志 | 改名可追溯 |
| 10 | 回滚功能（二期） | 按日志回退 |
| 11 | P0 测试 + 边界处理 | 可用 |

---

## 接口实现骨架

### POST `/api/scan`

```php
// public/index.php 路由分发
$path = $_POST['path'];
if (!Whitelist::check($path)) {
    exit(json_encode(['error' => '路径不在白名单']));
}
$files = (new Scanner())->scan($path, $_POST['exts'] ?? []);
echo json_encode(['files' => $files]);
```

### 前端主循环

```js
// public/assets/app.js
async function scan() {
    const files = await fetch('/api/scan', {method:'POST', body: formData}).then(r => r.json());
    renderFileList(files);
}
async function preview() {
    const mappings = await fetch('/api/preview', {method:'POST', body: formData}).then(r => r.json());
    renderDiff(mappings);
}
async function execute() {
    const result = await fetch('/api/execute', {method:'POST', body: formData}).then(r => r.json());
    showResult(result);
}
```

---

## 部署方式

```powershell
cd D:\tools\file-workbench
php -S localhost:9090 -t public
```

浏览器打开 `http://localhost:9090`。
