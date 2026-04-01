# 安装指南 / Installation Guide

## 快速安装

### 方法一：通过 VS Code 界面安装（推荐）

1. 打开 Visual Studio Code
2. 按下快捷键：
   - Windows/Linux: `Ctrl + Shift + P`
   - macOS: `Cmd + Shift + P`
3. 在命令面板中输入并选择：`Extensions: Install from VSIX...`
4. 浏览并选择下载的 `vscode-xlsm-editor-0.2.0.vsix` 文件
5. 等待安装完成，VS Code 会提示"安装成功"
6. 重新加载窗口（如需要）

### 方法二：通过命令行安装

打开终端/命令提示符，执行以下命令：

```bash
code --install-extension /path/to/vscode-xlsm-editor-0.2.0.vsix
```

将 `/path/to/` 替换为实际的文件路径。

## 验证安装

1. 在 VS Code 中按 `Ctrl + Shift + X`（macOS: `Cmd + Shift + X`）打开扩展面板
2. 搜索 "XLSM Editor"
3. 确认已安装且版本为 0.2.0

## 首次使用

1. 在 VS Code 中打开任意 `.xlsm`、`.xlsx` 或 `.xls` 文件
2. 插件将自动激活并显示编辑器界面
3. 开始编辑！

## 升级指南

### 从 v0.1.0 升级到 v0.2.0

**推荐方式：**

1. 卸载旧版本：
   - 打开扩展面板（`Ctrl + Shift + X`）
   - 找到 "XLSM Editor"
   - 点击齿轮图标 → 卸载
   
2. 重启 VS Code

3. 按照上述"快速安装"方法安装 v0.2.0

**注意：** 升级不会影响已打开的文件，但建议在升级前保存所有更改。

## 卸载

1. 打开扩展面板（`Ctrl + Shift + X`）
2. 找到 "XLSM Editor"
3. 点击齿轮图标 → 卸载
4. 重启 VS Code 以完全清除

或通过命令行：

```bash
code --uninstall-extension shun-wang.vscode-xlsm-editor
```

## 故障排除

### 插件未激活

**问题：** 打开 Excel 文件后插件没有启动

**解决方案：**
1. 确认文件扩展名为 `.xlsm`、`.xlsx` 或 `.xls`
2. 检查扩展是否已启用（扩展面板中查看）
3. 尝试重新加载窗口（`Ctrl + R`）

### 安装失败

**问题：** 提示"安装失败"或"无法安装"

**解决方案：**
1. 确认 VS Code 版本 ≥ 1.80.0（帮助 → 关于）
2. 确认 .vsix 文件未损坏（文件大小应为约 901 KB）
3. 尝试以管理员身份运行 VS Code
4. 检查磁盘空间是否充足

### 文件无法打开

**问题：** 打开 Excel 文件时报错

**解决方案：**
1. 确认文件未损坏（能在 Excel 中正常打开）
2. 文件大小建议 < 10 MB（大文件可能需要较长加载时间）
3. 检查 VS Code 控制台是否有错误信息（帮助 → 切换开发人员工具）

## 配置

安装后可在设置中配置以下选项：

```json
{
  // GitHub 仓库地址，用于检查更新
  "xlsmEditor.githubRepo": "shun-wang/vscode-xlsm-editor",

  // 启动时自动检查更新
  "xlsmEditor.autoCheckUpdates": true
}
```

打开设置：`文件 → 首选项 → 设置` → 搜索 "xlsm"

## 获取帮助

- 📖 阅读 [README.md](README.md) 了解详细功能
- 📋 查看 [CHANGELOG.md](CHANGELOG.md) 了解版本历史
- 🐛 遇到问题？提交 Issue 到 GitHub

---

**版本：** 0.2.0  
**更新日期：** 2026-03-20
