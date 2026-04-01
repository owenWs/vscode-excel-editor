// @ts-check
'use strict';

const vscode = acquireVsCodeApi();

// ---- 全局状态 ----
const state = {
  sheets: [],
  activeSheet: '',
  data: [],
  selectedRow: 0,
  selectedCol: 0,
  editingCell: null,      // { row, col, td, input } | null
  selectionMode: 'cell',  // 'cell' | 'row' | 'col'
  selectedRows: new Set(),  // Set<number>
  selectedCols: new Set(),  // Set<number>
  lastClickedRow: -1,       // Shift+Click 锚点
  lastClickedCol: -1,
  clipboard: null,  // { type:'rows'|'cols'|'cell', rowIndices?, colIndices?, value?, sheetName? }
};

// ---- DOM 引用 ----
const tabsEl       = document.getElementById('sheet-tabs');
const tableWrapper = document.getElementById('table-wrapper');
const formulaInput = document.getElementById('formula-input');
const cellAddrEl   = document.getElementById('cell-addr');
const statusMsg    = document.getElementById('status-msg');
const addSheetBtn  = document.getElementById('btn-add-sheet');
const copySheetBtn = document.getElementById('btn-copy-sheet');
const addRowsBtn   = document.getElementById('btn-add-rows');
const addRowsInput = document.getElementById('input-add-rows');
const addColsBtn   = document.getElementById('btn-add-cols');
const addColsInput = document.getElementById('input-add-cols');

// ---- 右键上下文菜单 ----
const contextMenu = document.createElement('div');
contextMenu.id = 'context-menu';
contextMenu.className = 'context-menu';
document.body.appendChild(contextMenu);

function showContextMenu(x, y, items) {
  contextMenu.innerHTML = '';
  for (const item of items) {
    if (item === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'context-menu-sep';
      contextMenu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'context-menu-item' + (item.disabled ? ' disabled' : '');
      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      el.appendChild(labelSpan);
      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'ctx-shortcut';
        sc.textContent = item.shortcut;
        el.appendChild(sc);
      }
      if (!item.disabled && item.action) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          hideContextMenu();
          item.action();
        });
      }
      contextMenu.appendChild(el);
    }
  }
  contextMenu.classList.add('visible');
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  const menuW = contextMenu.offsetWidth;
  const menuH = contextMenu.offsetHeight;
  const left = Math.max(0, Math.min(x, window.innerWidth  - menuW - 4));
  const top  = Math.max(0, Math.min(y, window.innerHeight - menuH - 4));
  contextMenu.style.left = left + 'px';
  contextMenu.style.top  = top  + 'px';
}

function hideContextMenu() { contextMenu.classList.remove('visible'); }
document.addEventListener('click', hideContextMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hideContextMenu(); hideModal(); }
});

// ---- 模态对话框 ----
const modalOverlay = document.createElement('div');
modalOverlay.className = 'modal-overlay';
modalOverlay.innerHTML = `
  <div class="modal">
    <div class="modal-title" id="modal-title"></div>
    <input type="text" class="modal-input" id="modal-input" autocomplete="off" spellcheck="false" />
    <div class="modal-actions">
      <button class="modal-btn modal-btn-secondary" id="modal-cancel">取消</button>
      <button class="modal-btn modal-btn-primary" id="modal-confirm">确定</button>
    </div>
  </div>`;
document.body.appendChild(modalOverlay);

const modalTitle   = /** @type {HTMLElement} */      (document.getElementById('modal-title'));
const modalInput   = /** @type {HTMLInputElement} */ (document.getElementById('modal-input'));
const modalCancel  = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

/** @type {((val: string) => void) | null} */
let _modalCallback = null;

function showModal(title, defaultValue, callback) {
  modalTitle.textContent = title;
  modalInput.value = defaultValue;
  _modalCallback = callback;
  modalOverlay.classList.add('visible');
  setTimeout(() => { modalInput.focus(); modalInput.select(); }, 50);
}
function hideModal() { modalOverlay.classList.remove('visible'); _modalCallback = null; }
function confirmModal() {
  const val = modalInput.value.trim();
  if (!val) { return; }
  const cb = _modalCallback;
  hideModal();
  if (cb) { cb(val); }
}
if (modalConfirm) { modalConfirm.addEventListener('click', confirmModal); }
if (modalCancel)  { modalCancel.addEventListener('click', hideModal); }
if (modalInput) {
  modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); confirmModal(); }
    if (e.key === 'Escape') { e.preventDefault(); hideModal(); }
    e.stopPropagation();
  });
}
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) { hideModal(); } });

// ---- 工具函数 ----
function colIndexToLetter(idx) {
  let s = '', n = idx + 1;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}
function updateStatus(msg) { if (statusMsg) { statusMsg.textContent = msg; } }
function sortedArray(set) { return [...set].sort((a, b) => a - b); }

function generateCopyName(baseName) {
  const existing = new Set(state.sheets.map(s => s.name));
  let i = 2, name = `${baseName} (${i})`;
  while (existing.has(name)) { i++; name = `${baseName} (${i})`; }
  return name;
}

// ---- 接收 Extension 消息 ----
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'loadSheets':
      state.sheets = msg.sheets;
      state.activeSheet = msg.activeSheet;
      renderTabs();
      break;
    case 'loadSheetData':
      state.data = msg.data;
      state.activeSheet = msg.sheetName;
      renderTabs();
      renderTable();
      updateStatus(`已加载 ${msg.maxRow + 1} 行 × ${msg.maxCol + 1} 列`);
      break;
    case 'saveResult':
      updateStatus(msg.success ? '✓ 已保存' : `✗ 保存失败: ${msg.error}`);
      break;
  }
});

// ---- 渲染 Sheet Tab 栏 ----
function renderTabs() {
  if (!tabsEl) { return; }
  tabsEl.innerHTML = '';
  for (const sheet of state.sheets) {
    const tab = document.createElement('button');
    tab.className = 'sheet-tab' + (sheet.name === state.activeSheet ? ' active' : '');
    tab.textContent = sheet.name;
    tab.dataset.sheetName = sheet.name;
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => {
      if (sheet.name !== state.activeSheet) {
        vscode.postMessage({ type: 'requestSheet', sheetName: sheet.name });
        updateStatus('加载中...');
      }
    });
    tab.addEventListener('dblclick', (e) => { e.stopPropagation(); startTabRename(sheet.name, tab); });
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      showTabContextMenu(e.clientX, e.clientY, sheet.name);
    });
    tabsEl.appendChild(tab);
  }
}

function startTabRename(sheetName, tabEl) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tab-rename-input';
  input.value = sheetName;
  tabEl.textContent = '';
  tabEl.appendChild(input);
  input.focus(); input.select();
  const commit = () => {
    const newName = input.value.trim();
    if (newName && newName !== sheetName) {
      vscode.postMessage({ type: 'renameSheet', oldName: sheetName, newName });
    } else { renderTabs(); }
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); renderTabs(); }
    e.stopPropagation();
  });
}

function showTabContextMenu(x, y, sheetName) {
  const canDelete = state.sheets.length > 1;
  showContextMenu(x, y, [
    { label: '重命名', action: () => {
      const tab = tabsEl?.querySelector(`[data-sheet-name="${CSS.escape(sheetName)}"]`);
      if (tab) { startTabRename(sheetName, /** @type {HTMLElement} */ (tab)); }
      else { showModal('重命名工作表', sheetName, (n) => vscode.postMessage({ type: 'renameSheet', oldName: sheetName, newName: n })); }
    }},
    { label: '复制工作表', action: () => {
      showModal('复制工作表 — 输入新名称', generateCopyName(sheetName), (n) => {
        vscode.postMessage({ type: 'copySheet', sourceSheetName: sheetName, newSheetName: n });
        updateStatus(`正在复制工作表 "${sheetName}"...`);
      });
    }},
    'sep',
    { label: '删除工作表', disabled: !canDelete, action: () => {
      vscode.postMessage({ type: 'deleteSheet', sheetName });
    }},
  ]);
}

// ---- 渲染表格 ----
function renderTable() {
  if (!tableWrapper) { return; }
  const data = state.data;
  if (!data.length) {
    tableWrapper.innerHTML = '<div class="empty-tip">此 Sheet 为空</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  const table = document.createElement('table');
  table.className = 'sheet-table';
  table.setAttribute('role', 'grid');

  // 表头行
  const thead = table.createTHead();
  const headRow = thead.insertRow();
  const cornerTh = document.createElement('th');
  cornerTh.className = 'corner-header';
  headRow.appendChild(cornerTh);

  const colCount = data[0]?.length ?? 0;
  for (let c = 0; c < colCount; c++) {
    const th = document.createElement('th');
    th.className = 'col-header';
    th.textContent = colIndexToLetter(c);
    th.dataset.col = String(c);
    th.addEventListener('click', (e) => onColHeaderClick(e, c));
    th.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // 若点击的列不在当前选中集合内，则单独选中该列
      if (!state.selectedCols.has(c)) { setColSelection([c]); }
      showColContextMenu(e.clientX, e.clientY);
    });
    headRow.appendChild(th);
  }

  // 数据行
  const tbody = table.createTBody();
  for (let r = 0; r < data.length; r++) {
    const tr = tbody.insertRow();
    const rowTh = document.createElement('th');
    rowTh.className = 'row-header';
    rowTh.textContent = String(r + 1);
    rowTh.dataset.row = String(r);
    rowTh.addEventListener('click', (e) => onRowHeaderClick(e, r));
    rowTh.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!state.selectedRows.has(r)) { setRowSelection([r]); }
      showRowContextMenu(e.clientX, e.clientY);
    });
    tr.appendChild(rowTh);

    for (let c = 0; c < data[r].length; c++) {
      const cell = data[r][c];
      const td = tr.insertCell();
      td.dataset.row = String(r);
      td.dataset.col = String(c);
      td.className = 'data-cell' + (cell.isFormula ? ' formula-cell' : '') + (cell.type === 'n' ? ' numeric' : '');
      td.textContent = cell.value !== null ? String(cell.value) : '';
      td.setAttribute('tabindex', '0');
      td.setAttribute('role', 'gridcell');
      td.addEventListener('click',       () => selectCell(r, c, td));
      td.addEventListener('dblclick',    () => startEditing(r, c, td));
      td.addEventListener('keydown',     (e) => handleCellKeydown(e, r, c, td));
      td.addEventListener('contextmenu', (e) => {
        e.preventDefault(); selectCell(r, c, td);
        showCellContextMenu(e.clientX, e.clientY, r, c);
      });
    }
  }

  frag.appendChild(table);
  tableWrapper.innerHTML = '';
  tableWrapper.appendChild(frag);
  applyClipboardVisual();
  focusCell(state.selectedRow, state.selectedCol);
}

// ---- 行列选中逻辑 ----

/** 清除所有选中状态 */
function clearAllSelection() {
  tableWrapper?.querySelectorAll(
    '.selected,.row-selected,.col-selected,.row-header-selected,.col-header-selected'
  ).forEach(el => el.classList.remove('selected','row-selected','col-selected','row-header-selected','col-header-selected'));
  state.selectionMode = 'cell';
  state.selectedRows.clear();
  state.selectedCols.clear();
}

/** 将选中应用到 DOM（行模式） */
function applyRowHighlight() {
  // 清除旧高亮
  tableWrapper?.querySelectorAll('.row-selected,.row-header-selected').forEach(el =>
    el.classList.remove('row-selected','row-header-selected')
  );
  for (const r of state.selectedRows) {
    tableWrapper?.querySelector(`th.row-header[data-row="${r}"]`)?.classList.add('row-header-selected');
    tableWrapper?.querySelectorAll(`td[data-row="${r}"]`).forEach(td => td.classList.add('row-selected'));
  }
  updateAddrBar();
}

/** 将选中应用到 DOM（列模式） */
function applyColHighlight() {
  tableWrapper?.querySelectorAll('.col-selected,.col-header-selected').forEach(el =>
    el.classList.remove('col-selected','col-header-selected')
  );
  for (const c of state.selectedCols) {
    tableWrapper?.querySelector(`th.col-header[data-col="${c}"]`)?.classList.add('col-header-selected');
    tableWrapper?.querySelectorAll(`td[data-col="${c}"]`).forEach(td => td.classList.add('col-selected'));
  }
  updateAddrBar();
}

function updateAddrBar() {
  if (!cellAddrEl) { return; }
  if (state.selectionMode === 'row' && state.selectedRows.size > 0) {
    const rows = sortedArray(state.selectedRows);
    cellAddrEl.textContent = rows.length === 1
      ? `${rows[0]+1}:${rows[0]+1}`
      : `${rows[0]+1}:${rows[rows.length-1]+1} (${rows.length}行)`;
  } else if (state.selectionMode === 'col' && state.selectedCols.size > 0) {
    const cols = sortedArray(state.selectedCols);
    cellAddrEl.textContent = cols.length === 1
      ? `${colIndexToLetter(cols[0])}:${colIndexToLetter(cols[0])}`
      : `${colIndexToLetter(cols[0])}:${colIndexToLetter(cols[cols.length-1])} (${cols.length}列)`;
  }
}

/** 直接设置行选中集合（不考虑 Ctrl/Shift） */
function setRowSelection(rows) {
  clearAllSelection();
  state.selectionMode = 'row';
  for (const r of rows) { state.selectedRows.add(r); }
  if (rows.length > 0) { state.lastClickedRow = rows[rows.length - 1]; }
  applyRowHighlight();
}

/** 直接设置列选中集合 */
function setColSelection(cols) {
  clearAllSelection();
  state.selectionMode = 'col';
  for (const c of cols) { state.selectedCols.add(c); }
  if (cols.length > 0) { state.lastClickedCol = cols[cols.length - 1]; }
  applyColHighlight();
}

/** 行头点击（支持 Ctrl / Shift） */
function onRowHeaderClick(e, r) {
  if (state.selectionMode !== 'row') {
    // 从非行模式切换：清除所有选中
    clearAllSelection();
    state.selectionMode = 'row';
  }

  if ((e.ctrlKey || e.metaKey) && state.selectionMode === 'row') {
    // Ctrl+Click：切换单行
    if (state.selectedRows.has(r)) { state.selectedRows.delete(r); }
    else { state.selectedRows.add(r); }
    if (state.selectedRows.size === 0) { state.selectionMode = 'cell'; }
  } else if (e.shiftKey && state.lastClickedRow >= 0 && state.selectionMode === 'row') {
    // Shift+Click：范围选中（从锚点到 r，不清除已有选中）
    const start = Math.min(state.lastClickedRow, r);
    const end   = Math.max(state.lastClickedRow, r);
    for (let i = start; i <= end; i++) { state.selectedRows.add(i); }
  } else {
    // 普通单击：仅选中该行
    state.selectedRows.clear();
    state.selectedRows.add(r);
  }
  state.lastClickedRow = r;
  state.selectedRow = r;
  if (formulaInput) { /** @type {HTMLInputElement} */ (formulaInput).value = ''; }
  applyRowHighlight();
}

/** 列头点击（支持 Ctrl / Shift） */
function onColHeaderClick(e, c) {
  if (state.selectionMode !== 'col') {
    clearAllSelection();
    state.selectionMode = 'col';
  }

  if ((e.ctrlKey || e.metaKey) && state.selectionMode === 'col') {
    if (state.selectedCols.has(c)) { state.selectedCols.delete(c); }
    else { state.selectedCols.add(c); }
    if (state.selectedCols.size === 0) { state.selectionMode = 'cell'; }
  } else if (e.shiftKey && state.lastClickedCol >= 0 && state.selectionMode === 'col') {
    const start = Math.min(state.lastClickedCol, c);
    const end   = Math.max(state.lastClickedCol, c);
    for (let i = start; i <= end; i++) { state.selectedCols.add(i); }
  } else {
    state.selectedCols.clear();
    state.selectedCols.add(c);
  }
  state.lastClickedCol = c;
  state.selectedCol = c;
  if (formulaInput) { /** @type {HTMLInputElement} */ (formulaInput).value = ''; }
  applyColHighlight();
}

// ---- 单元格选中 ----
function selectCell(row, col, td) {
  clearAllSelection();
  state.selectedRow = row;
  state.selectedCol = col;
  td.classList.add('selected');
  if (cellAddrEl) { cellAddrEl.textContent = `${colIndexToLetter(col)}${row + 1}`; }
  const cell = state.data[row]?.[col];
  if (formulaInput) { /** @type {HTMLInputElement} */ (formulaInput).value = cell?.formulaStr ?? cell?.raw ?? ''; }
}

function focusCell(row, col) {
  const td = tableWrapper?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
  if (td) { selectCell(row, col, /** @type {HTMLTableCellElement} */ (td)); }
}

// ---- 剪贴板视觉标识 ----
function applyClipboardVisual() {
  tableWrapper?.querySelectorAll('.clipboard-row,.clipboard-col').forEach(el =>
    el.classList.remove('clipboard-row','clipboard-col')
  );
  if (!state.clipboard || state.clipboard.sheetName !== state.activeSheet) { return; }
  if (state.clipboard.type === 'rows') {
    for (const r of (state.clipboard.rowIndices ?? [])) {
      tableWrapper?.querySelectorAll(`td[data-row="${r}"]`).forEach(td => td.classList.add('clipboard-row'));
    }
  } else if (state.clipboard.type === 'cols') {
    for (const c of (state.clipboard.colIndices ?? [])) {
      tableWrapper?.querySelectorAll(`td[data-col="${c}"]`).forEach(td => td.classList.add('clipboard-col'));
    }
  }
}

// ---- 单元格编辑 ----
function startEditing(row, col, td) {
  if (state.editingCell) { commitEdit(); }
  const cell = state.data[row]?.[col];
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-input';
  input.value = cell?.formulaStr ?? cell?.raw ?? '';
  td.textContent = '';
  td.appendChild(input);
  input.focus(); input.select();
  state.editingCell = { row, col, td, input };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); moveTo(row + 1, col); }
    if (e.key === 'Tab')    { e.preventDefault(); commitEdit(); moveTo(row, col + (e.shiftKey ? -1 : 1)); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    e.stopPropagation();
  });
  input.addEventListener('blur', () => { if (state.editingCell?.td === td) { commitEdit(); } });
}

function commitEdit() {
  if (!state.editingCell) { return; }
  const { row, col, td, input } = state.editingCell;
  state.editingCell = null;
  const newVal = input.value;
  if (state.data[row]?.[col] !== undefined) {
    state.data[row][col].value = newVal;
    state.data[row][col].raw = newVal;
    state.data[row][col].isFormula = newVal.startsWith('=');
  }
  td.textContent = newVal;
  td.className = 'data-cell' + (newVal.startsWith('=') ? ' formula-cell' : '');
  if (!isNaN(Number(newVal)) && newVal !== '') { td.classList.add('numeric'); }
  selectCell(row, col, td);
  vscode.postMessage({ type: 'cellEdit', sheetName: state.activeSheet, row, col, value: newVal });
}

function cancelEdit() {
  if (!state.editingCell) { return; }
  const { row, col, td } = state.editingCell;
  state.editingCell = null;
  const cell = state.data[row]?.[col];
  td.textContent = cell?.value !== null ? String(cell.value) : '';
  selectCell(row, col, td);
}

// ---- 键盘导航 ----
function handleCellKeydown(e, row, col, td) {
  if (state.editingCell) { return; }
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); moveTo(row - 1, col); break;
    case 'ArrowDown':  e.preventDefault(); moveTo(row + 1, col); break;
    case 'ArrowLeft':  e.preventDefault(); moveTo(row, col - 1); break;
    case 'ArrowRight': e.preventDefault(); moveTo(row, col + 1); break;
    case 'Enter': case 'F2': e.preventDefault(); startEditing(row, col, td); break;
    case 'Delete': case 'Backspace': clearCell(row, col, td); break;
    default:
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { startEditing(row, col, td); }
  }
}

function moveTo(row, col) {
  const maxRow = state.data.length - 1;
  const maxCol = (state.data[0]?.length ?? 1) - 1;
  row = Math.max(0, Math.min(row, maxRow));
  col = Math.max(0, Math.min(col, maxCol));
  const td = tableWrapper?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
  if (td) {
    /** @type {HTMLElement} */ (td).focus();
    selectCell(row, col, /** @type {HTMLTableCellElement} */ (td));
    td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function clearCell(row, col, td) {
  if (state.data[row]?.[col] !== undefined) {
    state.data[row][col].value = '';
    state.data[row][col].raw = '';
  }
  td.textContent = '';
  vscode.postMessage({ type: 'cellEdit', sheetName: state.activeSheet, row, col, value: '' });
}

// ---- 全局键盘：Ctrl+C / Ctrl+V / Ctrl+S ----
document.addEventListener('keydown', (e) => {
  if (state.editingCell) { return; }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCopy(); }
    else if (e.key === 'v' || e.key === 'V') { e.preventDefault(); handlePaste(); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); vscode.postMessage({ type: 'requestSave' }); }
  }
});

function handleCopy() {
  if (state.selectionMode === 'row' && state.selectedRows.size > 0) {
    const rowIndices = sortedArray(state.selectedRows);
    state.clipboard = { type: 'rows', rowIndices, sheetName: state.activeSheet };
    applyClipboardVisual();
    updateStatus(`已复制 ${rowIndices.length} 行（选中目标行后 Ctrl+V 插入）`);
  } else if (state.selectionMode === 'col' && state.selectedCols.size > 0) {
    const colIndices = sortedArray(state.selectedCols);
    state.clipboard = { type: 'cols', colIndices, sheetName: state.activeSheet };
    applyClipboardVisual();
    updateStatus(`已复制 ${colIndices.length} 列（选中目标列后 Ctrl+V 插入）`);
  } else {
    const cell = state.data[state.selectedRow]?.[state.selectedCol];
    state.clipboard = { type: 'cell', value: cell?.raw ?? '', sheetName: state.activeSheet };
    updateStatus(`已复制 ${colIndexToLetter(state.selectedCol)}${state.selectedRow + 1}`);
  }
}

function handlePaste() {
  if (!state.clipboard) { return; }

  if (state.clipboard.type === 'rows') {
    const sourceRows = state.clipboard.rowIndices ?? [];
    const targetRow = state.selectionMode === 'row'
      ? sortedArray(state.selectedRows)[0]
      : state.selectedRow;
    vscode.postMessage({ type: 'pasteRows', sheetName: state.activeSheet, sourceRows, targetRow });
    updateStatus(`正在将 ${sourceRows.length} 行插入到第 ${targetRow + 1} 行之前...`);

  } else if (state.clipboard.type === 'cols') {
    const sourceCols = state.clipboard.colIndices ?? [];
    const targetCol = state.selectionMode === 'col'
      ? sortedArray(state.selectedCols)[0]
      : state.selectedCol;
    vscode.postMessage({ type: 'pasteCols', sheetName: state.activeSheet, sourceCols, targetCol });
    updateStatus(`正在将 ${sourceCols.length} 列插入到 ${colIndexToLetter(targetCol)} 列之前...`);

  } else if (state.clipboard.type === 'cell') {
    const value = state.clipboard.value ?? '';
    const row = state.selectedRow, col = state.selectedCol;
    const td = tableWrapper?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
    if (td) {
      if (state.data[row]?.[col] !== undefined) {
        state.data[row][col].value = value;
        state.data[row][col].raw = value;
        state.data[row][col].isFormula = value.startsWith('=');
      }
      /** @type {HTMLElement} */ (td).textContent = value;
      vscode.postMessage({ type: 'cellEdit', sheetName: state.activeSheet, row, col, value });
      updateStatus(`已粘贴到 ${colIndexToLetter(col)}${row + 1}`);
    }
  }
}

// ---- 右键菜单：行头 ----
function showRowContextMenu(x, y) {
  const rows = sortedArray(state.selectedRows);
  const count = rows.length;
  const hasRowClipboard = state.clipboard?.type === 'rows';
  const label = count > 1 ? `${count} 行` : `第 ${rows[0] + 1} 行`;

  showContextMenu(x, y, [
    { label: `复制${label}`, shortcut: 'Ctrl+C', action: () => handleCopy() },
    { label: `粘贴到此行上方`, shortcut: 'Ctrl+V', disabled: !hasRowClipboard, action: () => {
      if (!state.clipboard || state.clipboard.type !== 'rows') { return; }
      const targetRow = rows[0];
      vscode.postMessage({ type: 'pasteRows', sheetName: state.activeSheet, sourceRows: state.clipboard.rowIndices, targetRow });
      updateStatus(`正在粘贴 ${state.clipboard.rowIndices.length} 行...`);
    }},
    'sep',
    { label: `在上方插入 ${count} 行`, action: () => {
      vscode.postMessage({ type: 'insertRow', sheetName: state.activeSheet, atIndex: rows[0], count });
    }},
    { label: `在下方插入 ${count} 行`, action: () => {
      vscode.postMessage({ type: 'insertRow', sheetName: state.activeSheet, atIndex: rows[rows.length - 1] + 1, count });
    }},
    'sep',
    { label: `删除${label}`, action: () => {
      vscode.postMessage({ type: 'deleteRows', sheetName: state.activeSheet, rowIndices: rows });
    }},
  ]);
}

// ---- 右键菜单：列头 ----
function showColContextMenu(x, y) {
  const cols = sortedArray(state.selectedCols);
  const count = cols.length;
  const hasColClipboard = state.clipboard?.type === 'cols';
  const label = count > 1 ? `${count} 列` : `${colIndexToLetter(cols[0])} 列`;

  showContextMenu(x, y, [
    { label: `复制${label}`, shortcut: 'Ctrl+C', action: () => handleCopy() },
    { label: `粘贴到此列左侧`, shortcut: 'Ctrl+V', disabled: !hasColClipboard, action: () => {
      if (!state.clipboard || state.clipboard.type !== 'cols') { return; }
      const targetCol = cols[0];
      vscode.postMessage({ type: 'pasteCols', sheetName: state.activeSheet, sourceCols: state.clipboard.colIndices, targetCol });
      updateStatus(`正在粘贴 ${state.clipboard.colIndices.length} 列...`);
    }},
    'sep',
    { label: `在左侧插入 ${count} 列`, action: () => {
      vscode.postMessage({ type: 'insertCol', sheetName: state.activeSheet, atIndex: cols[0], count });
    }},
    { label: `在右侧插入 ${count} 列`, action: () => {
      vscode.postMessage({ type: 'insertCol', sheetName: state.activeSheet, atIndex: cols[cols.length - 1] + 1, count });
    }},
    'sep',
    { label: `删除${label}`, action: () => {
      vscode.postMessage({ type: 'deleteCols', sheetName: state.activeSheet, colIndices: cols });
    }},
  ]);
}

// ---- 右键菜单：数据单元格 ----
function showCellContextMenu(x, y, row, col) {
  const hasCellClipboard = state.clipboard?.type === 'cell';
  showContextMenu(x, y, [
    { label: '复制单元格', shortcut: 'Ctrl+C', action: () => handleCopy() },
    { label: '粘贴', shortcut: 'Ctrl+V', disabled: !hasCellClipboard, action: () => handlePaste() },
    { label: '清空单元格', action: () => {
      const td = tableWrapper?.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
      if (td) { clearCell(row, col, /** @type {HTMLTableCellElement} */ (td)); }
    }},
    'sep',
    { label: '在上方插入行', action: () => vscode.postMessage({ type: 'insertRow', sheetName: state.activeSheet, atIndex: row, count: 1 }) },
    { label: '在下方插入行', action: () => vscode.postMessage({ type: 'insertRow', sheetName: state.activeSheet, atIndex: row + 1, count: 1 }) },
    { label: '删除当前行',   action: () => vscode.postMessage({ type: 'deleteRows', sheetName: state.activeSheet, rowIndices: [row] }) },
    'sep',
    { label: '在左侧插入列', action: () => vscode.postMessage({ type: 'insertCol', sheetName: state.activeSheet, atIndex: col, count: 1 }) },
    { label: '在右侧插入列', action: () => vscode.postMessage({ type: 'insertCol', sheetName: state.activeSheet, atIndex: col + 1, count: 1 }) },
    { label: '删除当前列',   action: () => vscode.postMessage({ type: 'deleteCols', sheetName: state.activeSheet, colIndices: [col] }) },
  ]);
}

// ---- 公式栏 ----
if (formulaInput) {
  formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = /** @type {HTMLInputElement} */ (formulaInput).value;
      const td = tableWrapper?.querySelector(`td[data-row="${state.selectedRow}"][data-col="${state.selectedCol}"]`);
      if (td) {
        if (state.data[state.selectedRow]?.[state.selectedCol] !== undefined) {
          state.data[state.selectedRow][state.selectedCol].value = val;
          state.data[state.selectedRow][state.selectedCol].raw = val;
        }
        /** @type {HTMLElement} */ (td).textContent = val;
      }
      vscode.postMessage({ type: 'cellEdit', sheetName: state.activeSheet, row: state.selectedRow, col: state.selectedCol, value: val });
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const cell = state.data[state.selectedRow]?.[state.selectedCol];
      /** @type {HTMLInputElement} */ (formulaInput).value = cell?.formulaStr ?? cell?.raw ?? '';
      focusCell(state.selectedRow, state.selectedCol);
    }
  });
}

// ---- 工具栏事件 ----
if (addSheetBtn) {
  addSheetBtn.addEventListener('click', () => vscode.postMessage({ type: 'addSheet' }));
}

if (copySheetBtn) {
  copySheetBtn.addEventListener('click', () => {
    showModal('复制工作表 — 输入新名称', generateCopyName(state.activeSheet), (newName) => {
      vscode.postMessage({ type: 'copySheet', sourceSheetName: state.activeSheet, newSheetName: newName });
      updateStatus(`正在复制工作表 "${state.activeSheet}"...`);
    });
  });
}

if (addRowsBtn && addRowsInput) {
  addRowsBtn.addEventListener('click', () => {
    const count = Math.max(1, parseInt(/** @type {HTMLInputElement} */(addRowsInput).value) || 1);
    vscode.postMessage({ type: 'addRows', sheetName: state.activeSheet, count });
    updateStatus(`正在插入 ${count} 行...`);
  });
}

if (addColsBtn && addColsInput) {
  addColsBtn.addEventListener('click', () => {
    const count = Math.max(1, parseInt(/** @type {HTMLInputElement} */(addColsInput).value) || 1);
    vscode.postMessage({ type: 'addCols', sheetName: state.activeSheet, count });
    updateStatus(`正在插入 ${count} 列...`);
  });
}

// 旧版工具栏「复制行/复制列」按钮（保留兼容，基于当前选中行/列）
const copyRowBtn   = document.getElementById('btn-copy-row');
const copyRowInput = document.getElementById('input-copy-row-count');
const copyColBtn   = document.getElementById('btn-copy-col');
const copyColInput = document.getElementById('input-copy-col-count');

if (copyRowBtn && copyRowInput) {
  copyRowBtn.addEventListener('click', () => {
    const count = Math.max(1, parseInt(/** @type {HTMLInputElement} */(copyRowInput).value) || 1);
    const sourceRow = state.selectionMode === 'row' && state.selectedRows.size > 0
      ? sortedArray(state.selectedRows)[0] : state.selectedRow;
    vscode.postMessage({ type: 'copyRow', sheetName: state.activeSheet, sourceRow, count });
    updateStatus(`正在复制第 ${sourceRow + 1} 行 ${count} 次到末尾...`);
  });
}

if (copyColBtn && copyColInput) {
  copyColBtn.addEventListener('click', () => {
    const count = Math.max(1, parseInt(/** @type {HTMLInputElement} */(copyColInput).value) || 1);
    const sourceCol = state.selectionMode === 'col' && state.selectedCols.size > 0
      ? sortedArray(state.selectedCols)[0] : state.selectedCol;
    vscode.postMessage({ type: 'copyCol', sheetName: state.activeSheet, sourceCol, count });
    updateStatus(`正在复制列 ${colIndexToLetter(sourceCol)} ${count} 次到末尾...`);
  });
}

// ---- 初始化 ----
vscode.postMessage({ type: 'ready' });
