import * as vscode from 'vscode';
import { XlsmDocument } from './xlsmDocument';
import { WebviewManager } from './webviewManager';
import { WebviewToExtensionMessage } from './types';

export class XlsmEditorProvider implements vscode.CustomEditorProvider<XlsmDocument> {

  public static readonly viewType = 'xlsmEditor.xlsmEditor';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<XlsmDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  // uri → webview 面板集合
  private readonly webviewMap = new Map<string, Set<vscode.WebviewPanel>>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      XlsmEditorProvider.viewType,
      new XlsmEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  // ---- CustomEditorProvider 接口 ----

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<XlsmDocument> {
    const fileData = await vscode.workspace.fs.readFile(uri);
    return new XlsmDocument(uri, fileData);
  }

  async resolveCustomEditor(
    document: XlsmDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    webviewPanel.webview.html = WebviewManager.getHtmlContent(
      webviewPanel.webview,
      this.context.extensionUri
    );

    // 注册到 map
    const key = document.uri.toString();
    if (!this.webviewMap.has(key)) { this.webviewMap.set(key, new Set()); }
    this.webviewMap.get(key)!.add(webviewPanel);
    webviewPanel.onDidDispose(() => this.webviewMap.get(key)?.delete(webviewPanel));

    // 处理 webview 消息
    webviewPanel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.handleMessage(msg, document, webviewPanel),
      undefined,
      this.context.subscriptions
    );
  }

  async saveCustomDocument(
    document: XlsmDocument,
    _cancel: vscode.CancellationToken
  ): Promise<void> {
    await this.writeDocument(document, document.uri);
  }

  async saveCustomDocumentAs(
    document: XlsmDocument,
    dest: vscode.Uri,
    _cancel: vscode.CancellationToken
  ): Promise<void> {
    await this.writeDocument(document, dest);
  }

  async revertCustomDocument(
    document: XlsmDocument,
    _cancel: vscode.CancellationToken
  ): Promise<void> {
    const data = await vscode.workspace.fs.readFile(document.uri);
    document.reload(data);
    this.broadcastReload(document);
  }

  // ---- 私有方法 ----

  private async handleMessage(
    msg: WebviewToExtensionMessage,
    document: XlsmDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    switch (msg.type) {
      case 'ready': {
        const sheets = document.getSheetMetas();
        const activeSheet = sheets[0]?.name ?? '';
        panel.webview.postMessage({ type: 'loadSheets', sheets, activeSheet });
        if (activeSheet) { this.sendSheetData(panel, document, activeSheet); }
        break;
      }
      case 'requestSheet':
        this.sendSheetData(panel, document, msg.sheetName);
        break;

      case 'cellEdit': {
        const { sheetName, row, col, value } = msg;
        document.applyEdit(sheetName, row, col, value);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { document.undoEdit(sheetName, row, col); },
          redo: () => { document.applyEdit(sheetName, row, col, value); },
          label: `编辑单元格`,
        });
        break;
      }
      case 'requestSave':
        try {
          await this.writeDocument(document, document.uri);
          panel.webview.postMessage({ type: 'saveResult', success: true });
        } catch (e) {
          panel.webview.postMessage({ type: 'saveResult', success: false, error: String(e) });
        }
        break;

      case 'addSheet': {
        const newName = document.addSheet(msg.name);
        const sheets = document.getSheetMetas();
        // 通知 webview 更新 tab 列表并切换到新 sheet
        panel.webview.postMessage({ type: 'loadSheets', sheets, activeSheet: newName });
        this.sendSheetData(panel, document, newName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* 暂不支持 undo 删除 sheet */ },
          redo: () => { document.addSheet(newName); },
          label: '新增工作表',
        });
        break;
      }

      case 'addRows': {
        document.addRows(msg.sheetName, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* addRows undo 暂不实现 */ },
          redo: () => { document.addRows(msg.sheetName, msg.count); },
          label: `插入 ${msg.count} 行`,
        });
        break;
      }

      case 'addCols': {
        document.addCols(msg.sheetName, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* addCols undo 暂不实现 */ },
          redo: () => { document.addCols(msg.sheetName, msg.count); },
          label: `插入 ${msg.count} 列`,
        });
        break;
      }

      case 'copyRow': {
        document.copyRow(msg.sheetName, msg.sourceRow, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* copyRow undo 暂不实现 */ },
          redo: () => { document.copyRow(msg.sheetName, msg.sourceRow, msg.count); },
          label: `复制行 ${msg.sourceRow + 1}，共 ${msg.count} 次`,
        });
        break;
      }

      case 'copyCol': {
        document.copyCol(msg.sheetName, msg.sourceCol, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* copyCol undo 暂不实现 */ },
          redo: () => { document.copyCol(msg.sheetName, msg.sourceCol, msg.count); },
          label: `复制列 ${String.fromCharCode(65 + msg.sourceCol)}，共 ${msg.count} 次`,
        });
        break;
      }

      case 'copySheet': {
        try {
          const newName = document.copySheet(msg.sourceSheetName, msg.newSheetName);
          const sheets = document.getSheetMetas();
          // 通知 webview 更新 tab 列表并切换到新 sheet
          panel.webview.postMessage({ type: 'loadSheets', sheets, activeSheet: newName });
          this.sendSheetData(panel, document, newName);
          this._onDidChangeCustomDocument.fire({
            document,
            undo: () => { /* copySheet undo 暂不实现 */ },
            redo: () => { document.copySheet(msg.sourceSheetName, newName); },
            label: `复制工作表 "${msg.sourceSheetName}"`,
          });
        } catch (e) {
          panel.webview.postMessage({
            type: 'saveResult',
            success: false,
            error: `复制工作表失败: ${String(e)}`
          });
        }
        break;
      }

      case 'deleteRow': {
        document.deleteRow(msg.sheetName, msg.rowIndex, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* deleteRow undo 暂不实现 */ },
          redo: () => { document.deleteRow(msg.sheetName, msg.rowIndex, msg.count); },
          label: `删除第 ${msg.rowIndex + 1} 行`,
        });
        break;
      }

      case 'deleteCol': {
        document.deleteCol(msg.sheetName, msg.colIndex, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* deleteCol undo 暂不实现 */ },
          redo: () => { document.deleteCol(msg.sheetName, msg.colIndex, msg.count); },
          label: `删除第 ${String.fromCharCode(65 + msg.colIndex)} 列`,
        });
        break;
      }

      case 'deleteSheet': {
        try {
          const newActiveSheet = document.deleteSheet(msg.sheetName);
          const sheets = document.getSheetMetas();
          panel.webview.postMessage({ type: 'loadSheets', sheets, activeSheet: newActiveSheet });
          this.sendSheetData(panel, document, newActiveSheet);
          this._onDidChangeCustomDocument.fire({
            document,
            undo: () => { /* deleteSheet undo 暂不实现 */ },
            redo: () => { document.deleteSheet(msg.sheetName); },
            label: `删除工作表 "${msg.sheetName}"`,
          });
        } catch (e) {
          panel.webview.postMessage({
            type: 'saveResult',
            success: false,
            error: `删除工作表失败: ${String(e)}`
          });
        }
        break;
      }

      case 'renameSheet': {
        try {
          document.renameSheet(msg.oldName, msg.newName);
          const sheets = document.getSheetMetas();
          panel.webview.postMessage({ type: 'loadSheets', sheets, activeSheet: msg.newName });
          this.sendSheetData(panel, document, msg.newName);
          this._onDidChangeCustomDocument.fire({
            document,
            undo: () => { document.renameSheet(msg.newName, msg.oldName); },
            redo: () => { document.renameSheet(msg.oldName, msg.newName); },
            label: `重命名工作表 "${msg.oldName}" → "${msg.newName}"`,
          });
        } catch (e) {
          panel.webview.postMessage({
            type: 'saveResult',
            success: false,
            error: `重命名失败: ${String(e)}`
          });
        }
        break;
      }

      case 'insertRow': {
        document.insertRow(msg.sheetName, msg.atIndex, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* insertRow undo 暂不实现 */ },
          redo: () => { document.insertRow(msg.sheetName, msg.atIndex, msg.count); },
          label: `在第 ${msg.atIndex + 1} 行插入 ${msg.count} 行`,
        });
        break;
      }

      case 'insertCol': {
        document.insertCol(msg.sheetName, msg.atIndex, msg.count);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* insertCol undo 暂不实现 */ },
          redo: () => { document.insertCol(msg.sheetName, msg.atIndex, msg.count); },
          label: `在第 ${String.fromCharCode(65 + msg.atIndex)} 列插入 ${msg.count} 列`,
        });
        break;
      }

      case 'pasteRows': {
        document.pasteRows(msg.sheetName, msg.sourceRows, msg.targetRow);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* pasteRows undo 暂不实现 */ },
          redo: () => { document.pasteRows(msg.sheetName, msg.sourceRows, msg.targetRow); },
          label: `粘贴 ${msg.sourceRows.length} 行到第 ${msg.targetRow + 1} 行`,
        });
        break;
      }

      case 'pasteCols': {
        document.pasteCols(msg.sheetName, msg.sourceCols, msg.targetCol);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* pasteCols undo 暂不实现 */ },
          redo: () => { document.pasteCols(msg.sheetName, msg.sourceCols, msg.targetCol); },
          label: `粘贴 ${msg.sourceCols.length} 列到 ${String.fromCharCode(65 + msg.targetCol)} 列`,
        });
        break;
      }

      case 'deleteRows': {
        document.deleteRows(msg.sheetName, msg.rowIndices);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* deleteRows undo 暂不实现 */ },
          redo: () => { document.deleteRows(msg.sheetName, msg.rowIndices); },
          label: `删除 ${msg.rowIndices.length} 行`,
        });
        break;
      }

      case 'deleteCols': {
        document.deleteCols(msg.sheetName, msg.colIndices);
        this.sendSheetData(panel, document, msg.sheetName);
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { /* deleteCols undo 暂不实现 */ },
          redo: () => { document.deleteCols(msg.sheetName, msg.colIndices); },
          label: `删除 ${msg.colIndices.length} 列`,
        });
        break;
      }
    }
  }

  private sendSheetData(panel: vscode.WebviewPanel, doc: XlsmDocument, sheetName: string): void {
    const { data, maxRow, maxCol } = doc.getSheetData(sheetName);
    panel.webview.postMessage({ type: 'loadSheetData', sheetName, data, maxRow, maxCol });
  }

  private async writeDocument(document: XlsmDocument, uri: vscode.Uri): Promise<void> {
    const bytes = document.serialize();
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  private broadcastReload(document: XlsmDocument): void {
    const panels = this.webviewMap.get(document.uri.toString());
    if (!panels) { return; }
    const sheets = document.getSheetMetas();
    const activeSheet = sheets[0]?.name ?? '';
    for (const panel of panels) {
      panel.webview.postMessage({ type: 'loadSheets', sheets, activeSheet });
      if (activeSheet) { this.sendSheetData(panel, document, activeSheet); }
    }
  }
}
