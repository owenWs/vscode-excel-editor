import * as vscode from 'vscode';
import { XlsmEditorProvider } from './XlsmEditorProvider';
import { checkForUpdates } from './updater';

export function activate(context: vscode.ExtensionContext): void {
  // 注册自定义编辑器
  context.subscriptions.push(
    XlsmEditorProvider.register(context)
  );

  // 手动检查更新命令
  context.subscriptions.push(
    vscode.commands.registerCommand('xlsmEditor.checkForUpdates', () => {
      checkForUpdates(context, false);
    })
  );

  // 启动时静默检查（延迟 5 秒，避免影响启动速度）
  const autoCheck = vscode.workspace.getConfiguration('xlsmEditor').get('autoCheckUpdates', true);
  if (autoCheck) {
    setTimeout(() => checkForUpdates(context, true), 5000);
  }
}

export function deactivate(): void {
  // context.subscriptions 自动清理
}
