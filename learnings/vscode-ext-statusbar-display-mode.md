# VS Code 扩展：状态栏按钮显示模式（图标/文本/图标+文本）及增删功能

## 需求背景

用户希望底部快捷按钮可以自定义显示模式：仅图标、仅文本、图标+文本，并且支持新增和删除快捷按钮。

## 关键实现

### 1. 数据模型扩展（PromptItem）

```typescript
export interface PromptItem {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  color: string;
  mode: "direct" | "write";
  displayMode: "icon" | "text" | "both";  // 新增字段
}
```

### 2. 状态栏文本渲染（extension.ts）

根据 `displayMode` 决定 `statusBar.text` 的格式：

```typescript
if (item.displayMode === "text") {
  statusBar.text = item.label;                          // 仅文本
} else if (item.displayMode === "both") {
  statusBar.text = `$(${item.icon}) ${item.label}`;     // 图标+文本
} else {
  statusBar.text = `$(${item.icon})`;                   // 仅图标（默认）
}
```

### 3. 旧数据兼容

用户之前保存的数据没有 `displayMode` 字段，加载时需默认填充 `"icon"`：

```typescript
const parsed = JSON.parse(saved) as PromptItem[];
return parsed.map(p => ({ ...p, displayMode: p.displayMode || "icon" }));
```

Provider 端和 extension 端都需要做此处理。

### 4. 新增按钮

- Webview 底部添加 `+ 添加快捷按钮` 按钮（虚线边框样式）
- 点击打开编辑弹窗，`editingId` 设为空字符串
- 保存时生成唯一 ID：`custom-${Date.now()}`
- 默认 icon 设为 `sparkle`，默认显示方式为 `仅图标`

### 5. 删除按钮

- 每个卡片操作区新增删除按钮（垃圾桶图标）
- 使用 `confirm()` 确认后执行删除
- 从 `promptsCache` 中过滤掉对应 id 的项，通过 `savePrompts` 消息保存

### 6. 显示方式选择器

- 编辑弹窗中 icon 输入框下方添加三个按钮：仅图标 / 仅文本 / 图标+文本
- 样式复用 `.mode-option`，选中态高亮
- 保存时读取 `#displayModeOptions .mode-option.active` 的 `data-mode` 值

### 7. 注意事项

- `displayMode` 默认值为 `"icon"`，保持向后兼容
- 新增按钮的 id 用 `custom-` 前缀 + 时间戳，避免与预设 ID 冲突
- 删除操作使用 `confirm()`，webview 中可用浏览器原生 confirm
