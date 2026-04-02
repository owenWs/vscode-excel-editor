# 更新履历 / Change Log

所有值得注意的更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.1.0] - 2026-04-02

### 新增 (Added)

- 🖱️ 行列拖拽排序：拖动行号/列头即可调整行列顺序
  - 拖拽时源行/列半透明显示
  - 蓝色指示线实时标识插入位置
  - 支持 `cursor: grab` 视觉提示

---

## [1.0.0] - 2026-04-01

正式发布首个稳定版本。

### 新增 (Added)

- 📊 支持 `.xlsm`、`.xlsx`、`.xls` 格式，完整保留 VBA 宏
- ✏️ 单元格值与公式编辑，顶部公式栏实时显示
- ⌨️ 键盘导航（方向键、Enter、Tab、F2、Delete、`Ctrl+S`）
- 📑 多工作表管理：切换、新增、重命名（双击 Tab）、复制（自定义名称）、删除
- 🖱️ Excel 风格行列选中：点击行号/列头，支持 `Ctrl+Click` 多选、`Shift+Click` 范围选
- 📋 多行/列 `Ctrl+C` / `Ctrl+V` 复制粘贴，插入到目标位置前
- 🗂️ 批量删除 / 插入多行/列
- 🖱️ 右键上下文菜单（单元格 / 行头 / 列头 / Sheet Tab 全覆盖）
- 🔄 自动更新：启动时静默检测 GitHub 新版本，一键下载 VSIX 并安装，提示重载窗口
- 📜 Apache 2.0 开源协议
- ⚙️ GitHub Actions 自动打包并发布 Release

### 技术栈

- TypeScript（严格模式）+ esbuild
- xlsx.js 0.18.5（VBA 宏保留）
- VS Code Custom Editor API + Webview
