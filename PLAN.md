# 开发计划

## 端口

```
部署端口: 9090
```

---

## 已完成

### 核心功能

| 功能 | 文件 | 状态 |
|------|------|------|
| 路由入口 + 页面骨架 | `public/index.php` + `templates/main.html` + `app.css` + `app.js` | ✅ |
| 路径白名单 | `src/Whitelist.php` | ✅ |
| 目录扫描 + 扩展名筛选 | `src/Scanner.php` + `/api/scan` | ✅ |
| 重命名规则引擎（7 种） | `src/RenameEngine.php` + `/api/preview` | ✅ |
| 执行改名 + 冲突检测 | `src/Executor.php` + `/api/execute` | ✅ |
| 操作日志 + 回滚 | `src/Log.php` + `/api/rollback` + `/api/logs` | ✅ |
| 前端全流程交互 | `app.js`（扫描/预览/执行/日志/回滚） | ✅ |

### 扩展功能

| 功能 | 文件 | 状态 |
|------|------|------|
| 按类型归档（6 类） | `src/Categorizer.php` + RenameEngine | ✅ |
| 按时间归档（YYYY/MM） | `src/RenameEngine.php` | ✅ |
| 规则模板保存/加载/删除 | `src/TemplateManager.php` | ✅ |
| 重复文件检测（MD5） | `src/DuplicateFinder.php` + `/api/duplicates` | ✅ |
| 回收站（7 天保留 + 恢复） | `src/TrashManager.php` + `/api/trash` | ✅ |
| 大目录进度条（>200 轮询） | `src/Progress.php` + 前端 | ✅ |
| 确认弹窗 | `templates/main.html` + `app.js` | ✅ |
| 文件列表排序 | `app.js`（sort-th 点击事件） | ✅ |
| 搜索过滤 | `app.js`（searchFilter 输入事件） | ✅ |
| 安全约束 | 系统目录拦截 / 2000 上限 / 冲突跳过 | ✅ |

### UI 设计

| 功能 | 说明 | 状态 |
|------|------|------|
| 设计系统 | `app.css` 完整 tokens（色彩/字体/圆角/阴影） | ✅ |
| 字体方案 | Plus Jakarta Sans + Inter + JetBrains Mono | ✅ |
| 响应式布局 | 侧边栏 + 主区域 + 底部通栏日志 | ✅ |
| 头部状态栏 | 实时路径/文件数/重复数 | ✅ |
| 回收站面板 | 查看 + 恢复 | ✅ |
| 模态弹窗 | 执行确认 | ✅ |

---

## 后续扩展方向

### 短期（可做）

| 功能 | 工作量 | 说明 |
|------|--------|------|
| 正则重命名 | 1天 | 支持 `s/pattern/replace/` 语法 |
| 批量时间调整 | 0.5天 | 批量修改文件 mtime |
| 导出改名报告 | 0.5天 | 操作日志导出为 CSV/Markdown |
| 拖拽上传到工作目录 | 1天 | 浏览器拖入文件到当前路径 |

### 长期（按需）

| 功能 | 说明 |
|------|------|
| Electron 桌面打包 | 包装为独立 exe |
| 英文界面 | 多语言切换 |
| 多标签管理 | 同时管理多个目录 |
