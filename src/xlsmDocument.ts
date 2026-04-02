import * as vscode from 'vscode';
import * as xlsx from 'xlsx';
import { CellData, SheetMeta } from './types';

export class XlsmDocument implements vscode.CustomDocument {
  private workbook: xlsx.WorkBook;
  // 编辑缓存：sheetName → "row:col" → newValue
  private editCache = new Map<string, Map<string, string>>();
  // undo 栈条目
  private undoStack: Array<{ sheetName: string; row: number; col: number; prev: string }> = [];

  constructor(
    public readonly uri: vscode.Uri,
    private fileData: Uint8Array
  ) {
    this.workbook = this.parseWorkbook(fileData);
  }

  private parseWorkbook(data: Uint8Array): xlsx.WorkBook {
    return xlsx.read(data, {
      type: 'buffer',
      bookVBA: true,     // 保留 VBA 宏，不执行
      cellFormula: true,
      cellDates: false,
    });
  }

  // ---- 查询 ----

  getSheetMetas(): SheetMeta[] {
    return this.workbook.SheetNames.map((name, index) => ({ name, index }));
  }

  getSheetData(sheetName: string): { data: CellData[][]; maxRow: number; maxCol: number } {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
      return { data: [], maxRow: 0, maxCol: 0 };
    }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const maxCol = range.e.c;
    const cache = this.editCache.get(sheetName);
    const data: CellData[][] = [];

    for (let r = 0; r <= maxRow; r++) {
      const row: CellData[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cachedVal = cache?.get(`${r}:${c}`);
        if (cachedVal !== undefined) {
          row.push({ value: cachedVal, raw: cachedVal, type: 's', isFormula: false });
          continue;
        }
        const addr = xlsx.utils.encode_cell({ r, c });
        const cell: xlsx.CellObject | undefined = sheet[addr];
        if (!cell) {
          row.push({ value: null, raw: '', type: 'z', isFormula: false });
        } else {
          const isFormula = !!cell.f;
          row.push({
            value: cell.w ?? cell.v ?? null,
            raw: isFormula ? `=${cell.f}` : String(cell.v ?? ''),
            type: cell.t as CellData['type'],
            isFormula,
            formulaStr: cell.f ? `=${cell.f}` : undefined,
          });
        }
      }
      data.push(row);
    }
    return { data, maxRow, maxCol };
  }

  // ---- 修改 ----

  applyEdit(sheetName: string, row: number, col: number, value: string): void {
    if (!this.editCache.has(sheetName)) {
      this.editCache.set(sheetName, new Map());
    }
    // 记录 undo 之前的值
    const prev = this.editCache.get(sheetName)!.get(`${row}:${col}`) ?? this.getCellRaw(sheetName, row, col);
    this.undoStack.push({ sheetName, row, col, prev });
    this.editCache.get(sheetName)!.set(`${row}:${col}`, value);
  }

  undoEdit(sheetName: string, row: number, col: number): void {
    const entry = this.undoStack.pop();
    if (!entry) { return; }
    const cache = this.editCache.get(entry.sheetName);
    if (!cache) { return; }
    if (entry.prev === '') {
      cache.delete(`${entry.row}:${entry.col}`);
    } else {
      cache.set(`${entry.row}:${entry.col}`, entry.prev);
    }
  }

  private getCellRaw(sheetName: string, row: number, col: number): string {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) { return ''; }
    const addr = xlsx.utils.encode_cell({ r: row, c: col });
    const cell: xlsx.CellObject | undefined = sheet[addr];
    if (!cell) { return ''; }
    return cell.f ? `=${cell.f}` : String(cell.v ?? '');
  }

  // ---- 结构操作 ----

  /** 新增工作表，返回实际使用的名称 */
  addSheet(name?: string): string {
    const existing = new Set(this.workbook.SheetNames);
    let sheetName = name?.trim() || '';
    if (!sheetName || existing.has(sheetName)) {
      let i = this.workbook.SheetNames.length + 1;
      while (existing.has(`Sheet${i}`)) { i++; }
      sheetName = `Sheet${i}`;
    }
    const newSheet = xlsx.utils.aoa_to_sheet([[]]);
    newSheet['!ref'] = 'A1:A1';
    xlsx.utils.book_append_sheet(this.workbook, newSheet, sheetName);
    return sheetName;
  }

  /** 在当前 sheet 末尾追加 N 行 */
  addRows(sheetName: string, count: number): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) { return; }
    if (!sheet['!ref']) {
      sheet['!ref'] = `A1:A${count}`;
      return;
    }
    const range = xlsx.utils.decode_range(sheet['!ref']);
    range.e.r += count;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 在当前 sheet 末尾追加 N 列 */
  addCols(sheetName: string, count: number): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) { return; }
    if (!sheet['!ref']) {
      sheet['!ref'] = `A1:${xlsx.utils.encode_col(count - 1)}1`;
      return;
    }
    const range = xlsx.utils.decode_range(sheet['!ref']);
    range.e.c += count;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 复制指定行到末尾 N 次 */
  copyRow(sheetName: string, sourceRow: number, count: number): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxCol = range.e.c;
    const newStartRow = range.e.r + 1;

    // 复制源行的所有单元格
    for (let i = 0; i < count; i++) {
      const targetRow = newStartRow + i;
      for (let c = 0; c <= maxCol; c++) {
        const sourceAddr = xlsx.utils.encode_cell({ r: sourceRow, c });
        const targetAddr = xlsx.utils.encode_cell({ r: targetRow, c });
        const sourceCell = sheet[sourceAddr];

        if (sourceCell) {
          // 深拷贝单元格对象
          sheet[targetAddr] = { ...sourceCell };
        }
      }
    }

    // 更新范围
    range.e.r += count;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 复制指定列到末尾 N 次 */
  copyCol(sheetName: string, sourceCol: number, count: number): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const newStartCol = range.e.c + 1;

    // 复制源列的所有单元格
    for (let i = 0; i < count; i++) {
      const targetCol = newStartCol + i;
      for (let r = 0; r <= maxRow; r++) {
        const sourceAddr = xlsx.utils.encode_cell({ r, c: sourceCol });
        const targetAddr = xlsx.utils.encode_cell({ r, c: targetCol });
        const sourceCell = sheet[sourceAddr];

        if (sourceCell) {
          // 深拷贝单元格对象
          sheet[targetAddr] = { ...sourceCell };
        }
      }
    }

    // 更新范围
    range.e.c += count;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 复制整个 Sheet */
  copySheet(sourceSheetName: string, newSheetName?: string): string {
    const sourceSheet = this.workbook.Sheets[sourceSheetName];
    if (!sourceSheet) {
      throw new Error(`源工作表 "${sourceSheetName}" 不存在`);
    }

    // 生成新的 sheet 名称
    const existing = new Set(this.workbook.SheetNames);
    let finalName = newSheetName?.trim() || '';

    if (!finalName || existing.has(finalName)) {
      const baseName = sourceSheetName;
      let i = 2;
      finalName = `${baseName} (${i})`;
      while (existing.has(finalName)) {
        i++;
        finalName = `${baseName} (${i})`;
      }
    }

    // 深拷贝整个 sheet 对象
    const newSheet: xlsx.WorkSheet = {};

    // 复制所有单元格
    for (const key in sourceSheet) {
      if (key.startsWith('!')) {
        // 复制元数据 (!ref, !cols, !rows 等)
        newSheet[key] = sourceSheet[key];
      } else {
        // 深拷贝单元格对象
        const cell = sourceSheet[key] as xlsx.CellObject;
        newSheet[key] = { ...cell };
      }
    }

    // 添加到工作簿
    xlsx.utils.book_append_sheet(this.workbook, newSheet, finalName);

    return finalName;
  }

  /** 删除指定行 */
  deleteRow(sheetName: string, rowIndex: number, count: number = 1): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const maxCol = range.e.c;

    // 删除行：将后面的行前移
    for (let r = rowIndex; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        const currentAddr = xlsx.utils.encode_cell({ r, c });

        if (r + count <= maxRow) {
          // 用后面的行覆盖当前行
          const nextAddr = xlsx.utils.encode_cell({ r: r + count, c });
          const nextCell = sheet[nextAddr];
          if (nextCell) {
            sheet[currentAddr] = { ...nextCell };
          } else {
            delete sheet[currentAddr];
          }
        } else {
          // 最后几行直接删除
          delete sheet[currentAddr];
        }
      }
    }

    // 更新范围
    range.e.r = Math.max(0, maxRow - count);
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 删除指定列 */
  deleteCol(sheetName: string, colIndex: number, count: number = 1): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const maxCol = range.e.c;

    // 删除列：将后面的列左移
    for (let c = colIndex; c <= maxCol; c++) {
      for (let r = 0; r <= maxRow; r++) {
        const currentAddr = xlsx.utils.encode_cell({ r, c });

        if (c + count <= maxCol) {
          // 用后面的列覆盖当前列
          const nextAddr = xlsx.utils.encode_cell({ r, c: c + count });
          const nextCell = sheet[nextAddr];
          if (nextCell) {
            sheet[currentAddr] = { ...nextCell };
          } else {
            delete sheet[currentAddr];
          }
        } else {
          // 最后几列直接删除
          delete sheet[currentAddr];
        }
      }
    }

    // 更新范围
    range.e.c = Math.max(0, maxCol - count);
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 删除工作表，返回新的活动 sheet 名称 */
  deleteSheet(sheetName: string): string {
    const index = this.workbook.SheetNames.indexOf(sheetName);
    if (index === -1) {
      throw new Error(`工作表 "${sheetName}" 不存在`);
    }

    if (this.workbook.SheetNames.length <= 1) {
      throw new Error('不能删除最后一个工作表');
    }

    // 删除 sheet
    this.workbook.SheetNames.splice(index, 1);
    delete this.workbook.Sheets[sheetName];

    // 返回新的活动 sheet（删除后的下一个，或上一个）
    const newActiveIndex = Math.min(index, this.workbook.SheetNames.length - 1);
    return this.workbook.SheetNames[newActiveIndex];
  }

  /** 重命名工作表 */
  renameSheet(oldName: string, newName: string): void {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      throw new Error('工作表名称不能为空');
    }

    if (trimmedName === oldName) {
      return; // 名称未变
    }

    if (this.workbook.SheetNames.includes(trimmedName)) {
      throw new Error(`工作表名称 "${trimmedName}" 已存在`);
    }

    const index = this.workbook.SheetNames.indexOf(oldName);
    if (index === -1) {
      throw new Error(`工作表 "${oldName}" 不存在`);
    }

    // 重命名
    this.workbook.SheetNames[index] = trimmedName;
    this.workbook.Sheets[trimmedName] = this.workbook.Sheets[oldName];
    delete this.workbook.Sheets[oldName];
  }

  /** 在指定位置插入行 */
  insertRow(sheetName: string, atIndex: number, count: number = 1): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const maxCol = range.e.c;

    // 从后往前移动行
    for (let r = maxRow; r >= atIndex; r--) {
      for (let c = 0; c <= maxCol; c++) {
        const currentAddr = xlsx.utils.encode_cell({ r, c });
        const targetAddr = xlsx.utils.encode_cell({ r: r + count, c });
        const cell = sheet[currentAddr];

        if (cell) {
          sheet[targetAddr] = { ...cell };
          delete sheet[currentAddr];
        }
      }
    }

    // 更新范围
    range.e.r += count;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  /** 将多行粘贴到指定位置（在 targetRow 前按顺序插入，保留行间相对顺序） */
  pasteRows(sheetName: string, sourceRows: number[], targetRow: number): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxCol = range.e.c;
    const sorted = [...sourceRows].sort((a, b) => a - b);

    // 先全部保存源行数据（在 insertRow 之前）
    const savedRows: (xlsx.CellObject | undefined)[][] = sorted.map(r => {
      const row: (xlsx.CellObject | undefined)[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const addr = xlsx.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        row.push(cell ? { ...cell } : undefined);
      }
      return row;
    });

    // 一次性在 targetRow 处插入 N 行
    this.insertRow(sheetName, targetRow, sorted.length);

    // 填入数据
    for (let i = 0; i < savedRows.length; i++) {
      for (let c = 0; c <= maxCol; c++) {
        const targetAddr = xlsx.utils.encode_cell({ r: targetRow + i, c });
        if (savedRows[i][c]) {
          sheet[targetAddr] = { ...savedRows[i][c]! };
        }
      }
    }
  }

  /** 将多列粘贴到指定位置（在 targetCol 前按顺序插入） */
  pasteCols(sheetName: string, sourceCols: number[], targetCol: number): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const sorted = [...sourceCols].sort((a, b) => a - b);

    // 先全部保存源列数据
    const savedCols: (xlsx.CellObject | undefined)[][] = sorted.map(c => {
      const col: (xlsx.CellObject | undefined)[] = [];
      for (let r = 0; r <= maxRow; r++) {
        const addr = xlsx.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        col.push(cell ? { ...cell } : undefined);
      }
      return col;
    });

    // 一次性在 targetCol 处插入 N 列
    this.insertCol(sheetName, targetCol, sorted.length);

    // 填入数据
    for (let i = 0; i < savedCols.length; i++) {
      for (let r = 0; r <= maxRow; r++) {
        const targetAddr = xlsx.utils.encode_cell({ r, c: targetCol + i });
        if (savedCols[i][r]) {
          sheet[targetAddr] = { ...savedCols[i][r]! };
        }
      }
    }
  }

  /** 删除多行（从大到小依次删除，避免索引偏移） */
  deleteRows(sheetName: string, rowIndices: number[]): void {
    const sorted = [...rowIndices].sort((a, b) => b - a);
    for (const r of sorted) {
      this.deleteRow(sheetName, r, 1);
    }
  }

  /** 移动行：将 fromRow 移动到 toRow 位置之前 */
  moveRow(sheetName: string, fromRow: number, toRow: number): void {
    if (fromRow === toRow) { return; }
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxCol = range.e.c;

    // 保存源行数据
    const savedRow: (xlsx.CellObject | undefined)[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const addr = xlsx.utils.encode_cell({ r: fromRow, c });
      const cell = sheet[addr];
      savedRow.push(cell ? { ...cell } : undefined);
    }

    // 删除源行
    this.deleteRow(sheetName, fromRow, 1);

    // 删除后目标索引需要调整
    let insertAt = toRow;
    if (toRow > fromRow) { insertAt--; }

    // 插入空行
    this.insertRow(sheetName, insertAt, 1);

    // 填回数据
    const newRange = xlsx.utils.decode_range(sheet['!ref']);
    for (let c = 0; c <= newRange.e.c; c++) {
      const addr = xlsx.utils.encode_cell({ r: insertAt, c });
      if (savedRow[c]) {
        sheet[addr] = { ...savedRow[c]! };
      } else {
        delete sheet[addr];
      }
    }
  }

  /** 移动列：将 fromCol 移动到 toCol 位置之前 */
  moveCol(sheetName: string, fromCol: number, toCol: number): void {
    if (fromCol === toCol) { return; }
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;

    // 保存源列数据
    const savedCol: (xlsx.CellObject | undefined)[] = [];
    for (let r = 0; r <= maxRow; r++) {
      const addr = xlsx.utils.encode_cell({ r, c: fromCol });
      const cell = sheet[addr];
      savedCol.push(cell ? { ...cell } : undefined);
    }

    // 删除源列
    this.deleteCol(sheetName, fromCol, 1);

    // 删除后目标索引需要调整
    let insertAt = toCol;
    if (toCol > fromCol) { insertAt--; }

    // 插入空列
    this.insertCol(sheetName, insertAt, 1);

    // 填回数据
    const newRange = xlsx.utils.decode_range(sheet['!ref']);
    for (let r = 0; r <= newRange.e.r; r++) {
      const addr = xlsx.utils.encode_cell({ r, c: insertAt });
      if (savedCol[r]) {
        sheet[addr] = { ...savedCol[r]! };
      } else {
        delete sheet[addr];
      }
    }
  }

  /** 删除多列（从大到小依次删除） */
  deleteCols(sheetName: string, colIndices: number[]): void {
    const sorted = [...colIndices].sort((a, b) => b - a);
    for (const c of sorted) {
      this.deleteCol(sheetName, c, 1);
    }
  }

  /** 在指定位置插入列 */
  insertCol(sheetName: string, atIndex: number, count: number = 1): void {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) { return; }

    const range = xlsx.utils.decode_range(sheet['!ref']);
    const maxRow = range.e.r;
    const maxCol = range.e.c;

    // 从后往前移动列
    for (let c = maxCol; c >= atIndex; c--) {
      for (let r = 0; r <= maxRow; r++) {
        const currentAddr = xlsx.utils.encode_cell({ r, c });
        const targetAddr = xlsx.utils.encode_cell({ r, c: c + count });
        const cell = sheet[currentAddr];

        if (cell) {
          sheet[targetAddr] = { ...cell };
          delete sheet[currentAddr];
        }
      }
    }

    // 更新范围
    range.e.c += count;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  // ---- 序列化（写回文件） ----

  serialize(): Uint8Array {
    for (const [sheetName, cellMap] of this.editCache) {
      const sheet = this.workbook.Sheets[sheetName];
      if (!sheet) { continue; }
      for (const [key, newVal] of cellMap) {
        const [r, c] = key.split(':').map(Number);
        const addr = xlsx.utils.encode_cell({ r, c });
        const numVal = Number(newVal);
        if (newVal !== '' && !isNaN(numVal)) {
          sheet[addr] = { t: 'n', v: numVal, w: newVal };
        } else {
          sheet[addr] = { t: 's', v: newVal, w: newVal };
        }
      }
    }
    const buffer = xlsx.write(this.workbook, {
      type: 'buffer',
      bookType: 'xlsm',
      bookVBA: true,
    });
    return new Uint8Array(buffer);
  }

  // ---- 重载（revert） ----

  reload(data: Uint8Array): void {
    this.fileData = data;
    this.workbook = this.parseWorkbook(data);
    this.editCache.clear();
    this.undoStack = [];
  }

  dispose(): void {
    // 无外部资源需要释放
  }
}
