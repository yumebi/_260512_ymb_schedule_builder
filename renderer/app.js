(() => {
  'use strict';

  const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem('theme', theme); } catch {}
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#334155',
  ];

  function normalizeHex(c) {
    return (c || '').toLowerCase();
  }

  function createColorPicker(initial, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'color-picker-wrap';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'color-swatch-trigger';
    trigger.style.background = initial || '#888888';
    trigger.title = initial || '';

    const popover = document.createElement('div');
    popover.className = 'color-popover hidden';
    popover.addEventListener('click', (e) => e.stopPropagation());

    let currentColor = initial || '#888888';
    function applyColor(c) {
      currentColor = c;
      trigger.style.background = c;
      trigger.title = c;
      popover.classList.add('hidden');
      onChange(c);
    }
    function paintSwatches() {
      popover.innerHTML = '';
      PRESET_COLORS.forEach((c) => {
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'color-swatch' + (normalizeHex(c) === normalizeHex(currentColor) ? ' selected' : '');
        sw.style.background = c;
        sw.title = c;
        sw.addEventListener('click', (e) => {
          e.stopPropagation();
          applyColor(c);
        });
        popover.appendChild(sw);
      });
      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'color-swatch color-swatch-more';
      moreBtn.title = 'その他の色...';
      moreBtn.innerHTML = '<span>+</span>';
      const native = document.createElement('input');
      native.type = 'color';
      native.value = /^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : '#888888';
      native.className = 'color-native-hidden';
      native.tabIndex = -1;
      native.addEventListener('input', (e) => {
        e.stopPropagation();
        applyColor(e.target.value);
      });
      native.addEventListener('click', (e) => e.stopPropagation());
      moreBtn.appendChild(native);
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        native.click();
      });
      popover.appendChild(moreBtn);
    }
    paintSwatches();

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = !popover.classList.contains('hidden');
      document.querySelectorAll('.color-popover').forEach((p) => p.classList.add('hidden'));
      if (!wasOpen) {
        if (popover.parentElement !== document.body) document.body.appendChild(popover);
        paintSwatches();
        popover.classList.remove('hidden');
        const rect = trigger.getBoundingClientRect();
        popover.style.top = `${rect.bottom + 4}px`;
        popover.style.left = `${rect.left}px`;
      }
    });

    wrap.appendChild(trigger);
    return wrap;
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.color-popover').forEach((p) => p.classList.add('hidden'));
  });


  const EMPTY_STATE = () => ({
    projectName: '',
    startDate: '',
    targetDate: '',
    note: '',
    holidays: [],
    assignees: [],
    tasks: [],
    milestones: [],
  });

  let state = EMPTY_STATE();
  let suppressAutoSave = true;
  let autoSaveTimer = null;

  // ---------- undo / redo ----------
  let historyUndo = [];
  let historyRedo = [];
  const HISTORY_MAX = 50;
  function snapshotState() {
    return JSON.parse(JSON.stringify(state));
  }
  function pushHistory(beforeState) {
    if (!beforeState) return;
    historyUndo.push(beforeState);
    if (historyUndo.length > HISTORY_MAX) historyUndo.shift();
    historyRedo.length = 0;
  }
  function undo() {
    if (historyUndo.length === 0) return;
    historyRedo.push(snapshotState());
    state = historyUndo.pop();
    render();
  }
  function redo() {
    if (historyRedo.length === 0) return;
    historyUndo.push(snapshotState());
    state = historyRedo.pop();
    render();
  }
  function wireUndoableText(el) {
    let before = null;
    el.addEventListener('focus', () => { before = snapshotState(); });
    el.addEventListener('blur', () => {
      if (before && JSON.stringify(before) !== JSON.stringify(state)) {
        pushHistory(before);
      }
      before = null;
    });
  }

  // ---------- ガント表示設定(非永続) ----------
  const ZOOM_WIDTH = { day: 38, week: 14, month: 5 };
  let ganttZoom = 'day';
  let assigneeFilterId = '';

  function scheduleAutoSave() {
    if (suppressAutoSave) return;
    if (!window.api || !window.api.saveLastState) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      window.api.saveLastState(snapshot());
    }, 400);
  }

  // ---------- date utilities ----------
  function parseLocalDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function formatDate(d) {
    const z = (n) => ('0' + n).slice(-2);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function holidaySet() {
    return new Set((state.holidays || []).map((h) => h.date));
  }
  function isBusinessDay(d, holSet) {
    const w = d.getDay();
    if (w === 0 || w === 6) return false;
    return !holSet.has(formatDate(d));
  }
  function calcEndDate(startDate, days, holSet) {
    let cur = new Date(startDate);
    while (!isBusinessDay(cur, holSet)) cur.setDate(cur.getDate() + 1);
    let added = 0;
    while (added < days) {
      if (isBusinessDay(cur, holSet)) added++;
      if (added < days) cur.setDate(cur.getDate() + 1);
    }
    return cur;
  }
  function calcBusinessDays(startDate, endDate, holSet) {
    let cur = new Date(startDate);
    const end = new Date(endDate);
    if (cur > end) return 0;
    let count = 0;
    while (cur <= end) {
      if (isBusinessDay(cur, holSet)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count > 0 ? count : 1;
  }

  // ---------- schedule initialization ----------
  function recalcAll() {
    const holSet = holidaySet();
    let cur = parseLocalDate(state.startDate);
    if (!cur) return;
    while (!isBusinessDay(cur, holSet)) cur.setDate(cur.getDate() + 1);
    state.tasks.forEach((t) => {
      t.start = formatDate(cur);
      const end = calcEndDate(cur, t.days, holSet);
      t.end = formatDate(end);
      const next = new Date(end);
      next.setDate(next.getDate() + 1);
      while (!isBusinessDay(next, holSet)) next.setDate(next.getDate() + 1);
      cur = next;
    });
  }
  function ensureTaskDates() {
    const holSet = holidaySet();
    let cur = parseLocalDate(state.startDate);
    if (!cur) return;
    while (!isBusinessDay(cur, holSet)) cur.setDate(cur.getDate() + 1);
    state.tasks.forEach((t) => {
      if (!t.start || !t.end) {
        t.start = formatDate(cur);
        const end = calcEndDate(cur, t.days, holSet);
        t.end = formatDate(end);
        const next = new Date(end);
        next.setDate(next.getDate() + 1);
        while (!isBusinessDay(next, holSet)) next.setDate(next.getDate() + 1);
        cur = next;
      } else {
        cur = parseLocalDate(t.end);
        const next = new Date(cur);
        next.setDate(next.getDate() + 1);
        while (!isBusinessDay(next, holSet)) next.setDate(next.getDate() + 1);
        cur = next;
      }
    });
  }

  // ---------- task editing ----------
  function updateTaskField(idx, field, value) {
    const t = state.tasks[idx];
    if (!t) return;
    const holSet = holidaySet();
    if (field === 'name') {
      t.name = value;
      const leftRows = document.querySelectorAll('#left-task-list .row-item');
      const lr = leftRows[idx];
      if (lr) {
        const cellName = lr.querySelector('.cell-name');
        if (cellName) {
          cellName.textContent = value;
          cellName.title = value;
        }
      }
      scheduleAutoSave();
      return;
    }
    const before = snapshotState();
    if (field === 'days') {
      t.days = Math.max(1, parseInt(value, 10) || 1);
      t.end = formatDate(calcEndDate(parseLocalDate(t.start), t.days, holSet));
    } else if (field === 'start') {
      t.start = value;
      t.end = formatDate(calcEndDate(parseLocalDate(t.start), t.days, holSet));
    } else if (field === 'end') {
      t.end = value;
      t.days = calcBusinessDays(parseLocalDate(t.start), parseLocalDate(t.end), holSet);
    } else if (field === 'assigneeId') {
      t.assigneeId = value;
      const a = state.assignees.find((x) => x.id === value);
      if (a && !t.color) t.color = a.color;
    } else if (field === 'progress') {
      t.progress = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    } else if (field === 'color') {
      t.color = value;
      pushHistory(before);
      const chartRows = document.querySelectorAll('#chart-body .chart-row');
      if (chartRows[idx]) {
        const bar = chartRows[idx].querySelector('.gantt-bar');
        if (bar) bar.style.background = value;
      }
      scheduleAutoSave();
      return;
    }
    pushHistory(before);
    render();
  }
  function addTask() {
    const before = snapshotState();
    const last = state.tasks[state.tasks.length - 1];
    const holSet = holidaySet();
    let startDate;
    if (last) {
      startDate = parseLocalDate(last.end);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      startDate = parseLocalDate(state.startDate) || new Date();
    }
    while (!isBusinessDay(startDate, holSet)) startDate.setDate(startDate.getDate() + 1);
    const days = 1;
    const end = calcEndDate(startDate, days, holSet);
    const assigneeId = state.assignees[0] ? state.assignees[0].id : '';
    const color = state.assignees[0] ? state.assignees[0].color : '#888888';
    state.tasks.push({
      name: '新規工程',
      assigneeId,
      days,
      start: formatDate(startDate),
      end: formatDate(end),
      color,
      progress: 0,
    });
    pushHistory(before);
    render();
  }
  function removeTask(idx) {
    const before = snapshotState();
    state.tasks.splice(idx, 1);
    pushHistory(before);
    render();
  }
  function moveTask(idx, delta) {
    const j = idx + delta;
    if (j < 0 || j >= state.tasks.length) return;
    const before = snapshotState();
    [state.tasks[idx], state.tasks[j]] = [state.tasks[j], state.tasks[idx]];
    pushHistory(before);
    render();
  }

  // ---------- rendering ----------
  const $ = (sel) => document.querySelector(sel);

  function render() {
    document.querySelectorAll('.color-popover').forEach((p) => p.remove());
    ensureTaskDates();
    renderAssigneeFilterOptions();
    renderTaskTable();
    renderGantt();
    renderStatus();
    $('#project-name').value = state.projectName || '';
    $('#input-start-date').value = state.startDate || '';
    $('#input-target-date').value = state.targetDate || '';
    $('#project-note').value = state.note || '';
    scheduleAutoSave();
  }

  function renderAssigneeFilterOptions() {
    const sel = $('#assignee-filter');
    if (!sel) return;
    const prev = assigneeFilterId;
    sel.innerHTML = '<option value="">全員</option>' +
      state.assignees.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`).join('');
    if (state.assignees.some((a) => a.id === prev)) {
      sel.value = prev;
    } else {
      assigneeFilterId = '';
      sel.value = '';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderTaskTable() {
    const tbody = $('#task-body');
    tbody.innerHTML = '';
    state.tasks.forEach((t, i) => {
      if (assigneeFilterId && t.assigneeId !== assigneeFilterId) return;
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      const assigneeOptions = state.assignees
        .map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === t.assigneeId ? 'selected' : ''}>${escapeHtml(a.label)}</option>`)
        .join('');
      tr.innerHTML = `
        <td class="drag-handle" title="ドラッグで並び替え">≡</td>
        <td><input type="text" data-field="name" value="${escapeHtml(t.name)}"></td>
        <td><select data-field="assigneeId">${assigneeOptions}</select></td>
        <td><input type="number" min="1" data-field="days" value="${t.days}"></td>
        <td><input type="date" data-field="start" value="${escapeHtml(t.start)}"></td>
        <td><input type="date" data-field="end" value="${escapeHtml(t.end)}"></td>
        <td><input type="number" min="0" max="100" data-field="progress" value="${t.progress || 0}"></td>
        <td class="color-cell"></td>
        <td>
          <button class="icon" data-action="up" title="上へ">↑</button>
          <button class="icon" data-action="down" title="下へ">↓</button>
          <button class="icon danger" data-action="del" title="削除">×</button>
        </td>`;
      const picker = createColorPicker(t.color || '#888888', (c) =>
        updateTaskField(i, 'color', c)
      );
      tr.querySelector('.color-cell').appendChild(picker);
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('tr').forEach((tr) => {
      const idx = Number(tr.dataset.index);
      tr.querySelectorAll('[data-field]').forEach((el) => {
        const field = el.dataset.field;
        const eventName = el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change';
        el.addEventListener(eventName, (e) => updateTaskField(idx, field, e.target.value));
        if (field === 'name') wireUndoableText(el);
      });
    });
    tbody.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        const idx = Number(row.dataset.index);
        const action = btn.dataset.action;
        if (action === 'up') moveTask(idx, -1);
        else if (action === 'down') moveTask(idx, 1);
        else if (action === 'del') removeTask(idx);
      });
    });
    setupDragDrop(tbody);
  }

  function setupDragDrop(tbody) {
    let dragIdx = null;
    tbody.querySelectorAll('tr').forEach((tr) => {
      const handle = tr.querySelector('.drag-handle');
      if (handle) {
        handle.draggable = true;
        handle.addEventListener('dragstart', (e) => {
          dragIdx = Number(tr.dataset.index);
          tr.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
      }
      tr.addEventListener('dragend', () => {
        tr.classList.remove('dragging');
        tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drop-target'));
      });
      tr.addEventListener('dragover', (e) => {
        if (dragIdx === null) return;
        e.preventDefault();
        tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drop-target'));
        tr.classList.add('drop-target');
      });
      tr.addEventListener('drop', (e) => {
        if (dragIdx === null) return;
        e.preventDefault();
        const dropIdx = Number(tr.dataset.index);
        if (dragIdx === dropIdx) {
          dragIdx = null;
          return;
        }
        const before = snapshotState();
        const [moved] = state.tasks.splice(dragIdx, 1);
        state.tasks.splice(dropIdx, 0, moved);
        pushHistory(before);
        dragIdx = null;
        render();
      });
    });
  }

  function attachBarInteractions(bar, idx, chartStart, dayWidth) {
    const leftHandle = document.createElement('div');
    leftHandle.className = 'gantt-bar-handle left';
    const rightHandle = document.createElement('div');
    rightHandle.className = 'gantt-bar-handle right';

    function startDrag(mode, e) {
      e.preventDefault();
      e.stopPropagation();
      const t = state.tasks[idx];
      const before = snapshotState();
      const origStart = parseLocalDate(t.start);
      const origEnd = parseLocalDate(t.end);
      const startX = e.clientX;
      let changed = false;
      let pendingStart = origStart;
      let pendingEnd = origEnd;
      const onMove = (ev) => {
        const dayDelta = Math.round((ev.clientX - startX) / dayWidth);
        let newStart = new Date(origStart);
        let newEnd = new Date(origEnd);
        if (mode === 'move') {
          newStart.setDate(newStart.getDate() + dayDelta);
          newEnd.setDate(newEnd.getDate() + dayDelta);
        } else if (mode === 'left') {
          newStart.setDate(newStart.getDate() + dayDelta);
          if (newStart > newEnd) newStart = new Date(newEnd);
        } else {
          newEnd.setDate(newEnd.getDate() + dayDelta);
          if (newEnd < newStart) newEnd = new Date(newStart);
        }
        const barLeft = Math.round((newStart - chartStart) / 86400000) * dayWidth + 2;
        const span = Math.round((newEnd - newStart) / 86400000) + 1;
        const barWidth = Math.max(span * dayWidth - 4, 6);
        bar.style.left = `${barLeft}px`;
        bar.style.width = `${barWidth}px`;
        pendingStart = newStart;
        pendingEnd = newEnd;
        changed = dayDelta !== 0;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (changed) {
          const holSet = holidaySet();
          t.start = formatDate(pendingStart);
          t.end = formatDate(pendingEnd);
          t.days = calcBusinessDays(parseLocalDate(t.start), parseLocalDate(t.end), holSet);
          pushHistory(before);
        }
        render();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    leftHandle.addEventListener('mousedown', (e) => startDrag('left', e));
    rightHandle.addEventListener('mousedown', (e) => startDrag('right', e));
    bar.addEventListener('mousedown', (e) => {
      if (e.target === leftHandle || e.target === rightHandle) return;
      startDrag('move', e);
    });
    bar.appendChild(leftHandle);
    bar.appendChild(rightHandle);
  }

  function renderGantt() {
    const leftList = $('#left-task-list');
    const monthRow = $('#month-row');
    const dayRow = $('#day-row');
    const chartBody = $('#chart-body');
    leftList.innerHTML = '';
    monthRow.innerHTML = '';
    dayRow.innerHTML = '';
    chartBody.innerHTML = '';

    if (state.tasks.length === 0) return;

    let minStart = parseLocalDate(state.tasks[0].start);
    let maxEnd = parseLocalDate(state.tasks[0].end);
    state.tasks.forEach((t) => {
      const s = parseLocalDate(t.start);
      const e = parseLocalDate(t.end);
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    });
    const projectStart = parseLocalDate(state.startDate);
    const chartStart = projectStart && projectStart < minStart ? projectStart : minStart;
    const calendarEnd = new Date(maxEnd);
    calendarEnd.setDate(calendarEnd.getDate() + 7);

    const totalDays = Math.round((calendarEnd - chartStart) / 86400000);
    const dayWidth = ZOOM_WIDTH[ganttZoom] || ZOOM_WIDTH.day;
    const totalChartWidth = (totalDays + 1) * dayWidth;
    const holSet = holidaySet();
    const milestoneSet = new Set((state.milestones || []).map((m) => m.date));
    const milestoneLabel = new Map((state.milestones || []).map((m) => [m.date, m.label || '']));

    const dayInfos = [];
    const monthCounts = {};
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(chartStart);
      d.setDate(d.getDate() + i);
      const iso = formatDate(d);
      const dn = d.getDay();
      const isHol = holSet.has(iso);
      const isMilestone = milestoneSet.has(iso);
      dayInfos.push({ date: d, iso, dn, isHol, isMilestone });
      const key = `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;

      const cell = document.createElement('div');
      cell.className =
        'day-cell ' + (isHol ? 'holiday' : dn === 6 ? 'weekend-sat' : dn === 0 ? 'weekend-sun' : '') +
        (isMilestone ? ' milestone-day' : '');
      cell.style.width = `${dayWidth}px`;
      if (isMilestone) cell.title = milestoneLabel.get(iso) || 'マイルストーン';
      if (ganttZoom === 'month') {
        cell.innerHTML = '';
      } else if (ganttZoom === 'week') {
        cell.innerHTML = `<span>${d.getDate()}</span>`;
      } else {
        cell.innerHTML = `<span>${d.getDate()}</span><span class="day-cell-week">${WEEK_LABELS[dn]}</span>`;
      }
      dayRow.appendChild(cell);
    }
    Object.keys(monthCounts).forEach((m) => {
      const mc = document.createElement('div');
      mc.className = 'month-cell';
      mc.style.width = `${monthCounts[m] * dayWidth}px`;
      mc.textContent = m;
      monthRow.appendChild(mc);
    });

    state.tasks.forEach((t, idx) => {
      if (assigneeFilterId && t.assigneeId !== assigneeFilterId) return;
      const a = state.assignees.find((x) => x.id === t.assigneeId);

      const lRow = document.createElement('div');
      lRow.className = 'row-item';
      lRow.innerHTML = `
        <div class="cell-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <div class="cell-role">${escapeHtml(a ? a.label : '')}</div>`;
      leftList.appendChild(lRow);

      const cRow = document.createElement('div');
      cRow.className = 'chart-row';
      cRow.style.width = `${totalChartWidth}px`;
      dayInfos.forEach((info, i) => {
        if (info.dn === 0 || info.dn === 6 || info.isHol) {
          const bg = document.createElement('div');
          const cls = info.isHol || info.dn === 0 ? 'weekend-sun' : 'weekend-sat';
          bg.className = 'day-bg ' + cls + (info.isHol ? ' holiday' : '');
          bg.style.left = `${i * dayWidth}px`;
          bg.style.width = `${dayWidth}px`;
          cRow.appendChild(bg);
        }
        if (info.isMilestone) {
          const marker = document.createElement('div');
          marker.className = 'milestone-marker';
          marker.style.left = `${i * dayWidth}px`;
          cRow.appendChild(marker);
        }
      });
      const ts = parseLocalDate(t.start);
      const te = parseLocalDate(t.end);
      const barLeft = Math.round((ts - chartStart) / 86400000) * dayWidth + 2;
      const span = Math.round((te - ts) / 86400000) + 1;
      const barWidth = Math.max(span * dayWidth - 4, 6);
      const bar = document.createElement('div');
      bar.className = 'gantt-bar';
      bar.style.left = `${barLeft}px`;
      bar.style.width = `${barWidth}px`;
      bar.style.background = t.color || '#666';
      bar.textContent = `${t.days}d`;
      if (t.progress) {
        const fill = document.createElement('div');
        fill.className = 'gantt-bar-progress';
        fill.style.width = `${Math.min(100, t.progress)}%`;
        bar.appendChild(fill);
      }
      attachBarInteractions(bar, idx, chartStart, dayWidth);
      cRow.appendChild(bar);
      chartBody.appendChild(cRow);
    });
  }

  function renderStatus() {
    if (state.tasks.length === 0) {
      $('#status-area').textContent = '';
      $('#status-area').className = '';
      return;
    }
    let maxEnd = parseLocalDate(state.tasks[0].end);
    state.tasks.forEach((t) => {
      const e = parseLocalDate(t.end);
      if (e > maxEnd) maxEnd = e;
    });
    const target = parseLocalDate(state.targetDate);
    const over = target && maxEnd > target;
    const label = `予測完了日: ${maxEnd.toLocaleDateString()} ${over ? '⚠ 納期オーバー' : '✓ オンスケジュール'}`;
    const el = $('#status-area');
    el.textContent = label;
    el.className = over ? 'over' : 'ok';
  }

  // ---------- modal helpers ----------
  function confirmModal(message, title) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      body.style.whiteSpace = 'pre-wrap';
      body.style.padding = '4px 0';
      body.textContent = message;

      $('#modal-title').textContent = title || '確認';
      const bodyEl = $('#modal-body');
      bodyEl.innerHTML = '';
      bodyEl.appendChild(body);

      const footer = document.querySelector('#modal-root .modal-footer');
      const origFooter = footer.innerHTML;
      footer.innerHTML = `
        <button type="button" id="modal-cancel">キャンセル</button>
        <button type="button" id="modal-ok" class="primary">OK</button>
      `;

      $('#modal-root').classList.remove('hidden');

      const cleanup = (result) => {
        $('#modal-root').classList.add('hidden');
        footer.innerHTML = origFooter;
        document.removeEventListener('keydown', onKey, true);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
        else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
      };
      document.addEventListener('keydown', onKey, true);

      document.getElementById('modal-ok').onclick = () => cleanup(true);
      document.getElementById('modal-cancel').onclick = () => cleanup(false);
      $('#modal-close').onclick = () => cleanup(false);
      document.querySelector('#modal-root .modal-backdrop').onclick = () => cleanup(false);
    });
  }

  function exportOrientationModal(title) {
    return new Promise((resolve) => {
      const body = document.createElement('div');
      body.style.padding = '12px 0';
      body.innerHTML = `
        <div class="hint-text">出力方向を選択してください。</div>
        <label class="inline-label-row">
          <span>出力方向:</span>
          <select id="export-orient-select">
            <option value="horizontal">横方向（日付を列に展開）</option>
            <option value="vertical">縦方向（日付を行に展開）</option>
          </select>
        </label>`;

      $('#modal-title').textContent = title || 'Excel出力';
      const bodyEl = $('#modal-body');
      bodyEl.innerHTML = '';
      bodyEl.appendChild(body);

      const footer = document.querySelector('#modal-root .modal-footer');
      const origFooter = footer.innerHTML;
      footer.innerHTML = `
        <button type="button" id="modal-cancel">キャンセル</button>
        <button type="button" id="modal-ok" class="primary">出力</button>
      `;

      $('#modal-root').classList.remove('hidden');

      const getVal = () => {
        const sel = document.getElementById('export-orient-select');
        return sel ? sel.value : 'horizontal';
      };
      const cleanup = (orientation) => {
        $('#modal-root').classList.add('hidden');
        footer.innerHTML = origFooter;
        document.removeEventListener('keydown', onKey, true);
        resolve(orientation);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
        else if (e.key === 'Enter') { e.preventDefault(); cleanup(getVal()); }
      };
      document.addEventListener('keydown', onKey, true);

      document.getElementById('modal-ok').onclick = () => cleanup(getVal());
      document.getElementById('modal-cancel').onclick = () => cleanup(null);
      $('#modal-close').onclick = () => cleanup(null);
      document.querySelector('#modal-root .modal-backdrop').onclick = () => cleanup(null);
    });
  }

  function openModal(title, bodyEl, onOk) {
    $('#modal-title').textContent = title;
    const body = $('#modal-body');
    body.innerHTML = '';
    body.appendChild(bodyEl);
    $('#modal-root').classList.remove('hidden');
    const close = () => {
      $('#modal-root').classList.add('hidden');
      $('#modal-ok').onclick = null;
      $('#modal-close').onclick = null;
    };
    $('#modal-close').onclick = close;
    $('#modal-root .modal-backdrop').onclick = close;
    $('#modal-ok').onclick = () => {
      if (onOk) onOk();
      close();
    };
  }

  function openAssigneesModal() {
    const wrap = document.createElement('div');
    wrap.className = 'assignee-list';
    const draft = state.assignees.map((a) => ({ ...a }));
    function repaint() {
      wrap.innerHTML = '';
      draft.forEach((a, i) => {
        const row = document.createElement('div');
        row.className = 'assignee-row';
        row.innerHTML = `
          <input type="text" value="${escapeHtml(a.label)}" placeholder="担当名">
          <button class="icon danger" type="button">×</button>`;
        const labelEl = row.querySelector('input[type="text"]');
        const delBtn = row.querySelector('button');
        labelEl.addEventListener('change', (e) => (draft[i].label = e.target.value));
        delBtn.addEventListener('click', () => {
          draft.splice(i, 1);
          repaint();
        });
        wrap.appendChild(row);
      });
      const add = document.createElement('div');
      add.className = 'add-row';
      add.innerHTML = `<button type="button">＋ 担当を追加</button>`;
      add.querySelector('button').addEventListener('click', () => {
        const id = 'a' + Date.now() + Math.floor(Math.random() * 1000);
        draft.push({ id, label: '新規担当', color: '#888888' });
        repaint();
      });
      wrap.appendChild(add);
    }
    repaint();
    openModal('担当マスタの編集', wrap, () => {
      const before = snapshotState();
      const valid = draft.filter((a) => a.label && a.label.trim() !== '');
      valid.forEach((a) => {
        if (!a.id) a.id = 'a' + Date.now() + Math.floor(Math.random() * 1000);
      });
      const validIds = new Set(valid.map((a) => a.id));
      state.assignees = valid;
      state.tasks.forEach((t) => {
        if (!validIds.has(t.assigneeId)) {
          t.assigneeId = valid[0] ? valid[0].id : '';
        }
      });
      pushHistory(before);
      render();
    });
  }

  function openHolidaysModal() {
    const container = document.createElement('div');
    const fetchBar = document.createElement('div');
    fetchBar.className = 'holiday-fetch-bar';
    const nowYear = new Date().getFullYear();
    fetchBar.innerHTML = `
      <label>取得範囲:
        <input type="number" id="hol-year-from" value="${nowYear}" min="1955" max="2100" class="year-range-input">
        〜
        <input type="number" id="hol-year-to" value="${nowYear + 2}" min="1955" max="2100" class="year-range-input">
      </label>
      <button type="button" id="btn-fetch-holidays">日本の祝日を自動取得</button>
      <span id="fetch-status" class="fetch-status-text"></span>`;
    container.appendChild(fetchBar);

    const wrap = document.createElement('div');
    wrap.className = 'holiday-list';
    container.appendChild(wrap);
    const draft = (state.holidays || []).map((h) => ({ ...h }));

    function repaint() {
      wrap.innerHTML = '';
      draft
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      draft.forEach((h, i) => {
        const row = document.createElement('div');
        row.className = 'holiday-row';
        row.innerHTML = `
          <input type="date" value="${escapeHtml(h.date)}">
          <input type="text" value="${escapeHtml(h.label || '')}" placeholder="名称（任意）" class="flex-1">
          <button class="icon danger" type="button">×</button>`;
        const [dateEl, labelEl, delBtn] = row.querySelectorAll('input, button');
        dateEl.addEventListener('change', (e) => (draft[i].date = e.target.value));
        labelEl.addEventListener('change', (e) => (draft[i].label = e.target.value));
        delBtn.addEventListener('click', () => {
          draft.splice(i, 1);
          repaint();
        });
        wrap.appendChild(row);
      });
      const add = document.createElement('div');
      add.className = 'add-row';
      add.innerHTML = `<button type="button">＋ 祝日を追加</button>`;
      add.querySelector('button').addEventListener('click', () => {
        draft.push({ date: state.startDate || formatDate(new Date()), label: '' });
        repaint();
      });
      wrap.appendChild(add);
    }
    repaint();

    fetchBar.querySelector('#btn-fetch-holidays').addEventListener('click', async () => {
      const status = fetchBar.querySelector('#fetch-status');
      const yFrom = parseInt(fetchBar.querySelector('#hol-year-from').value, 10);
      const yTo = parseInt(fetchBar.querySelector('#hol-year-to').value, 10);
      if (!window.api || !window.api.fetchHolidays) {
        status.textContent = 'API未対応';
        return;
      }
      status.textContent = '取得中…';
      const res = await window.api.fetchHolidays({ yearFrom: yFrom, yearTo: yTo });
      if (!res || !res.ok) {
        status.textContent = '取得失敗: ' + (res && res.error ? res.error : '不明なエラー');
        return;
      }
      const existing = new Set(draft.map((h) => h.date));
      let added = 0;
      res.list.forEach((h) => {
        if (!existing.has(h.date)) {
          draft.push({ date: h.date, label: h.label });
          existing.add(h.date);
          added++;
        }
      });
      draft.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      status.textContent = `取得完了: 新規追加 ${added} 件 / 合計 ${res.list.length} 件`;
      repaint();
    });

    openModal('祝日・休暇の編集', container, () => {
      const before = snapshotState();
      const sorted = draft
        .filter((h) => h.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      state.holidays = sorted;
      state.tasks.forEach((t) => {
        if (t.start && t.end) {
          t.end = formatDate(calcEndDate(parseLocalDate(t.start), t.days, holidaySet()));
        }
      });
      pushHistory(before);
      render();
    });
  }

  function openMilestonesModal() {
    const wrap = document.createElement('div');
    wrap.className = 'holiday-list';
    const draft = (state.milestones || []).map((m) => ({ ...m }));
    function repaint() {
      wrap.innerHTML = '';
      draft.forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'holiday-row';
        row.innerHTML = `
          <input type="date" value="${escapeHtml(m.date)}">
          <input type="text" value="${escapeHtml(m.label || '')}" placeholder="名称（任意）" class="flex-1">
          <button class="icon danger" type="button">×</button>`;
        const [dateEl, labelEl, delBtn] = row.querySelectorAll('input, button');
        dateEl.addEventListener('change', (e) => (draft[i].date = e.target.value));
        labelEl.addEventListener('change', (e) => (draft[i].label = e.target.value));
        delBtn.addEventListener('click', () => {
          draft.splice(i, 1);
          repaint();
        });
        wrap.appendChild(row);
      });
      const add = document.createElement('div');
      add.className = 'add-row';
      add.innerHTML = `<button type="button">＋ マイルストーンを追加</button>`;
      add.querySelector('button').addEventListener('click', () => {
        draft.push({ date: state.startDate || formatDate(new Date()), label: '' });
        repaint();
      });
      wrap.appendChild(add);
    }
    repaint();

    openModal('マイルストーンの編集', wrap, () => {
      const before = snapshotState();
      state.milestones = draft
        .filter((m) => m.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      pushHistory(before);
      render();
    });
  }

  // ---------- file ops ----------
  function snapshot() {
    return {
      projectName: state.projectName,
      startDate: state.startDate,
      targetDate: state.targetDate,
      note: state.note,
      holidays: state.holidays.map((h) => h.date),
      holidaysDetailed: state.holidays,
      assignees: state.assignees,
      tasks: state.tasks,
      milestones: state.milestones,
    };
  }
  function loadFromData(data) {
    if (!data || typeof data !== 'object') return;
    state.projectName = data.projectName != null ? data.projectName : '';
    state.startDate = data.startDate != null ? data.startDate : '';
    state.targetDate = data.targetDate != null ? data.targetDate : '';
    state.note = data.note != null ? data.note : '';
    if (Array.isArray(data.holidaysDetailed)) {
      state.holidays = data.holidaysDetailed;
    } else if (Array.isArray(data.holidays)) {
      state.holidays = data.holidays.map((d) =>
        typeof d === 'string' ? { date: d, label: '' } : d
      );
    } else {
      state.holidays = [];
    }
    state.assignees = Array.isArray(data.assignees) ? data.assignees : [];
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    state.milestones = Array.isArray(data.milestones) ? data.milestones : [];
    historyUndo = [];
    historyRedo = [];
    render();
  }

  // ---------- wiring ----------
  function wire() {
    wireUndoableText($('#project-name'));
    $('#project-name').addEventListener('input', (e) => {
      state.projectName = e.target.value;
      scheduleAutoSave();
    });
    $('#input-start-date').addEventListener('change', (e) => {
      const before = snapshotState();
      state.startDate = e.target.value;
      recalcAll();
      pushHistory(before);
      render();
    });
    $('#input-target-date').addEventListener('change', (e) => {
      const before = snapshotState();
      state.targetDate = e.target.value;
      pushHistory(before);
      render();
    });
    wireUndoableText($('#project-note'));
    $('#project-note').addEventListener('input', (e) => {
      state.note = e.target.value;
      scheduleAutoSave();
    });
    $('#btn-reset-schedule').addEventListener('click', () => {
      const before = snapshotState();
      recalcAll();
      pushHistory(before);
      render();
    });
    $('#btn-add-task').addEventListener('click', addTask);
    $('#btn-open-assignees').addEventListener('click', openAssigneesModal);
    $('#btn-open-holidays').addEventListener('click', openHolidaysModal);
    $('#btn-open-milestones').addEventListener('click', openMilestonesModal);
    $('#gantt-zoom').addEventListener('change', (e) => {
      ganttZoom = e.target.value;
      renderGantt();
    });
    $('#assignee-filter').addEventListener('change', (e) => {
      assigneeFilterId = e.target.value;
      renderTaskTable();
      renderGantt();
    });

    if (window.api && window.api.onMenu) {
      window.api.onMenu(async (action, payload) => {
        if (action === 'toggle-theme') {
          toggleTheme();
        } else if (action === 'undo') {
          undo();
        } else if (action === 'redo') {
          redo();
        } else if (action === 'open-recent') {
          if (payload && payload.data) loadFromData(payload.data);
        } else if (action === 'new') {
          const ok = await confirmModal('現在の編集内容は破棄されます。新規プロジェクトを作成しますか？');
          if (!ok) return;
          await window.api.newProject();
          state = EMPTY_STATE();
          historyUndo = [];
          historyRedo = [];
          render();
        } else if (action === 'open') {
          const res = await window.api.openProject();
          if (res && res.data) loadFromData(res.data);
        } else if (action === 'save') {
          await window.api.saveProject(snapshot());
        } else if (action === 'saveAs') {
          await window.api.saveProjectAs(snapshot());
        } else if (action === 'exportExcel') {
          const orientation = await exportOrientationModal('Excel出力');
          if (!orientation) return;
          await window.api.exportExcel(snapshot(), orientation);
        } else if (action === 'about') {
          const ver = window.api && window.api.getVersion
            ? await window.api.getVersion()
            : '';
          const body = document.createElement('div');
          body.style.padding = '24px 8px';
          body.style.textAlign = 'center';
          body.style.lineHeight = '2';
          body.innerHTML = `
            <div class="about-title">YMB Schedule Builder</div>
            <div class="about-version">v${ver}</div>
            <div class="about-author">author : ymb</div>`;
          openModal('このアプリについて', body, () => {});
        }
      });
    }
  }

  // ---------- boot ----------
  async function boot() {
    wire();
    let restored = null;
    if (window.api && window.api.loadLastState) {
      try {
        restored = await window.api.loadLastState();
      } catch {
        restored = null;
      }
    }
    if (restored && typeof restored === 'object') {
      loadFromData(restored);
    } else {
      state = EMPTY_STATE();
      render();
    }
    suppressAutoSave = false;
  }
  document.addEventListener('DOMContentLoaded', () => {
    boot();
  });
})();
