# 文件整理工作台

带 GUI 的本地文件批量整理工具。**选目录 → 配规则 → 预览确认 → 执行 → 可回滚**，所有操作默认 Dry-run，不改动前让你看清结果。

## 快速启动

```powershell
cd D:\tools\file-workbench
php -S 127.0.0.1:9090 -t public
start http://127.0.0.1:9090
```

**唯一依赖**：PHP 8.0+ CLI（无需额外扩展、无需 Composer、无需数据库）

---

## 功能清单

### 重命名规则（7 种，可任意组合）

| 规则 | 说明 | 示例 |
|------|------|------|
| 去空格 | 移除文件名中的空格 | `photo 1.jpg` → `photo1.jpg` |
| 去特殊字符 | 保留中文、字母、数字、横线 | `报告(1).pdf` → `报告1.pdf` |
| 统一小写 | 字母转为小写 | `Script.js` → `script.js` |
| 扩展名小写 | 扩展名转为小写 | `Script.JS` → `Script.js` |
| 加日期前缀 | 按当天日期加前缀 | `readme.txt` → `20260722_readme.txt` |
| 序号填充 | 按处理顺序编号 | 第 3 个 → `003_readme.txt` |
| 查找替换 | 替换指定字符串 | `photo` → `img` → `img1.jpg` |

### 归档功能

| 功能 | 效果 |
|------|------|
| 按类型归档 | `photo.jpg` → `images/photo.jpg`（图片/文档/视频/音频/压缩包/代码 6 类） |
| 按时间归档 | `2026-03.doc` → `2026/03/2026-03.doc`（按修改日期建 YYYY/MM 目录） |
| 两者可叠加 | `photo.jpg` → `2026/03/images/photo.jpg` |

### 安全体系

| 措施 | 说明 |
|------|------|
| Dry-run 默认开启 | 执行前必须手动关闭，只预览不改动 |
| 系统目录拦截 | `C:\Windows`、`/etc` 等系统路径禁止操作 |
| 路径不存在校验 | 返回可读错误提示 |
| 冲突检测 | 目标文件已存在时自动跳过，不覆盖 |
| 单次处理上限 | 最多 2000 个文件，防止内存溢出 |
| 确认弹窗 | 执行前显示改动摘要 + 文件清单，确认后才执行 |
| **回收站机制** | 重复文件删除时移入 `storage/trash/`，保留 7 天可恢复 |
| 操作日志回滚 | 每次改名记录日志，可一键回滚恢复 |

### 界面功能

| 功能 | 说明 |
|------|------|
| 文件列表排序 | 点击表头按名称/大小/类型/时间排序，再次点击切换升降序 |
| 搜索过滤 | 输入关键字实时过滤文件名 |
| 扩展名筛选 | 扫描时按 `jpg,png,pdf` 过滤文件 |
| 全选/取消 | 表头复选框控制全部勾选 |
| 预览 diff | 原名 → 新名对照表，冲突行黄色高亮 |
| 操作日志 | 底部通栏展示，点击日志行自动填入路径并扫描 |
| 回收站面板 | 查看已移入回收站的文件，支持一键恢复 |

### 扩展功能

| 功能 | 说明 |
|------|------|
| 规则模板 | 保存/加载/删除常用规则组合（JSON 文件） |
| 重复文件检测 | 按大小 + MD5 哈希查找，勾选后移入回收站 |
| 大目录进度条 | 执行改名超过 200 文件时显示实时进度百分比 |
| 头状态栏 | 实时显示当前路径、文件数、重复数 |

---

## API 接口

| 接口 | 方法 | 用途 |
|------|------|------|
| `/api/scan` | POST | 扫描目录，返回文件列表 |
| `/api/preview` | POST | 按规则预览改名映射 |
| `/api/execute` | POST | 执行改名（支持 Dry-run） |
| `/api/rollback` | POST | 按日志回滚操作 |
| `/api/logs` | POST | 获取操作日志列表 |
| `/api/duplicates` | POST | 检测目录下重复文件 |
| `/api/duplicates/clean` | POST | 将重复文件移入回收站 |
| `/api/trash` | POST | 回收站文件列表 |
| `/api/trash/restore` | POST | 从回收站恢复文件 |
| `/api/templates` | POST | 规则模板列表 |
| `/api/template/save` | POST | 保存规则模板 |
| `/api/template/delete` | POST | 删除规则模板 |
| `/api/progress` | POST | 查询执行进度 |

---

## 技术栈

| 层 | 选型 |
|----|------|
| 运行时 | PHP 8.x `php -S` 内置服务器 |
| 后端 | 原生 PHP，零 Composer/零框架 |
| 前端 | 纯 HTML + CSS + JS，无第三方 UI 框架 |
| 存储 | JSON 文件（日志/模板/回收站元数据） |
| 字体 | Plus Jakarta Sans（显示）、Inter（正文）、JetBrains Mono（代码） |

---

## 目录结构

```
file-workbench/
├── public/
│   ├── index.php              # 路由入口
│   ├── templates/main.html    # 页面骨架
│   └── assets/
│       ├── app.css             # 样式（完整设计系统）
│       └── app.js              # 前端交互逻辑
├── src/
│   ├── index.php               # API 调度器
│   ├── Whitelist.php           # 路径白名单校验
│   ├── Scanner.php             # 目录扫描
│   ├── RenameEngine.php        # 重命名规则引擎
│   ├── Categorizer.php         # 文件类型分类映射
│   ├── Executor.php            # 执行改名校验
│   ├── Log.php                 # 操作日志 + 回滚
│   ├── Progress.php            # 进度追踪
│   ├── TemplateManager.php     # 规则模板管理
│   ├── DuplicateFinder.php     # 重复文件检测
│   └── TrashManager.php        # 回收站管理
├── storage/
│   ├── logs/                   # 操作日志 JSON
│   ├── trash/                  # 回收站（7 天自动清理）
│   └── templates/              # 规则模板 JSON
├── .gitignore
├── README.md
└── PLAN.md
```

---

## 启动方式

```powershell
php -S 127.0.0.1:9090 -t public
```

浏览器打开 `http://127.0.0.1:9090`。
