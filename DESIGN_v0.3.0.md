# XLSM Editor v0.3.0 设计文档

## 目标
实现更符合 Excel 操作习惯的交互方式，支持右键菜单和快捷操作。

## 核心功能设计

### 1. 行头/列头右键菜单

#### 行头右键菜单
- **复制行** - 复制选中行到末尾
- **插入行（上方）** - 在当前行上方插入空行
- **插入行（下方）** - 在当前行下方插入空行
- **删除行** - 删除选中行

#### 列头右键菜单
- **复制列** - 复制选中列到末尾
- **插入列（左侧）** - 在当前列左侧插入空列
- **插入列（右侧）** - 在当前列右侧插入空列
- **删除列** - 删除选中列

### 2. Sheet 标签页右键菜单
- **重命名** - 弹出对话框重命名工作表
- **复制** - 复制当前工作表
- **删除** - 删除当前工作表（至少保留一个）

### 3. 行头/列头点击高亮
- 点击行头 → 高亮整行
- 点击列头 → 高亮整列
- 用于快速识别操作对象

### 4. Sheet 双击重命名
- 双击 Sheet 标签页 → 进入重命名模式
- 输入新名称 → Enter 确认，Esc 取消

## 技术实现方案

### 消息类型（已完成）
```typescript
// 删除操作
DeleteRowMessage, DeleteColMessage, DeleteSheetMessage

// 重命名操作
RenameSheetMessage

// 插入操作（指定位置）
InsertRowMessage, InsertColMessage
```

### 核心方法

#### xlsmDocument.ts
```typescript
// 删除行
deleteRow(sheetName: string, rowIndex: number, count: number): void

// 删除列
deleteCol(sheetName: string, colIndex: number, count: number): void

// 删除工作表
deleteSheet(sheetName: string): string  // 返回新的活动 sheet

// 重命名工作表
renameSheet(oldName: string, newName: string): void

// 在指定位置插入行
insertRow(sheetName: string, atIndex: number, count: number): void

// 在指定位置插入列
insertCol(sheetName: string, atIndex: number, count: number): void
```

### UI 组件

#### 右键菜单组件
```html
<div class="context-menu" id="context-menu">
  <div class="menu-item" data-action="...">...</div>
  ...
</div>
```

#### 对话框组件
```html
<div class="modal-overlay" id="rename-modal">
  <div class="modal-content">
    <input type="text" id="rename-input" />
    <button id="rename-confirm">确定</button>
    <button id="rename-cancel">取消</button>
  </div>
</div>
```

## 实现优先级

### P0 - 核心功能（必须）
1. ✅ 消息类型定义
2. 🔲 删除行/列/Sheet 方法
3. 🔲 重命名 Sheet 方法
4. 🔲 插入行/列方法（指定位置）

### P1 - 交互优化（重要）
5. 🔲 行头/列头右键菜单
6. 🔲 Sheet 标签页右键菜单
7. 🔲 重命名对话框

### P2 - 视觉增强（可选）
8. 🔲 行头/列头点击高亮
9. 🔲 右键菜单样式优化
10. 🔲 工具栏简化

## 工具栏布局优化

### 当前布局
```
[+ 工作表] [复制工作表] | [插入行] [数量] [+ 行] | ...（太多按钮）
```

### 优化后布局
```
[+ 工作表] | [保存] | [撤销] [重做]
（行/列/Sheet 操作改为右键菜单）
```

## 兼容性考虑

### VBA 宏保留
- 删除行/列不会影响 VBA 宏
- 重命名 Sheet 需要确保工作簿完整性
- 删除 Sheet 保留其他 Sheet 的宏

### 公式引用
- 删除行/列可能导致公式引用错误（#REF!）
- 需要提示用户谨慎操作
- 未来可考虑自动更新公式引用

## 用户体验优化

### 确认对话框
- 删除 Sheet 时弹出确认对话框
- 删除行/列超过 10 行/列时弹出确认
- 防止误操作

### 操作反馈
- 右键菜单操作后立即更新界面
- 状态栏显示操作结果
- 错误时显示友好提示

### 快捷键支持（未来）
- Ctrl+C / Ctrl+V - 复制粘贴
- Ctrl+Z / Ctrl+Y - 撤销重做
- F2 - 编辑/重命名
- Delete - 删除

## 实现计划

### Phase 1: 核心方法实现（1-2h）
- 实现 deleteRow/deleteCol/deleteSheet
- 实现 renameSheet
- 实现 insertRow/insertCol

### Phase 2: 右键菜单 UI（1-2h）
- 创建右键菜单组件
- 添加行头/列头右键事件
- 添加 Sheet 标签页右键事件

### Phase 3: 对话框和确认（1h）
- 重命名对话框
- 删除确认对话框
- 输入验证

### Phase 4: 样式和优化（30min）
- 右键菜单样式
- 高亮效果
- 工具栏简化

### Phase 5: 测试和文档（30min）
- 功能测试
- 边界测试
- 更新文档

## 风险和注意事项

### 技术风险
- xlsx.js 库对行/列删除的支持
- 公式引用更新的复杂性
- VBA 宏的完整性保证

### 用户风险
- 误删除操作不可撤销（Undo 未实现）
- 公式引用可能失效
- 大量数据操作可能卡顿

### 缓解措施
- 添加确认对话框
- 提供操作提示
- 建议用户先保存文件

## 成功标准

1. 右键菜单流畅可用
2. 删除/插入/重命名功能正常
3. VBA 宏完整保留
4. 用户体验符合 Excel 习惯
5. 无明显性能问题

## 后续优化方向

- 完整的 Undo/Redo 实现
- 复制粘贴支持
- 多选行/列操作
- 拖拽排序
- 公式引用自动更新
