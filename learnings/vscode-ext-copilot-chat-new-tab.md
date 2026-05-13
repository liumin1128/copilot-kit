# VS Code 扩展开发：打开 Copilot 聊天标签页

## 背景

需要在状态栏添加一个按钮，点击后打开新的 Copilot 聊天标签页（在编辑器区域，而非侧边栏），继续点击会向右拆分编辑器并打开更多聊天窗口。

## 关键经验

### 1. 在编辑器标签页中打开 Chat 而非侧边栏

- `workbench.action.openChat` — ✅ **推荐**。在 active editor group 中打开聊天编辑器标签页，**不会触发侧边栏**
- `workbench.action.chat.open` — ❌ 会连带打开 Copilot 侧边栏/面板，不适合仅打开编辑器标签页的场景
- `workbench.action.chat.openNewSessionEditor.{type}` — 在编辑器标签页打开特定类型的新会话（如 `copilotcli`、`copilot-cloud-agent`、`local` 等）
- `workbench.action.openChatToSide` — 在编辑器侧边分组中打开新聊天（不影响侧边栏）
- `workbench.action.splitEditorRight` — 向右拆分编辑器，创建新的编辑器组

### 2. 最佳实现方案

```ts
async function openNewChatTab(): Promise<void> {
  const hasTabs = vscode.window.tabGroups.activeTabGroup.tabs.length > 0;

  if (hasTabs) {
    // 已有标签页 → 向右拆分，在新组中打开聊天
    await vscode.commands.executeCommand("workbench.action.splitEditorRight");
    await vscode.commands.executeCommand("workbench.action.openChat");
  } else {
    // 无标签页 → 直接在当前组打开聊天（避免产生空白 untitled 标签页）
    await vscode.commands.executeCommand("workbench.action.openChat");
  }
}
```

### 3. 关键注意事项

- **无标签页时不要拆分**：`splitEditorRight` 在无标签页时会产生一个空白的 untitled 文件，需要先检查 `vscode.window.tabGroups.activeTabGroup.tabs.length`
- `workbench.action.openChat` 在无标签页时会在当前编辑器组直接打开聊天，不会触发侧边栏

- 每次点击先拆分再打开，相当于"向右拆分编辑器" + "新聊天"
- 连续点击会不断向右拆分，每个新窗格都打开一个聊天

### 3. 状态栏按钮放置

- 自定义按钮使用 `StatusBarAlignment.Left`，优先级设在标签和提示词按钮之间
- 更高的 priority 值更靠左（StatusBarAlignment.Left 场景下）
- 使用 `$(plus)` 图标表示"新增"操作
