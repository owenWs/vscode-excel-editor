import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

/** 跟随重定向的 HTTPS GET，返回解析后的 JSON */
function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'vscode-xlsm-editor' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) { resolve(fetchJson<T>(res.headers.location)); return; }
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** 下载二进制文件到指定路径，支持重定向（GitHub Release 资产需要多次跳转） */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, depth = 0) => {
      if (depth > 5) { reject(new Error('重定向次数过多')); return; }
      const req = https.get(u, { headers: { 'User-Agent': 'vscode-xlsm-editor' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          if (res.headers.location) { res.resume(); follow(res.headers.location, depth + 1); return; }
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
        res.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
      });
      req.on('error', reject);
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('下载超时')); });
    };
    follow(url);
  });
}

/** 比较语义化版本，返回 true 表示 remote > local */
function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPat] = parse(local);
  const [rMaj, rMin, rPat] = parse(remote);
  if (rMaj !== lMaj) { return rMaj > lMaj; }
  if (rMin !== lMin) { return rMin > lMin; }
  return rPat > lPat;
}

export async function checkForUpdates(
  context: vscode.ExtensionContext,
  silent = false
): Promise<void> {
  const config = vscode.workspace.getConfiguration('xlsmEditor');
  const repo: string = config.get('githubRepo', '').trim();

  if (!repo) {
    if (!silent) {
      vscode.window.showInformationMessage(
        'XLSM Editor: 请先在设置中配置 xlsmEditor.githubRepo（格式：owner/repo）'
      );
    }
    return;
  }

  const currentVersion: string = context.extension.packageJSON.version;

  try {
    const release = await fetchJson<GitHubRelease>(
      `https://api.github.com/repos/${repo}/releases/latest`
    );

    const remoteVersion = release.tag_name.replace(/^v/, '');

    if (!isNewer(currentVersion, remoteVersion)) {
      if (!silent) {
        vscode.window.showInformationMessage(`XLSM Editor: 已是最新版本 v${currentVersion}`);
      }
      return;
    }

    // 找到 .vsix 资产
    const vsixAsset = release.assets.find((a) => a.name.endsWith('.vsix'));

    const action = await vscode.window.showInformationMessage(
      `XLSM Editor 有新版本 v${remoteVersion}（当前 v${currentVersion}）`,
      '立即更新',
      '查看详情',
      '忽略'
    );

    if (action === '查看详情') {
      vscode.env.openExternal(vscode.Uri.parse(release.html_url));
      return;
    }

    if (action !== '立即更新') { return; }

    if (!vsixAsset) {
      // 没有 VSIX 资产，回退到打开浏览器
      vscode.env.openExternal(vscode.Uri.parse(release.html_url));
      return;
    }

    // 下载 VSIX 到临时目录并自动安装
    const tmpPath = path.join(os.tmpdir(), vsixAsset.name);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在下载 XLSM Editor v${remoteVersion}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0, message: '连接中...' });
        await downloadFile(vsixAsset.browser_download_url, tmpPath);
        progress.report({ increment: 100, message: '下载完成，正在安装...' });
      }
    );

    // 使用 VS Code 内置命令安装本地 VSIX
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      vscode.Uri.file(tmpPath)
    );

    // 清理临时文件
    try { fs.unlinkSync(tmpPath); } catch (_) {}

    const reload = await vscode.window.showInformationMessage(
      `XLSM Editor 已更新到 v${remoteVersion}，重载窗口后生效`,
      '立即重载'
    );
    if (reload === '立即重载') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }

  } catch (e) {
    if (!silent) {
      vscode.window.showWarningMessage(`XLSM Editor: 检查更新失败 — ${e}`);
    }
  }
}
