// ===== Extension → Webview 消息 =====

export interface LoadSheetsMessage {
  type: 'loadSheets';
  sheets: SheetMeta[];
  activeSheet: string;
}

export interface LoadSheetDataMessage {
  type: 'loadSheetData';
  sheetName: string;
  data: CellData[][];
  maxRow: number;
  maxCol: number;
}

export interface SaveResultMessage {
  type: 'saveResult';
  success: boolean;
  error?: string;
}

// ===== Webview → Extension 消息 =====

export interface ReadyMessage {
  type: 'ready';
}

export interface RequestSheetMessage {
  type: 'requestSheet';
  sheetName: string;
}

export interface CellEditMessage {
  type: 'cellEdit';
  sheetName: string;
  row: number;
  col: number;
  value: string;
}

export interface RequestSaveMessage {
  type: 'requestSave';
}

export interface AddSheetMessage {
  type: 'addSheet';
  name?: string;   // 不传则自动生成 Sheet2、Sheet3...
}

export interface AddRowsMessage {
  type: 'addRows';
  sheetName: string;
  count: number;
}

export interface AddColsMessage {
  type: 'addCols';
  sheetName: string;
  count: number;
}

export interface CopyRowMessage {
  type: 'copyRow';
  sheetName: string;
  sourceRow: number;
  count: number;
}

export interface CopyColMessage {
  type: 'copyCol';
  sheetName: string;
  sourceCol: number;
  count: number;
}

export interface CopySheetMessage {
  type: 'copySheet';
  sourceSheetName: string;
  newSheetName?: string;
}

export interface DeleteRowMessage {
  type: 'deleteRow';
  sheetName: string;
  rowIndex: number;
  count: number;
}

export interface DeleteColMessage {
  type: 'deleteCol';
  sheetName: string;
  colIndex: number;
  count: number;
}

export interface DeleteSheetMessage {
  type: 'deleteSheet';
  sheetName: string;
}

export interface RenameSheetMessage {
  type: 'renameSheet';
  oldName: string;
  newName: string;
}

export interface InsertRowMessage {
  type: 'insertRow';
  sheetName: string;
  atIndex: number;
  count: number;
}

export interface InsertColMessage {
  type: 'insertCol';
  sheetName: string;
  atIndex: number;
  count: number;
}

export interface PasteRowsMessage {
  type: 'pasteRows';
  sheetName: string;
  sourceRows: number[];  // 有序源行索引数组
  targetRow: number;     // 在此行前插入
}

export interface PasteColsMessage {
  type: 'pasteCols';
  sheetName: string;
  sourceCols: number[];  // 有序源列索引数组
  targetCol: number;     // 在此列前插入
}

export interface DeleteRowsMessage {
  type: 'deleteRows';
  sheetName: string;
  rowIndices: number[];
}

export interface DeleteColsMessage {
  type: 'deleteCols';
  sheetName: string;
  colIndices: number[];
}

export interface MoveRowMessage {
  type: 'moveRow';
  sheetName: string;
  fromRow: number;  // 0-based 源行索引
  toRow: number;    // 0-based 目标位置（插入到此行之前）
}

export interface MoveColMessage {
  type: 'moveCol';
  sheetName: string;
  fromCol: number;
  toCol: number;
}

// ===== 数据结构 =====

export interface SheetMeta {
  name: string;
  index: number;
}

export interface CellData {
  value: string | number | boolean | null;
  raw: string;
  type: 'n' | 's' | 'b' | 'z' | 'e';
  isFormula: boolean;
  formulaStr?: string;
}

export type ExtensionToWebviewMessage =
  | LoadSheetsMessage
  | LoadSheetDataMessage
  | SaveResultMessage;

export type WebviewToExtensionMessage =
  | ReadyMessage
  | RequestSheetMessage
  | CellEditMessage
  | RequestSaveMessage
  | AddSheetMessage
  | AddRowsMessage
  | AddColsMessage
  | CopyRowMessage
  | CopyColMessage
  | CopySheetMessage
  | DeleteRowMessage
  | DeleteColMessage
  | DeleteSheetMessage
  | RenameSheetMessage
  | InsertRowMessage
  | InsertColMessage
  | PasteRowsMessage
  | PasteColsMessage
  | DeleteRowsMessage
  | DeleteColsMessage
  | MoveRowMessage
  | MoveColMessage;
