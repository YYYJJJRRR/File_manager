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
        ruleFind: document.getElementById('ruleFind'),
        ruleReplace: document.getElementById('ruleReplace'),
        extFilter: document.getElementById('extFilter'),
        filterBtn: document.getElementById('filterBtn'),
        searchFilter: document.getElementById('searchFilter'),
        templateSelect: document.getElementById('templateSelect'),
        saveTemplateBtn: document.getElementById('saveTemplateBtn'),
        deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
        dupBtn: document.getElementById('dupBtn'),
        dupPanel: document.getElementById('dupPanel'),
        dupBody: document.getElementById('dupBody'),
        dupSummary: document.getElementById('dupSummary'),
        dupFooter: document.getElementById('dupFooter'),
        selectAllDup: document.getElementById('selectAllDup'),
        deleteDupBtn: document.getElementById('deleteDupBtn'),
        progressPanel: document.getElementById('progressPanel'),
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        statPath: document.getElementById('statPath'),
        statFiles: document.getElementById('statFiles'),
        statDupRow: document.getElementById('statDupRow'),
        statDup: document.getElementById('statDup'),
        confirmModal: document.getElementById('confirmModal'),
        modalSummary: document.getElementById('modalSummary'),
        modalDetail: document.getElementById('modalDetail'),
        modalConfirm: document.getElementById('modalConfirm'),
        modalCancel: document.getElementById('modalCancel'),
        modalClose: document.getElementById('modalClose'),
    };
    let lastExts = '';

    let currentFiles = [];
    let currentMappings = [];
    let currentPath = '';
    let currentSort = { key: 'name', dir: 'asc' };

    loadTemplates();

    DOM.scanBtn.addEventListener('click', scanDirectory);
    DOM.filterBtn.addEventListener('click', function () {
        if (currentPath) scanDirectory();
    });
    DOM.searchFilter.addEventListener('input', function () {
        if (currentFiles.length) renderFileList(currentFiles);
    });
    DOM.extFilter.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && currentPath) scanDirectory();
    });
    DOM.previewBtn.addEventListener('click', preview);
    DOM.saveTemplateBtn.addEventListener('click', saveTemplate);
    DOM.templateSelect.addEventListener('change', loadTemplate);
    DOM.deleteTemplateBtn.addEventListener('click', deleteTemplate);
    DOM.modalCancel.addEventListener('click', hideModal);
    DOM.modalClose.addEventListener('click', hideModal);
    DOM.modalConfirm.addEventListener('click', doExecute);
    DOM.dupBtn.addEventListener('click', findDuplicates);
    DOM.deleteDupBtn.addEventListener('click', deleteDuplicates);
    DOM.selectAllDup.addEventListener('change', function () {
        var checked = DOM.selectAllDup.checked;
        document.querySelectorAll('.dup-checkbox').forEach(function (cb) { cb.checked = checked; });
    });
    DOM.executeBtn.addEventListener('click', execute);
    DOM.refreshLogsBtn.addEventListener('click', loadLogs);
    DOM.selectAll.addEventListener('click', function (e) { e.stopPropagation(); });

    loadLogs();

    document.querySelectorAll('.sort-th').forEach(function (th) {
        th.addEventListener('click', function () {
            var key = this.getAttribute('data-sort');
            if (!key) return;
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = key;
                currentSort.dir = 'asc';
            }
            document.querySelectorAll('.sort-th').forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
            this.classList.add('sort-' + currentSort.dir);
            if (currentFiles.length) renderFileList(currentFiles);
        });
    });

    function setStatus(msg, type) {
        var el = DOM.scanStatus;
        el.style.display = 'block';
        el.className = 'scan-status scan-status-' + (type || 'info');
        el.textContent = msg;
    }

    function clearStatus() {
        DOM.scanStatus.style.display = 'none';
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
        var files = [];
        document.querySelectorAll('.file-checkbox:checked').forEach(function (cb) {
            var name = cb.value;
            var mtime = cb.getAttribute('data-mtime');
            files.push({ name: name, mtime: mtime ? parseInt(mtime) : 0 });
        });
        return files;
    }

    function getRules() {
        var rules = {
            remove_spaces: document.getElementById('ruleRemoveSpaces').checked,
            remove_special_chars: document.getElementById('ruleRemoveSpecial').checked,
            lowercase: document.getElementById('ruleLowercase').checked,
            add_date_prefix: document.getElementById('ruleDatePrefix').checked,
            add_sequence: document.getElementById('ruleSequence').checked,
            ext_lowercase: document.getElementById('ruleExtLowercase').checked,
            categorize: document.getElementById('ruleCategorize').checked,
        };
        var findVal = DOM.ruleFind.value.trim();
        var replaceVal = DOM.ruleReplace.value.trim();
        if (findVal) {
            rules.find_replace = [{ find: findVal, replace: replaceVal }];
        }
        return rules;
    }

    function scanDirectory() {
        var path = DOM.pathInput.value.trim();
        if (!path) {
            setStatus('请输入路径', 'danger');
            return;
        }
        currentPath = path;
        DOM.statPath.textContent = path;
        clearStatus();
        lastExts = DOM.extFilter.value.trim();
        var exts = lastExts ? lastExts.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; }) : [];
        setStatus('扫描中...', 'info');
        DOM.scanBtn.disabled = true;

        fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path, exts: exts.length ? exts : undefined })
        }).then(function (r) { return r.json(); }).then(function (data) {
            DOM.scanBtn.disabled = false;
            if (data.error) {
                setStatus(data.error, 'danger');
                return;
            }
            currentFiles = data.files || [];
            DOM.statFiles.textContent = currentFiles.length;
            setStatus('共 ' + currentFiles.length + ' 个文件', 'success');
            currentSort = { key: 'name', dir: 'asc' };
            document.querySelectorAll('.sort-th').forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
            var nameTh = document.querySelector('.sort-th[data-sort="name"]');
            if (nameTh) nameTh.classList.add('sort-asc');
            renderFileList(currentFiles);
            DOM.welcomePanel.style.display = 'none';
            DOM.rulePanel.style.display = 'block';
            DOM.filePanel.style.display = 'block';
            DOM.previewPanel.style.display = 'none';
            DOM.resultPanel.style.display = 'none';
            DOM.dupPanel.style.display = 'none';
        }).catch(function (err) {
            DOM.scanBtn.disabled = false;
            setStatus('请求失败: ' + err.message, 'danger');
        });
    }

    function sortFiles(files, key, dir) {
        var sorted = files.slice();
        sorted.sort(function (a, b) {
            var va = a[key], vb = b[key];
            if (typeof va === 'string') {
                va = va.toLowerCase(); vb = (vb || '').toLowerCase();
                return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            va = va || 0; vb = vb || 0;
            return dir === 'asc' ? va - vb : vb - va;
        });
        return sorted;
    }

    function renderFileList(files) {
        var keyword = DOM.searchFilter.value.trim().toLowerCase();
        var filtered = keyword ? files.filter(function (f) { return f.name.toLowerCase().indexOf(keyword) !== -1; }) : files;
        var sorted = sortFiles(filtered, currentSort.key, currentSort.dir);
        var html = '';
        sorted.forEach(function (f) {
            html += '<tr>' +
                '<td><input class="form-check-input file-checkbox" type="checkbox" value="' + escHtml(f.name) + '" data-mtime="' + f.mtime + '"></td>' +
                '<td>' + escHtml(f.name) + '</td>' +
                '<td>' + formatSize(f.size) + '</td>' +
                '<td>' + escHtml(f.ext) + '</td>' +
                '<td>' + formatTime(f.mtime) + '</td>' +
                '</tr>';
        });
        DOM.fileBody.innerHTML = html;
        var total = currentFiles.length;
        var shown = sorted.length;
        DOM.fileCount.textContent = shown < total ? shown + ' / ' + total + ' 个' : total + ' 个';
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
        var changed = 0, conflicts = 0;
        currentMappings.forEach(function (m) {
            if (m.changed && !m.conflict) changed++;
            if (m.conflict) conflicts++;
        });
        if (changed === 0) { alert('没有需改动的文件'); return; }

        var dirs = {};
        currentMappings.forEach(function (m) {
            if (m.typeDir) dirs[m.typeDir] = true;
            if (m.timeDir) dirs[m.timeDir] = true;
        });
        var dirCount = Object.keys(dirs).length;

        var summaryHtml = '';
        summaryHtml += '<div class="modal-stat ok"><div class="modal-stat-value">' + changed + '</div><div class="modal-stat-label">待改动</div></div>';
        if (conflicts > 0) summaryHtml += '<div class="modal-stat warn"><div class="modal-stat-value">' + conflicts + '</div><div class="modal-stat-label">冲突（跳过）</div></div>';
        if (dirCount > 0) summaryHtml += '<div class="modal-stat"><div class="modal-stat-value">' + dirCount + '</div><div class="modal-stat-label">新建目录</div></div>';
        summaryHtml += '<div class="modal-stat"><div class="modal-stat-value">' + (DOM.dryRun.checked ? '是' : '否') + '</div><div class="modal-stat-label">Dry-run</div></div>';

        var detailHtml = '';
        if (changed > 10) {
            detailHtml += '<p>将处理以下文件（仅显示前 10 项）：</p><ul>';
            var shown = 0;
            currentMappings.forEach(function (m) {
                if (m.changed && !m.conflict && shown < 10) {
                    detailHtml += '<li>' + escHtml(m.from) + ' → ' + escHtml(m.to) + '</li>';
                    shown++;
                }
            });
            detailHtml += changed > 10 ? '<li>... 及其他 ' + (changed - 10) + ' 个文件</li>' : '';
            detailHtml += '</ul>';
        } else {
            detailHtml += '<p>将处理以下文件：</p><ul>';
            currentMappings.forEach(function (m) {
                if (m.changed && !m.conflict) detailHtml += '<li>' + escHtml(m.from) + ' → ' + escHtml(m.to) + '</li>';
            });
            detailHtml += '</ul>';
        }

        DOM.modalSummary.innerHTML = summaryHtml;
        DOM.modalDetail.innerHTML = detailHtml;
        DOM.confirmModal.style.display = 'flex';
    }

    function hideModal() {
        DOM.confirmModal.style.display = 'none';
    }

    function doExecute() {
        hideModal();
        if (currentMappings.length === 0) return;

        if (currentMappings.length > 200) {
            DOM.progressPanel.style.display = 'block';
            DOM.progressBar.style.width = '0%';
            DOM.progressBar.textContent = '0%';
            DOM.progressText.textContent = '处理 0 / ' + currentMappings.length + '...';
            DOM.resultPanel.style.display = 'none';

            var pollTimer = setInterval(function () {
                fetch('/api/progress', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (data) {
                    var p = data.progress;
                    if (p && p.task === 'execute') {
                        DOM.progressBar.style.width = p.pct + '%';
                        DOM.progressBar.textContent = p.pct + '%';
                        DOM.progressText.textContent = '处理 ' + p.current + ' / ' + p.total + '...';
                        if (p.status === 'done' || p.status === 'error') {
                            clearInterval(pollTimer);
                            setTimeout(function () {
                                DOM.progressPanel.style.display = 'none';
                            }, 1000);
                        }
                    }
                }).catch(function () {});
            }, 500);
        }

        DOM.resultBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">执行中...</td></tr>';

        fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentPath,
                mappings: currentMappings,
                dryRun: DOM.dryRun.checked
            })
        }).then(function (r) { return r.json(); }).then(function (data) {
            DOM.previewPanel.style.display = 'none';
            if (data._logId) {
                loadLogs();
            }
            renderResults(data.results || []);
            DOM.resultPanel.style.display = 'block';
            if (currentMappings.length > 200) {
                setTimeout(function () {
                    DOM.progressPanel.style.display = 'none';
                }, 500);
            }
        }).catch(function (err) {
            DOM.resultBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">请求失败: ' + escHtml(err.message) + '</td></tr>';
            DOM.resultPanel.style.display = 'block';
            DOM.progressPanel.style.display = 'none';
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
            html += '<tr class="log-row ' + rowClass + '" data-path="' + escHtml(l.path) + '">' +
                '<td class="small">' + escHtml(l.time) + '</td>' +
                '<td class="small log-path">' + escHtml(l.path) + '</td>' +
                '<td>' + l.fileCount + '</td>' +
                '<td>' + rolledBack + '</td>' +
                '<td class="text-end">' + btnHtml + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        DOM.logBody.innerHTML = html;

        document.querySelectorAll('.rollback-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                doRollback(this.getAttribute('data-logid'));
            });
        });

        document.querySelectorAll('.log-row').forEach(function (row) {
            row.addEventListener('click', function () {
                var path = this.getAttribute('data-path');
                if (path) {
                    DOM.pathInput.value = path;
                    scanDirectory();
                }
            });
        });
    }

    function loadTemplates() {
        fetch('/api/templates', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (data) {
            renderTemplates(data.templates || []);
        }).catch(function () {});
    }

    function getCurrentRules() {
        var rules = {
            remove_spaces: document.getElementById('ruleRemoveSpaces').checked,
            remove_special_chars: document.getElementById('ruleRemoveSpecial').checked,
            lowercase: document.getElementById('ruleLowercase').checked,
            add_date_prefix: document.getElementById('ruleDatePrefix').checked,
            add_sequence: document.getElementById('ruleSequence').checked,
            ext_lowercase: document.getElementById('ruleExtLowercase').checked,
            categorize: document.getElementById('ruleCategorize').checked,
            time_archive: document.getElementById('ruleTimeArchive').checked,
        };
        var findVal = DOM.ruleFind.value.trim();
        if (findVal) {
            rules.find_replace = [{ find: findVal, replace: DOM.ruleReplace.value.trim() }];
        }
        return rules;
    }

    function renderTemplates(templates) {
        var sel = DOM.templateSelect;
        var currentVal = sel.value;
        sel.innerHTML = '<option value="">加载模板...</option>';
        templates.forEach(function (t) {
            var opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name;
            sel.appendChild(opt);
        });
        sel.value = currentVal;
        DOM.deleteTemplateBtn.style.display = sel.value ? 'inline-block' : 'none';
    }

    function saveTemplate() {
        var name = prompt('请输入模板名称：');
        if (!name || !name.trim()) return;
        name = name.trim();

        var rules = getCurrentRules();
        fetch('/api/template/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, rules: rules })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) { alert(data.error); return; }
            loadTemplates();
            DOM.templateSelect.value = name;
            DOM.deleteTemplateBtn.style.display = 'inline-block';
        }).catch(function (err) {
            alert('保存失败: ' + err.message);
        });
    }

    function loadTemplate() {
        var name = DOM.templateSelect.value;
        DOM.deleteTemplateBtn.style.display = name ? 'inline-block' : 'none';
        if (!name) return;

        fetch('/api/templates', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (data) {
            var templates = data.templates || [];
            var found = null;
            for (var i = 0; i < templates.length; i++) {
                if (templates[i].name === name) { found = templates[i]; break; }
            }
            if (found && found.rules) {
                applyRulesToUI(found.rules);
            }
        }).catch(function () {});
    }

    function deleteTemplate() {
        var name = DOM.templateSelect.value;
        if (!name) return;
        if (!confirm('确认删除模板"' + name + '"？')) return;

        fetch('/api/template/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        }).then(function (r) { return r.json(); }).then(function () {
            DOM.templateSelect.value = '';
            DOM.deleteTemplateBtn.style.display = 'none';
            loadTemplates();
        }).catch(function (err) {
            alert('删除失败: ' + err.message);
        });
    }

    function findDuplicates() {
        var path = DOM.pathInput.value.trim();
        if (!path) { setStatus('请先输入路径', 'danger'); return; }
        DOM.dupBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">检测中...</td></tr>';
        DOM.dupPanel.style.display = 'block';
        DOM.dupFooter.style.display = 'none';
        DOM.previewPanel.style.display = 'none';
        DOM.resultPanel.style.display = 'none';

        fetch('/api/duplicates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.error) {
                DOM.dupBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">' + escHtml(data.error) + '</td></tr>';
                return;
            }
            renderDuplicates(data.groups || []);
        }).catch(function (err) {
            DOM.dupBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">请求失败: ' + escHtml(err.message) + '</td></tr>';
        });
    }

    function renderDuplicates(groups) {
        if (groups.length === 0) {
            DOM.dupBody.innerHTML = '<tr><td colspan="4" class="text-center text-success py-3">✅ 未发现重复文件</td></tr>';
            DOM.dupSummary.textContent = '无重复';
            DOM.dupFooter.style.display = 'none';
            DOM.statDupRow.style.display = 'none';
            return;
        }
        var dupCount = 0, wasted = 0;
        var html = '';
        groups.forEach(function (g, gi) {
            html += '<tr class="table-secondary"><td colspan="4" class="small"><strong>重复组 #' + (gi + 1) + '</strong> — 浪费空间: ' + formatSize(g.wasted) + '</td></tr>';
            g.files.forEach(function (f) {
                var isKeeper = f.keeper;
                var statusText = isKeeper ? '保留' : '重复';
                var rowClass = isKeeper ? '' : 'dup-duplicate';
                var cbHtml = isKeeper ? '' : '<input class="form-check-input dup-checkbox" type="checkbox" value="' + escHtml(f.name) + '" checked>';
                if (!isKeeper) { dupCount++; wasted += f.size; }
                html += '<tr class="' + rowClass + '">' +
                    '<td>' + cbHtml + '</td>' +
                    '<td class="small">' + escHtml(f.name) + '</td>' +
                    '<td>' + formatSize(f.size) + '</td>' +
                    '<td>' + statusText + '</td>' +
                    '</tr>';
            });
        });
        DOM.dupBody.innerHTML = html;
        DOM.dupSummary.textContent = dupCount + ' 个重复文件，可释放 ' + formatSize(wasted);
        DOM.dupFooter.style.display = dupCount > 0 ? 'flex' : 'none';
        DOM.statDup.textContent = dupCount;
        DOM.statDupRow.style.display = dupCount > 0 ? 'inline-flex' : 'none';
    }

    function deleteDuplicates() {
        var checked = [];
        document.querySelectorAll('.dup-checkbox:checked').forEach(function (cb) {
            checked.push(cb.value);
        });
        if (checked.length === 0) { alert('请勾选要删除的重复文件'); return; }
        if (!confirm('确认删除 ' + checked.length + ' 个重复文件？此操作不可回滚！')) return;

        fetch('/api/duplicates/clean', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: DOM.pathInput.value.trim(), files: checked })
        }).then(function (r) { return r.json(); }).then(function (data) {
            var ok = 0, fail = 0;
            (data.results || []).forEach(function (r) {
                if (r.status === 'ok') ok++; else fail++;
            });
            alert('删除完成：' + ok + ' 成功，' + fail + ' 失败');
            if (fail === 0) {
                findDuplicates();
                if (currentPath) scanDirectory();
            } else {
                findDuplicates();
            }
        }).catch(function (err) {
            alert('请求失败: ' + err.message);
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

    window.toggleSelectAll = function (el) {
        var checked = el.checked;
        var boxes = document.querySelectorAll('.file-checkbox');
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = checked;
        updatePreviewBtn();
    };
})();
