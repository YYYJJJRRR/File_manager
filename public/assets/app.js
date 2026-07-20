(function () {
    'use strict';

    const DOM = {
        pathInput: document.getElementById('pathInput'),
        scanBtn: document.getElementById('scanBtn'),
        scanStatus: document.getElementById('scanStatus'),
        rulePanel: document.getElementById('rulePanel'),
        filePanel: document.getElementById('filePanel'),
        fileBody: document.getElementById('fileBody'),
        fileCount: document.getElementById('fileCount'),
        selectAll: document.getElementById('selectAll'),
        previewBtn: document.getElementById('previewBtn'),
        previewPanel: document.getElementById('previewPanel'),
        previewBody: document.getElementById('previewBody'),
        previewSummary: document.getElementById('previewSummary'),
        executeBtn: document.getElementById('executeBtn'),
        resultPanel: document.getElementById('resultPanel'),
        resultBody: document.getElementById('resultBody'),
        resultSummary: document.getElementById('resultSummary'),
        dryRun: document.getElementById('dryRun'),
        logBody: document.getElementById('logBody'),
        refreshLogsBtn: document.getElementById('refreshLogsBtn'),
        welcomePanel: document.getElementById('welcomePanel'),
    };

    let currentFiles = [];
    let currentMappings = [];
    let currentPath = '';

    DOM.scanBtn.addEventListener('click', scanDirectory);
    DOM.previewBtn.addEventListener('click', preview);
    DOM.executeBtn.addEventListener('click', execute);
    DOM.refreshLogsBtn.addEventListener('click', loadLogs);
    DOM.selectAll.addEventListener('change', function () {
        document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = this.checked);
        updatePreviewBtn();
    });

    loadLogs();

    function setStatus(msg, type) {
        DOM.scanStatus.innerHTML = '<span class="text-' + (type || 'muted') + '">' + msg + '</span>';
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function formatTime(ts) {
        var d = new Date(ts * 1000);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function updatePreviewBtn() {
        var checked = document.querySelectorAll('.file-checkbox:checked').length;
        DOM.previewBtn.disabled = checked === 0;
        DOM.previewBtn.textContent = '预览 (' + checked + ')';
    }

    function getSelectedFiles() {
        var names = [];
        document.querySelectorAll('.file-checkbox:checked').forEach(function (cb) {
            names.push(cb.value);
        });
        return names;
    }

    function getRules() {
        return {
            remove_spaces: document.getElementById('ruleRemoveSpaces').checked,
            remove_special_chars: document.getElementById('ruleRemoveSpecial').checked,
            lowercase: document.getElementById('ruleLowercase').checked,
            add_date_prefix: document.getElementById('ruleDatePrefix').checked,
            add_sequence: document.getElementById('ruleSequence').checked,
            ext_lowercase: document.getElementById('ruleExtLowercase').checked,
        };
    }

    function scanDirectory() {
        var path = DOM.pathInput.value.trim();
        if (!path) {
            setStatus('请输入路径', 'danger');
            return;
        }
        currentPath = path;
        setStatus('扫描中...', 'info');
        DOM.scanBtn.disabled = true;

        fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        }).then(function (r) { return r.json(); }).then(function (data) {
            DOM.scanBtn.disabled = false;
            if (data.error) {
                setStatus(data.error, 'danger');
                return;
            }
            currentFiles = data.files || [];
            setStatus('共 ' + currentFiles.length + ' 个文件', 'success');
            renderFileList(currentFiles);
            DOM.welcomePanel.style.display = 'none';
            DOM.rulePanel.style.display = 'block';
            DOM.filePanel.style.display = 'block';
            DOM.previewPanel.style.display = 'none';
            DOM.resultPanel.style.display = 'none';
        }).catch(function (err) {
            DOM.scanBtn.disabled = false;
            setStatus('请求失败: ' + err.message, 'danger');
        });
    }

    function renderFileList(files) {
        var html = '';
        files.forEach(function (f) {
            html += '<tr>' +
                '<td><input class="form-check-input file-checkbox" type="checkbox" value="' + escHtml(f.name) + '"></td>' +
                '<td>' + escHtml(f.name) + '</td>' +
                '<td>' + formatSize(f.size) + '</td>' +
                '<td>' + escHtml(f.ext) + '</td>' +
                '<td>' + formatTime(f.mtime) + '</td>' +
                '</tr>';
        });
        DOM.fileBody.innerHTML = html;
        DOM.fileCount.textContent = files.length + ' 个文件';
        DOM.selectAll.checked = false;
        document.querySelectorAll('.file-checkbox').forEach(function (cb) {
            cb.addEventListener('change', updatePreviewBtn);
        });
        updatePreviewBtn();
    }

    function preview() {
        var files = getSelectedFiles();
        if (files.length === 0) return;
        DOM.previewBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">预览中...</td></tr>';
        DOM.previewPanel.style.display = 'block';
        DOM.resultPanel.style.display = 'none';

        fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: DOM.pathInput.value.trim(),
                files: files,
                rules: getRules()
            })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) {
                DOM.previewBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">' + escHtml(data.error) + '</td></tr>';
                return;
            }
            currentMappings = data.mappings || [];
            renderPreview(currentMappings);
        }).catch(function (err) {
            DOM.previewBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">请求失败: ' + escHtml(err.message) + '</td></tr>';
        });
    }

    function renderPreview(mappings) {
        var changed = 0, conflicts = 0;
        var html = '';
        mappings.forEach(function (m) {
            var rowClass = m.conflict ? 'conflict' : '';
            var statusText = m.conflict ? '冲突' : (m.changed ? '待改' : '');
            if (m.changed) changed++;
            if (m.conflict) conflicts++;
            html += '<tr class="' + rowClass + '">' +
                '<td>' + escHtml(m.from) + '</td>' +
                '<td class="text-center">→</td>' +
                '<td>' + escHtml(m.to) + '</td>' +
                '<td>' + statusText + '</td>' +
                '</tr>';
        });
        DOM.previewBody.innerHTML = html;
        DOM.previewSummary.textContent = '共 ' + mappings.length + ' 个，' + changed + ' 个改动，' + conflicts + ' 个冲突';
        DOM.executeBtn.style.display = 'inline-block';
    }

    function execute() {
        if (currentMappings.length === 0) return;
        DOM.resultBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">执行中...</td></tr>';
        DOM.resultPanel.style.display = 'block';

        fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentPath,
                mappings: currentMappings,
                dryRun: DOM.dryRun.checked
            })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) {
                DOM.resultBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">' + escHtml(data.error) + '</td></tr>';
                return;
            }
            renderResults(data.results || []);
            DOM.previewPanel.style.display = 'none';
            loadLogs();
        }).catch(function (err) {
            DOM.resultBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">请求失败: ' + escHtml(err.message) + '</td></tr>';
        });
    }

    function renderResults(results) {
        var ok = 0, fail = 0, skip = 0, dry = 0;
        var html = '';
        results.forEach(function (r) {
            var cls = 'status-' + r.status;
            if (r.status === 'ok') ok++;
            else if (r.status === 'error') fail++;
            else if (r.status === 'skipped') skip++;
            else if (r.status === 'dry_run') dry++;
            html += '<tr>' +
                '<td>' + escHtml(r.from) + '</td>' +
                '<td>' + escHtml(r.to) + '</td>' +
                '<td class="' + cls + '">' + r.status + '</td>' +
                '<td>' + escHtml(r.message || '') + '</td>' +
                '</tr>';
        });
        DOM.resultBody.innerHTML = html;
        var parts = [];
        if (ok > 0) parts.push('✔ ' + ok + ' 成功');
        if (fail > 0) parts.push('✘ ' + fail + ' 失败');
        if (skip > 0) parts.push('— ' + skip + ' 跳过');
        if (dry > 0) parts.push('◌ ' + dry + ' Dry-run');
        DOM.resultSummary.textContent = parts.join(' / ') || '无结果';
    }

    function loadLogs() {
        fetch('/api/logs', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (data) {
            renderLogs(data.logs || []);
        }).catch(function () {
            DOM.logBody.innerHTML = '<div class="text-center text-danger py-3">加载失败</div>';
        });
    }

    function renderLogs(logs) {
        if (logs.length === 0) {
            DOM.logBody.innerHTML = '<div class="text-center text-muted py-3">暂无操作记录</div>';
            return;
        }
        var html = '<table class="table table-sm table-hover mb-0"><thead class="table-light"><tr><th>时间</th><th>路径</th><th>文件</th><th>状态</th><th style="width:60px"></th></tr></thead><tbody>';
        logs.forEach(function (l) {
            var rolledBack = l.rolledBack ? '已回滚' : '正常';
            var rowClass = l.rolledBack ? 'text-muted' : '';
            var btnHtml = l.rolledBack
                ? '<span class="text-muted small">已回滚</span>'
                : '<button class="btn btn-outline-danger btn-sm py-0 rollback-btn" data-logid="' + escHtml(l.logId) + '">回滚</button>';
            html += '<tr class="' + rowClass + '">' +
                '<td class="small">' + escHtml(l.time) + '</td>' +
                '<td class="small">' + escHtml(l.path) + '</td>' +
                '<td>' + l.fileCount + '</td>' +
                '<td>' + rolledBack + '</td>' +
                '<td class="text-end">' + btnHtml + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        DOM.logBody.innerHTML = html;

        document.querySelectorAll('.rollback-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                doRollback(this.getAttribute('data-logid'));
            });
        });
    }

    function doRollback(logId) {
        if (!confirm('确认回滚此操作？')) return;

        fetch('/api/rollback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId: logId })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            loadLogs();
            if (currentPath) {
                scanDirectory();
            }
        }).catch(function (err) {
            alert('回滚失败: ' + err.message);
        });
    }

    function escHtml(s) {
        if (!s) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
})();
