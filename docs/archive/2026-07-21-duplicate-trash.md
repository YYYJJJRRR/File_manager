# 重复文件回收站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将重复文件清理改为可恢复的项目内回收站，并在条目满 7 天后自动清理。

**Architecture:** 新建 `TrashManager` 集中负责回收、恢复、列出与过期清理。`DuplicateFinder` 只委托回收操作，路由暴露回收站 API，前端通过回收站面板调用列表与恢复接口。

**Tech Stack:** PHP 8.x、原生 JavaScript、JSON 文件存储、PHP 内置 `rename`/`unlink`。

## Global Constraints

- 必须运行于 PHP 8.x，且不得依赖 `mbstring` 或操作系统回收站。
- 回收条目保留 7 天；清理在每次回收站列表、移入或恢复前机会式执行。
- 恢复不能覆盖原路径已有的文件。
- 过期清理只能删除 `storage/trash` 下由有效元数据标记的条目。
- 保留现有 `/api/duplicates/clean` 请求结构 `{ path, files }`。

---

### Task 1: 回收站领域服务与回归测试

**Files:**

- Create: `src/TrashManager.php`
- Create: `tests/trash_manager_test.php`

**Interfaces:**

- Produces: `TrashManager::trash(string $sourcePath): array`
- Produces: `TrashManager::all(): array`
- Produces: `TrashManager::restore(string $id): array`
- Produces: `TrashManager::purgeExpired(): int`

- [ ] **Step 1: Write the failing test**

Create a standalone test using a temporary source directory and `new TrashManager($trashRoot)`. It must assert that a moved file disappears from the source, has a `metadata.json` entry in the trash directory, restores to its original path, refuses to restore over a newly-created same-name file, and removes a hand-created expired entry.

```php
$trashed = $manager->trash($source . '/duplicate.txt');
assertTrue($trashed['status'] === 'trashed');
assertTrue(!file_exists($source . '/duplicate.txt'));
assertTrue(file_exists($trashRoot . '/' . $trashed['id'] . '/metadata.json'));

$restored = $manager->restore($trashed['id']);
assertTrue($restored['status'] === 'restored');
assertTrue(file_exists($source . '/duplicate.txt'));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php tests\trash_manager_test.php`

Expected: FAIL because `TrashManager` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `TrashManager`, defaulting its root to `__DIR__ . '/../storage/trash'`. Before `trash`, `all`, and `restore`, call `purgeExpired`. `trash` creates an ID using `date('Ymd_His') . '_' . bin2hex(random_bytes(8))`, makes `storage/trash/<id>/`, moves the source with `rename`, and writes this metadata only after the move succeeds:

```php
[
    'id' => $id,
    'originalPath' => $sourcePath,
    'originalName' => basename($sourcePath),
    'trashedAt' => date(DATE_ATOM),
    'expiresAt' => date(DATE_ATOM, time() + 7 * 24 * 60 * 60),
    'storedName' => basename($sourcePath),
]
```

If metadata writing fails, attempt to move the file back. `restore` validates IDs against `[A-Za-z0-9_-]+`, loads only its own metadata, rejects an existing `originalPath`, moves the file back, then removes the entry directory. `purgeExpired` inspects only direct entry directories and removes an entry only if valid metadata has `expiresAt <= time()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php tests\trash_manager_test.php`

Expected: PASS for move, restore, conflict protection and expiry cleanup.

- [ ] **Step 5: Commit**

Run: `git add src\TrashManager.php tests\trash_manager_test.php; git commit -m "feat: add recoverable trash manager"`

### Task 2: 接入重复文件清理和 API

**Files:**

- Modify: `src/DuplicateFinder.php:94-113`
- Modify: `src/index.php:112-118`
- Modify: `public/index.php:8-19`
- Test: `tests/trash_manager_test.php`

**Interfaces:**

- Consumes: `TrashManager::trash`, `TrashManager::all`, `TrashManager::restore`.
- Produces: `POST /api/trash` returning `{ items: array }`.
- Produces: `POST /api/trash/restore` accepting `{ id: string }`.

- [ ] **Step 1: Write the failing delegation test**

Extend the same test to call `DuplicateFinder::clean($source, ['duplicate.txt'], $manager)` using an injected test-root `TrashManager`, and assert status `trashed`, a missing source file, and a returned trash ID.

- [ ] **Step 2: Run test to verify it fails**

Run: `php tests\trash_manager_test.php`

Expected: FAIL because `DuplicateFinder::clean()` still calls `unlink()` and reports `ok`.

- [ ] **Step 3: Write minimal implementation**

Replace `unlink($fullPath)` with `TrashManager::trash($fullPath)`. Change the method signature to `clean(string $path, array $files, ?TrashManager $trashManager = null): array`; use the injected manager when present and otherwise construct the default manager. Preserve the existing result shape, return `status: 'trashed'`, include its `id`, and use message `已移入回收站，可在 7 天内恢复`. Add `/api/trash` and `/api/trash/restore` to the public route map. The list route returns `['items' => (new TrashManager())->all()]`; restore only accepts `$body['id']` and never accepts a client-provided target path.

- [ ] **Step 4: Run tests and syntax checks**

Run: `php tests\trash_manager_test.php; Get-ChildItem src,public -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }`

Expected: all assertions PASS and every PHP file reports no syntax errors.

- [ ] **Step 5: Commit**

Run: `git add src\DuplicateFinder.php src\index.php public\index.php tests\trash_manager_test.php; git commit -m "feat: route duplicate cleanup through trash"`

### Task 3: 回收站界面与交互

**Files:**

- Modify: `public/templates/main.html:41-51,206-227`
- Modify: `public/assets/app.js:20-90,635-660`

**Interfaces:**

- Consumes: `POST /api/trash` → `{ items: [{ id, originalName, originalPath, trashedAt, expiresAt }] }`.
- Consumes: `POST /api/trash/restore` → `{ status: 'restored'|'error', message?: string }`.

- [ ] **Step 1: Write the failing UI acceptance checklist**

Add this comment directly above the new JavaScript functions:

```js
// Acceptance: duplicate action says “移入回收站”; moved items list in the trash panel;
// restore returns the file to its original path and refreshes the current directory.
```

- [ ] **Step 2: Verify it fails against current UI**

Open the current duplicate panel. Expected: it says `删除选中重复文件` and has no trash panel or restore action.

- [ ] **Step 3: Write minimal implementation**

Change the action to `移入回收站` and ask `确认将 N 个重复文件移入回收站？文件可在 7 天内恢复。`. Add sidebar button `#trashBtn` and `#trashPanel` with file name, original path, recovery deadline, and restore action. In `app.js`, add `loadTrash()`, `renderTrash(items)`, and `restoreTrash(id)`; HTML-escape all returned text. After a successful restore, run `loadTrash()`, `findDuplicates()`, and `scanDirectory()` when `currentPath` exists.

- [ ] **Step 4: Verify browser behavior**

With two same-content temporary files: detect duplicates, move one to trash, open the trash panel, restore it, then repeat duplicate detection. Expected: the file returns, its entry disappears, and duplicate detection finds it again.

- [ ] **Step 5: Commit**

Run: `git add public\templates\main.html public\assets\app.js; git commit -m "feat: add trash recovery interface"`

### Task 4: 文档与完整验证

**Files:**

- Modify: `README.md`
- Test: `tests/trash_manager_test.php`

- [ ] **Step 1: Add retention assertion**

Add test output confirming the successful scenario: `PASS: Trash entries remain recoverable for seven days.`

- [ ] **Step 2: Verify documentation is currently incomplete**

Run: `rg -n "回收站|7 天|重复文件" README.md`

Expected: no statement that duplicate cleanup remains recoverable for seven days.

- [ ] **Step 3: Update README**

State that duplicate cleanup moves selected files to the project recycle bin, supports restoration for 7 days, clears expired entries on the next related action, and stores them under `storage/trash/`.

- [ ] **Step 4: Run complete verification**

Run: `php tests\scanner_without_mbstring_test.php; php tests\rename_engine_without_mbstring_test.php; php tests\trash_manager_test.php; Get-ChildItem src,public -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }; git diff --check`

Expected: all tests PASS, no PHP syntax errors, and no diff whitespace errors.

- [ ] **Step 5: Commit**

Run: `git add README.md tests\trash_manager_test.php; git commit -m "docs: describe duplicate trash retention"`
