# Excel Editor — VS Code Extension

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)]()

在 Visual Studio Code 中直接查看和编辑 Excel 文件（`.xlsm`、`.xlsx`、`.xls`），**完整保留 VBA 宏不丢失**。

---

## ✨ 功能特性

### 编辑
- 📊 支持 `.xlsm`（带宏）、`.xlsx`、`.xls` 格式
- 🔒 完整保留 VBA 宏，保存后不会丢失
- ✏️ 单元格值和公式编辑，顶部公式栏实时显示
- ⌨️ 键盘导航（方向键、Enter、Tab、F2、Delete、Ctrl+S）

### 行列操作
- 🖱️ **点击行号 / 列头**整行/列选中，支持 `Ctrl+Click` 多选、`Shift+Click` 范围选
- 📋 `Ctrl+C` 复制选中行/列，`Ctrl+V` 插入到目标位置前
- ➕ 插入空行/列（工具栏）
- ❌ 删除行/列（右键菜单）

### 工作表管理
- 📑 多工作表切换、新增、重命名（双击 Tab）、删除
- 🗂️ 复制工作表并自定义新名称

### 右键菜单
- 单元格：复制 / 粘贴 / 清空 / 插入行列 / 删除行列
- 行头 / 列头：复制、粘贴、插入、删除（支持多选批量操作）
- Sheet Tab：重命名、复制工作表、删除工作表

### 自动更新
- 🔄 启动时静默检测 GitHub 新版本
- 一键下载 VSIX 并自动安装，提示重载窗口

---

## 📦 安装

### 从 GitHub Release 下载
1. 前往 [Releases](https://github.com/owenWs/vscode-excel-editor/releases) 下载最新 `.vsix`
2. VS Code 中按 `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
3. 选择下载的文件即可

### 命令行安装
```bash
code --install-extension vscode-excel-editor-1.0.0.vsix
```

---

## 🚀 使用方法

在 VS Code 中打开任意 `.xlsm`、`.xlsx`、`.xls` 文件，插件自动激活。

### 单元格编辑
| 操作 | 方式 |
|------|------|
| 选中单元格 | 单击 |
| 开始编辑 | 双击 / `Enter` / `F2` / 直接输入字符 |
| 提交编辑 | `Enter` |
| 取消编辑 | `Esc` |
| 清空内容 | `Delete` / `Backspace` |
| 保存文件 | `Ctrl+S` |

### 行列选中与复制
| 操作 | 方式 |
|------|------|
| 选中整行 | 点击行号 |
| 选中整列 | 点击列头（A/B/C…） |
| 多选（追加） | `Ctrl+Click` 行号/列头 |
| 范围选中 | `Shift+Click` 行号/列头 |
| 复制选中行/列 | `Ctrl+C` |
| 粘贴到目标位置前 | 选中目标行/列后 `Ctrl+V` |

### 工作表操作
| 操作 | 方式 |
|------|------|
| 切换工作表 | 点击底部 Tab |
| 重命名 | 双击 Tab / 右键 → 重命名 |
| 新增工作表 | 工具栏 **＋ 工作表** |
| 复制工作表 | 工具栏 **复制工作表** / 右键 Tab |
| 删除工作表 | 右键 Tab → 删除工作表 |

---

## ⚙️ 设置

```json
{
  // GitHub 仓库，用于自动检查更新
  "excelEditor.githubRepo": "owenWs/vscode-excel-editor",

  // 启动时自动检查更新（默认开启）
  "excelEditor.autoCheckUpdates": true
}
```

手动检查更新：`Ctrl+Shift+P` → **Excel Editor: 检查更新**

---

## 📝 功能清单

### 已支持
✅ 单元格值 / 公式编辑
✅ 多工作表切换 / 新增 / 重命名 / 复制 / 删除
✅ 整行 / 整列选中（多选、范围选）
✅ 行列 Ctrl+C / Ctrl+V 复制粘贴（插入到目标位置）
✅ 批量删除 / 插入行列
✅ 右键上下文菜单（单元格 / 行头 / 列头 / Sheet Tab）
✅ VBA 宏完整保留
✅ 文档修改状态追踪（标题栏 `●` 标记）
✅ 自动更新（下载安装 VSIX）

### 暂不支持
❌ 单元格样式（颜色、字体、边框）
❌ 合并单元格
❌ 图表和图片
❌ 数据验证和条件格式
❌ Undo / Redo

---

## 🐛 已知问题

1. 大文件（>10 MB）加载可能较慢
2. 复杂公式可能显示为计算后的值
3. 不支持外部链接和动态数据源

---

## 🛠️ 技术栈

| 项目 | 说明 |
|------|------|
| TypeScript | 严格模式 |
| [xlsx.js](https://sheetjs.com/) v0.18.5 | Excel 文件解析与序列化 |
| esbuild | 构建打包 |
| VS Code Custom Editor API | 编辑器框架 |

---

## 📄 许可证

[Apache License 2.0](LICENSE) © 2026 shun.wang

---

⭐ 如果这个插件对你有帮助，欢迎 Star！
