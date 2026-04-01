import * as vscode from 'vscode';

export class WebviewManager {
  static getHtmlContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'editor.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'editor.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>XLSM Editor</title>
</head>
<body>
  <div id="sheet-tabs" class="sheet-tabs" role="tablist"></div>
  <div id="formula-bar" class="formula-bar">
    <span id="cell-addr" class="cell-addr">A1</span>
    <input id="formula-input" class="formula-input" type="text"
           placeholder="单元格内容 / 公式" spellcheck="false" />
  </div>
  <div id="toolbar" class="toolbar">
    <button id="btn-add-sheet" class="toolbar-btn" title="新增工作表">＋ 工作表</button>
    <button id="btn-copy-sheet" class="toolbar-btn" title="复制当前工作表">复制工作表</button>
    <span class="toolbar-sep"></span>
    <label class="toolbar-label">插入行</label>
    <input id="input-add-rows" class="toolbar-input" type="number" value="1" min="1" max="9999" />
    <button id="btn-add-rows" class="toolbar-btn" title="在末尾插入行">＋ 行</button>
    <span class="toolbar-sep"></span>
    <label class="toolbar-label">插入列</label>
    <input id="input-add-cols" class="toolbar-input" type="number" value="1" min="1" max="702" />
    <button id="btn-add-cols" class="toolbar-btn" title="在末尾插入列">＋ 列</button>
    <span class="toolbar-sep"></span>
    <label class="toolbar-label">复制选中行</label>
    <input id="input-copy-row-count" class="toolbar-input" type="number" value="1" min="1" max="9999" />
    <button id="btn-copy-row" class="toolbar-btn" title="将选中行复制到末尾">复制行</button>
    <span class="toolbar-sep"></span>
    <label class="toolbar-label">复制选中列</label>
    <input id="input-copy-col-count" class="toolbar-input" type="number" value="1" min="1" max="702" />
    <button id="btn-copy-col" class="toolbar-btn" title="将选中列复制到末尾">复制列</button>
  </div>
  <div id="table-container" class="table-container">
    <div id="table-wrapper" class="table-wrapper"></div>
  </div>
  <div id="status-bar" class="status-bar">
    <span id="status-msg">加载中...</span>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
