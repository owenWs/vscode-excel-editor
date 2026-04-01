# 更新履历 / Change Log

所有值得注意的更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.1] - 2026-04-01

### 新增 (Added)
- ✨ **多行选中**：点击行号单选，Ctrl+单击追加，Shift+单击范围选中
- ✨ **多列选中**：点击列头单选，Ctrl+单击追加，Shift+单击范围选中
- ✨ **多行/列复制粘贴**：Ctrl+C 复制选中的多行/列，选中目标后 Ctrl+V 插入到目标位置上方/左侧
- ✨ **批量删除行/列**：右键菜单支持一次删除多个选中行/列
- ✨ **批量插入行/列**：右键菜单按选中数量自动插入对应数量的空行/列

### 改进 (Improved)
- 🎨 地址栏同步显示多选状态，如 `2:4 (3行)`
- 🎨 右键菜单标签动态反映选中数量，如"复制 3 行"、"删除 2 列"
- 📦 多行/列粘贴一次性调用 `insertRow/insertCol`，性能更优

### 技术细节 (Technical)
- 新增 `PasteRowsMessage`、`PasteColsMessage`、`DeleteRowsMessage`、`DeleteColsMessage` 消息类型
- 新增 `xlsmDocument.pasteRows()`、`pasteCols()`、`deleteRows()`、`deleteCols()` 方法
- state 中 `selectedRowIndex/selectedColIndex` 升级为 `selectedRows(Set)`/`selectedCols(Set)`
- 行列头点击事件支持 `e.ctrlKey`（追加）和 `e.shiftKey`（范围）修饰键

---

## [0.3.0] - 2026-04-01

### 新增 (Added)
- ✨ **行/列整体选中**：点击行号或列头，整行/列高亮（类 Excel 体验）
- ✨ **Ctrl+C / Ctrl+V 行列复制粘贴**：复制后虚线边框标识，粘贴时在目标位置前插入
- ✨ **右键上下文菜单**：行头、列头、数据单元格、Sheet Tab 均支持右键菜单
- ✨ **复制工作表时命名**：弹出对话框输入新名称，不再自动命名
- ✨ **Sheet Tab 双击重命名**：双击 Tab 直接内联编辑名称
- ✨ **Sheet Tab 右键菜单**：支持重命名、复制工作表、删除工作表

### 改进 (Improved)
- 🎨 单元格右键菜单：复制/粘贴/清空/插入行列/删除行列
- 🎨 剪贴板内容通过虚线边框在表格中可视化标识
- 🔧 Ctrl+S 全局快捷键保存

### 技术细节 (Technical)
- 新增 `PasteRowMessage`、`PasteColMessage` 消息类型
- 新增 `xlsmDocument.pasteRow()`、`pasteCol()` 方法（先保存再插入，避免行移位）
- Webview 新增自定义右键菜单、模态对话框组件（纯 JS 动态生成）
- CSS 新增右键菜单、模态框、行列选中高亮、剪贴板虚线标识样式

---

## [0.2.0] - 2026-03-20

### 新增 (Added)
- ✨ **复制行功能**：支持将选中行复制到工作表末尾，可指定复制次数
- ✨ **复制列功能**：支持将选中列复制到工作表末尾，可指定复制次数
- ✨ **复制工作表功能**：支持一键复制整个工作表，自动生成新名称
- 🎨 工具栏新增"复制工作表"按钮
- 🎨 工具栏新增"复制选中行"输入框和按钮
- 🎨 工具栏新增"复制选中列"输入框和按钮

### 改进 (Improved)
- 📦 所有复制操作完整保留单元格格式、公式和 VBA 宏
- 📦 复制工作表时智能命名避免冲突（如 "Sheet1 (2)"）
- 🔧 深拷贝单元格对象确保数据独立性
- 🔧 自动更新工作表范围 (`!ref`) 确保数据完整性

### 技术细节 (Technical)
- 新增 `CopyRowMessage`、`CopyColMessage`、`CopySheetMessage` 消息类型
- 新增 `xlsmDocument.copyRow()`、`copyCol()`、`copySheet()` 核心方法
- 完善消息处理和错误处理机制
- 支持文档修改状态追踪和 Undo/Redo 基础框架

---

## [0.1.0] - 2026-03-XX

### 新增 (Added)
- 🎉 首次发布
- ✨ 支持在 VS Code 中查看和编辑 .xlsm、.xlsx、.xls 文件
- ✨ 完整保留 VBA 宏不丢失
- ✨ 支持单元格编辑（值和公式）
- ✨ 支持多工作表切换
- ✨ 支持新增工作表
- ✨ 支持在末尾插入空行/空列
- 🎨 类 Excel 表格 UI，支持键盘导航
- 🎨 公式栏显示单元格内容和公式
- 🎨 状态栏显示操作反馈
- 🔧 自动检查更新功能

### 技术实现 (Technical)
- 基于 xlsx.js 库进行文件解析和序列化
- 使用 Custom Editor API 实现编辑器
- Webview 通信架构支持实时更新
- TypeScript + esbuild 构建系统
