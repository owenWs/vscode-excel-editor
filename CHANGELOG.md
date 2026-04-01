# 更新履历 / Change Log

所有值得注意的更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-04-01

正式发布首个稳定版本，插件更名为 **Excel Editor**。

### 功能亮点

- 📊 支持 `.xlsm`、`.xlsx`、`.xls` 格式，完整保留 VBA 宏
- ✏️ 单元格编辑、公式编辑、公式栏显示
- 📑 多工作表管理：新增、复制（自定义名称）、重命名、删除
- 🖱️ **Excel 风格行列选中**：点击行号/列头，支持 Ctrl+Click 多选、Shift+Click 范围选
- 📋 **Ctrl+C / Ctrl+V 行列复制粘贴**：插入到目标位置前，保留原始数据
- 🗂️ **批量操作**：多行/列同时删除、插入
- 🖱️ **右键上下文菜单**：单元格、行头、列头、Sheet Tab 全覆盖
- 🔄 **自动更新**：启动时检测 GitHub 新版本，一键下载安装，无需手动操作
- ⌨️ 键盘导航（方向键、Enter、Tab、F2、Delete、Ctrl+S）

### 新增 (Added)
- ✨ 多行/列选中（Ctrl+Click 追加、Shift+Click 范围）
- ✨ 多行/列 Ctrl+C / Ctrl+V 复制粘贴（插入到目标位置）
- ✨ 右键菜单全覆盖（单元格 / 行头 / 列头 / Sheet Tab）
- ✨ 复制工作表时弹窗输入新名称
- ✨ Sheet Tab 双击内联重命名
- ✨ 自动更新：下载 VSIX 后直接安装，提示重载窗口
- ✨ Apache 2.0 开源协议
- ✨ GitHub Actions 自动打包发布 Release

### 改进 (Improved)
- 🎨 地址栏显示多选状态，如 `2:4 (3行)`
- 🎨 右键菜单标签动态反映选中数量
- 🎨 剪贴板行/列以虚线边框可视化标识
- 🔧 Ctrl+S 全局保存快捷键

### 技术栈
- TypeScript + esbuild
- xlsx.js 0.18.5（VBA 宏保留）
- VS Code Custom Editor API + Webview

---

## 历史预发布版本

> 以下为正式发布前的开发迭代记录。

### [0.3.1] - 2026-04-01
- 多行/列选中与批量操作
- `pasteRows`/`pasteCols`/`deleteRows`/`deleteCols` 方法

### [0.3.0] - 2026-04-01
- 行/列整体选中、右键菜单、自动更新改为下载安装

### [0.2.0] - 2026-03-20
- 复制行/列/工作表功能

### [0.1.0] - 2026-03-20
- 首次可用版本，基础编辑 + VBA 宏保留
