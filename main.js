const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const ExcelJS = require('exceljs');

let mainWindow = null;
let currentProjectPath = null;

// ---------- 最近使ったファイル ----------
const RECENT_MAX = 8;

function recentFilesPath() {
  return path.join(app.getPath('userData'), 'recentFiles.json');
}

async function getRecentFiles() {
  try {
    const text = await fs.readFile(recentFilesPath(), 'utf-8');
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function addRecentFile(filePath) {
  let list = await getRecentFiles();
  list = [filePath, ...list.filter((p) => p !== filePath)].slice(0, RECENT_MAX);
  await fs.writeFile(recentFilesPath(), JSON.stringify(list, null, 2), 'utf-8');
  buildMenu();
}

async function openRecentFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(text);
    currentProjectPath = filePath;
    mainWindow.setTitle(`YMB Schedule Builder - ${path.basename(filePath)}`);
    mainWindow.webContents.send('menu-action', 'open-recent', { data, filePath });
  } catch (e) {
    dialog.showErrorBox('読み込みエラー', `ファイルを開けませんでした:\n${filePath}\n\n${e.message || e}`);
    // 存在しないファイルはリストから除外
    let list = await getRecentFiles();
    list = list.filter((p) => p !== filePath);
    await fs.writeFile(recentFilesPath(), JSON.stringify(list, null, 2), 'utf-8');
    buildMenu();
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'YMB Schedule Builder',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  await buildMenu();
}

async function buildMenu() {
  const isMac = process.platform === 'darwin';
  const recentFiles = await getRecentFiles();

  const recentSubmenu = recentFiles.length > 0
    ? [
        ...recentFiles.map((f) => ({
          label: path.basename(f),
          sublabel: path.dirname(f),
          click: () => openRecentFile(f),
        })),
        { type: 'separator' },
        {
          label: '最近使ったファイルを消去',
          click: async () => {
            await fs.writeFile(recentFilesPath(), '[]', 'utf-8');
            buildMenu();
          },
        },
      ]
    : [{ label: '（なし）', enabled: false }];

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'ファイル',
      submenu: [
        { label: '新規プロジェクト', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
        { label: '開く...', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open') },
        { label: '最近使ったファイル', submenu: recentSubmenu },
        { type: 'separator' },
        { label: '上書き保存', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
        { label: '名前を付けて保存...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenu('saveAs') },
        { type: 'separator' },
        { label: 'Excel出力...', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('exportExcel') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '終了' },
      ],
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直し' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
      ],
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: '再読み込み' },
        { role: 'toggleDevTools', label: '開発者ツール' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'ズームリセット' },
        { role: 'zoomIn', label: 'ズームイン' },
        { role: 'zoomOut', label: 'ズームアウト' },
      ],
    },
    {
      label: 'ヘルプ',
      submenu: [
        { label: 'このアプリについて', click: () => sendMenu('about') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendMenu(action, payload) {
  if (mainWindow) mainWindow.webContents.send('menu-action', action, payload);
}

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'プロジェクトを開く',
    filters: [{ name: 'Schedule Project', extensions: ['json', 'schedule'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(text);
    currentProjectPath = filePath;
    mainWindow.setTitle(`YMB Schedule Builder - ${path.basename(filePath)}`);
    await addRecentFile(filePath);
    return { data, filePath };
  } catch (e) {
    dialog.showErrorBox('読み込みエラー', String(e.message || e));
    return null;
  }
});

ipcMain.handle('project:save', async (_e, data) => {
  let filePath = currentProjectPath;
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '名前を付けて保存',
      defaultPath: 'schedule.json',
      filters: [{ name: 'Schedule Project', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    currentProjectPath = filePath;
    mainWindow.setTitle(`YMB Schedule Builder - ${path.basename(filePath)}`);
    await addRecentFile(filePath);
    return { filePath };
  } catch (e) {
    dialog.showErrorBox('保存エラー', String(e.message || e));
    return null;
  }
});

ipcMain.handle('project:saveAs', async (_e, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '名前を付けて保存',
    defaultPath: currentProjectPath || 'schedule.json',
    filters: [{ name: 'Schedule Project', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return null;
  try {
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    currentProjectPath = result.filePath;
    mainWindow.setTitle(`schedule_builder - ${path.basename(result.filePath)}`);
    await addRecentFile(result.filePath);
    return { filePath: result.filePath };
  } catch (e) {
    dialog.showErrorBox('保存エラー', String(e.message || e));
    return null;
  }
});

ipcMain.handle('project:new', async () => {
  currentProjectPath = null;
  mainWindow.setTitle('YMB Schedule Builder');
  return true;
});

function lastSessionPath() {
  return path.join(app.getPath('userData'), 'lastSession.json');
}

ipcMain.handle('state:loadLast', async () => {
  try {
    const text = await fs.readFile(lastSessionPath(), 'utf-8');
    return JSON.parse(text);
  } catch {
    return null;
  }
});

ipcMain.handle('state:saveLast', async (_e, data) => {
  try {
    await fs.writeFile(lastSessionPath(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('holidays:fetch', async (_e, opts) => {
  const yearFrom = opts && opts.yearFrom;
  const yearTo = opts && opts.yearTo;
  try {
    const res = await fetch('https://holidays-jp.github.io/api/v1/date.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const list = Object.entries(data)
      .map(([date, label]) => ({ date, label }))
      .filter((h) => {
        const y = parseInt(h.date.slice(0, 4), 10);
        return (!yearFrom || y >= yearFrom) && (!yearTo || y <= yearTo);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return { ok: true, list };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('project:exportExcel', async (_e, data, orientation) => {
  const defaultName = (data.projectName || 'schedule') + '.xlsx';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Excelとして出力',
    defaultPath: defaultName,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return null;
  try {
    if (orientation === 'vertical') {
      await writeExcelVertical(result.filePath, data);
    } else {
      await writeExcelHorizontal(result.filePath, data);
    }
    return { filePath: result.filePath };
  } catch (e) {
    dialog.showErrorBox('Excel出力エラー', String(e.message || e));
    return null;
  }
});

function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDateISO(d) {
  const z = (n) => ('0' + n).slice(-2);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function hexToArgb(hex) {
  let h = (hex || '#cccccc').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return 'FF' + h.toUpperCase();
}

async function writeExcelHorizontal(filePath, data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YMB Schedule Builder';
  wb.created = new Date();
  const ws = wb.addWorksheet('schedule', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
  });

  const tasks = data.tasks || [];
  const holidays = new Set(data.holidays || []);
  const assignees = data.assignees || [];
  const findAssignee = (id) => assignees.find((a) => a.id === id);

  if (tasks.length === 0) {
    ws.getCell('A1').value = '工程がありません';
    await wb.xlsx.writeFile(filePath);
    return;
  }

  let minStart = parseLocalDate(tasks[0].start);
  let maxEnd = parseLocalDate(tasks[0].end);
  tasks.forEach((t) => {
    const s = parseLocalDate(t.start);
    const e = parseLocalDate(t.end);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });
  if (data.targetDate) {
    const dl = parseLocalDate(data.targetDate);
    if (dl && dl > maxEnd) maxEnd = dl;
  }

  const dates = [];
  const cur = new Date(minStart);
  while (cur <= maxEnd) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const WEEKEND_SAT_ARGB = 'FFE7EEFA';
  const WEEKEND_SUN_ARGB = 'FFFCE4E4';
  const HEADER_ARGB = 'FFEFEFEF';
  const MONTH_ARGB = 'FFE2E8F0';

  const dateColStart = 4; // D列
  const totalCols = dateColStart - 1 + dates.length;

  const headerBorder = {
    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  };

  // Row 1: タイトル (全列マージ)
  const titleText = data.projectName || 'スケジュール';
  ws.getCell(1, 1).value = titleText;
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 左 3 列 (A〜C) を行 2〜4 で縦結合し、ヘッダラベルを表示
  ws.mergeCells(2, 1, 4, 1);
  ws.mergeCells(2, 2, 4, 2);
  ws.mergeCells(2, 3, 4, 3);
  const leftHeaders = [
    { addr: 'A2', label: '作業項目' },
    { addr: 'B2', label: '担当' },
    { addr: 'C2', label: '営業日' },
  ];
  leftHeaders.forEach(({ addr, label }) => {
    const c = ws.getCell(addr);
    c.value = label;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    c.border = headerBorder;
  });

  // Row 2: 年月 (月単位でセル結合)
  let monthStartCol = null;
  let monthKey = null;
  const flushMonth = (endCol) => {
    if (monthStartCol === null) return;
    if (endCol > monthStartCol) {
      ws.mergeCells(2, monthStartCol, 2, endCol);
    }
    const mc = ws.getCell(2, monthStartCol);
    mc.value = monthKey;
    mc.font = { bold: true, size: 11 };
    mc.alignment = { horizontal: 'center', vertical: 'middle' };
    mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MONTH_ARGB } };
    mc.border = headerBorder;
  };
  dates.forEach((d, i) => {
    const col = dateColStart + i;
    const key = `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
    if (key !== monthKey) {
      flushMonth(col - 1);
      monthKey = key;
      monthStartCol = col;
    }
  });
  flushMonth(dateColStart + dates.length - 1);

  // Row 3: 日付 / Row 4: 曜日
  dates.forEach((d, i) => {
    const col = dateColStart + i;
    const iso = formatDateISO(d);
    const isHoliday = holidays.has(iso);
    const dn = d.getDay();

    const dateCell = ws.getCell(3, col);
    dateCell.value = d.getDate();
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.border = headerBorder;

    const wkCell = ws.getCell(4, col);
    wkCell.value = WEEK[dn];
    wkCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wkCell.border = headerBorder;

    let bgArgb = HEADER_ARGB;
    let fontColor = null;
    if (isHoliday || dn === 0) {
      bgArgb = WEEKEND_SUN_ARGB;
      fontColor = 'FFE11D48';
    } else if (dn === 6) {
      bgArgb = WEEKEND_SAT_ARGB;
      fontColor = 'FF2563EB';
    }
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    wkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    dateCell.font = { size: 10, bold: true, ...(fontColor ? { color: { argb: fontColor } } : {}) };
    wkCell.font = { size: 10, bold: true, ...(fontColor ? { color: { argb: fontColor } } : {}) };
  });

  // Row 5+: 工程行
  const taskRowStart = 5;
  tasks.forEach((t, idx) => {
    const r = taskRowStart + idx;
    const assignee = findAssignee(t.assigneeId);
    ws.getCell(r, 1).value = t.name;
    ws.getCell(r, 2).value = assignee ? assignee.label : '';
    ws.getCell(r, 3).value = t.days;
    ws.getCell(r, 1).alignment = { vertical: 'middle' };
    ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(r, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let i = 1; i <= 3; i++) ws.getCell(r, i).border = headerBorder;

    const taskStart = parseLocalDate(t.start);
    const taskEnd = parseLocalDate(t.end);
    const taskArgb = hexToArgb(t.color || (assignee && assignee.color) || '#888888');

    dates.forEach((d, i) => {
      const col = dateColStart + i;
      const cell = ws.getCell(r, col);
      const iso = formatDateISO(d);
      const isHoliday = holidays.has(iso);
      const inRange = d >= taskStart && d <= taskEnd;

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };

      if (isHoliday || d.getDay() === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WEEKEND_SUN_ARGB } };
      } else if (d.getDay() === 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WEEKEND_SAT_ARGB } };
      } else if (inRange) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: taskArgb } };
      }
    });
  });

  // 列幅
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 8;
  for (let i = 0; i < dates.length; i++) ws.getColumn(dateColStart + i).width = 3.6;

  // 行高
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 22;
  for (let i = 0; i < tasks.length; i++) ws.getRow(taskRowStart + i).height = 22;

  if (data.note) {
    const noteRow = taskRowStart + tasks.length + 1;
    ws.mergeCells(noteRow, 1, noteRow, 3);
    const c = ws.getCell(noteRow, 1);
    c.value = data.note;
    c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    c.font = { size: 11 };
    c.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
    ws.getRow(noteRow).height = 100;
  }

  await wb.xlsx.writeFile(filePath);
}

async function writeExcelVertical(filePath, data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YMB Schedule Builder';
  wb.created = new Date();
  const ws = wb.addWorksheet('schedule', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
  });

  const tasks = data.tasks || [];
  const holidays = new Set(data.holidays || []);
  const assignees = data.assignees || [];
  const findAssignee = (id) => assignees.find((a) => a.id === id);

  if (tasks.length === 0) {
    ws.getCell('A1').value = '工程がありません';
    await wb.xlsx.writeFile(filePath);
    return;
  }

  let minStart = parseLocalDate(tasks[0].start);
  let maxEnd = parseLocalDate(tasks[0].end);
  tasks.forEach((t) => {
    const s = parseLocalDate(t.start);
    const e = parseLocalDate(t.end);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  });
  if (data.targetDate) {
    const dl = parseLocalDate(data.targetDate);
    if (dl && dl > maxEnd) maxEnd = dl;
  }

  const dates = [];
  const cur = new Date(minStart);
  while (cur <= maxEnd) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const WEEKEND_SAT_ARGB = 'FFE7EEFA';
  const WEEKEND_SUN_ARGB = 'FFFCE4E4';
  const HEADER_ARGB = 'FFEFEFEF';
  const MONTH_ARGB = 'FFE2E8F0';

  const taskColStart = 4; // D列からタスク
  const totalCols = taskColStart - 1 + tasks.length;
  const dateRowStart = 5; // Row 5 から日付行

  const headerBorder = {
    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  };

  // Row 1: タイトル (全列マージ)
  const titleText = data.projectName || 'スケジュール';
  ws.getCell(1, 1).value = titleText;
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 左 3 列 (A〜C) を行 2〜4 で縦結合し、日付軸ヘッダラベルを表示
  ws.mergeCells(2, 1, 4, 1);
  ws.mergeCells(2, 2, 4, 2);
  ws.mergeCells(2, 3, 4, 3);
  [
    { col: 1, label: '年月' },
    { col: 2, label: '日付' },
    { col: 3, label: '曜日' },
  ].forEach(({ col, label }) => {
    const c = ws.getCell(2, col);
    c.value = label;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    c.border = headerBorder;
  });

  // Row 2: 工程名 / Row 3: 担当 / Row 4: 営業日数 (タスク列)
  tasks.forEach((t, ti) => {
    const col = taskColStart + ti;
    const assignee = findAssignee(t.assigneeId);
    const taskArgb = hexToArgb(t.color || (assignee && assignee.color) || '#888888');

    const nameCell = ws.getCell(2, col);
    nameCell.value = t.name;
    nameCell.font = { bold: true, size: 10 };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: taskArgb } };
    nameCell.border = headerBorder;

    const assigneeCell = ws.getCell(3, col);
    assigneeCell.value = assignee ? assignee.label : '';
    assigneeCell.font = { size: 10 };
    assigneeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    assigneeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    assigneeCell.border = headerBorder;

    const daysCell = ws.getCell(4, col);
    daysCell.value = t.days;
    daysCell.font = { size: 10 };
    daysCell.alignment = { horizontal: 'center', vertical: 'middle' };
    daysCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    daysCell.border = headerBorder;
  });

  // Row 5+: 日付行
  let monthStartRow = null;
  let monthKey = null;
  const flushMonth = (endRow) => {
    if (monthStartRow === null) return;
    if (endRow > monthStartRow) ws.mergeCells(monthStartRow, 1, endRow, 1);
    const mc = ws.getCell(monthStartRow, 1);
    mc.value = monthKey;
    mc.font = { bold: true, size: 11 };
    mc.alignment = { horizontal: 'center', vertical: 'middle' };
    mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MONTH_ARGB } };
    mc.border = headerBorder;
  };

  dates.forEach((d, i) => {
    const row = dateRowStart + i;
    const iso = formatDateISO(d);
    const isHoliday = holidays.has(iso);
    const dn = d.getDay();

    // 年月マージ
    const key = `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
    if (key !== monthKey) {
      flushMonth(row - 1);
      monthKey = key;
      monthStartRow = row;
    }

    // 日付セル (Col B)
    const dateCell = ws.getCell(row, 2);
    dateCell.value = d.getDate();
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.border = headerBorder;

    // 曜日セル (Col C)
    const wkCell = ws.getCell(row, 3);
    wkCell.value = WEEK[dn];
    wkCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wkCell.border = headerBorder;

    let bgArgb = HEADER_ARGB;
    let fontColor = null;
    if (isHoliday || dn === 0) {
      bgArgb = WEEKEND_SUN_ARGB;
      fontColor = 'FFE11D48';
    } else if (dn === 6) {
      bgArgb = WEEKEND_SAT_ARGB;
      fontColor = 'FF2563EB';
    }
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    wkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    dateCell.font = { size: 10, bold: true, ...(fontColor ? { color: { argb: fontColor } } : {}) };
    wkCell.font = { size: 10, bold: true, ...(fontColor ? { color: { argb: fontColor } } : {}) };

    // 工程セル (Col D+)
    tasks.forEach((t, ti) => {
      const col = taskColStart + ti;
      const cell = ws.getCell(row, col);
      const taskStart = parseLocalDate(t.start);
      const taskEnd = parseLocalDate(t.end);
      const inRange = d >= taskStart && d <= taskEnd;
      const assignee = findAssignee(t.assigneeId);
      const taskArgb = hexToArgb(t.color || (assignee && assignee.color) || '#888888');

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };

      if (isHoliday || dn === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WEEKEND_SUN_ARGB } };
      } else if (dn === 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WEEKEND_SAT_ARGB } };
      } else if (inRange) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: taskArgb } };
      }
    });
  });
  flushMonth(dateRowStart + dates.length - 1);

  // 列幅
  ws.getColumn(1).width = 14; // 年月
  ws.getColumn(2).width = 7;  // 日付
  ws.getColumn(3).width = 7;  // 曜日
  for (let i = 0; i < tasks.length; i++) ws.getColumn(taskColStart + i).width = 10;

  // 行高
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 36; // 工程名
  ws.getRow(3).height = 20; // 担当
  ws.getRow(4).height = 20; // 営業日
  for (let i = 0; i < dates.length; i++) ws.getRow(dateRowStart + i).height = 18;

  // 備考
  if (data.note) {
    const noteRow = dateRowStart + dates.length + 1;
    ws.mergeCells(noteRow, 1, noteRow, 3);
    const c = ws.getCell(noteRow, 1);
    c.value = data.note;
    c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    c.font = { size: 11 };
    c.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
    ws.getRow(noteRow).height = 60;
  }

  await wb.xlsx.writeFile(filePath);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
