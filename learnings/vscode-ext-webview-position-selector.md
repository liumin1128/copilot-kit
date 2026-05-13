# VS Code 扩展：Webview 内状态栏位置选择器

## 背景

在侧边栏 Webview 中直接添加状态栏位置设置选择器，用户无需打开设置即可调整。

## 关键经验

### 1. 避免循环导入

`extension.ts` 和 `quickPromptsProvider.ts` 有单向依赖（extension → provider）。如果需要共享类型/常量，应该在 provider 中定义并导出，extension 从中 import，保持依赖方向一致。

### 2. Webview ↔ Extension 双向通信

- **Extension → Webview**: 使用 `webview.postMessage({ type: 'updateState', prompts, position })`，webview 通过 `window.addEventListener('message', ...)` 接收
- **Webview → Extension**: webview 通过 `vscode.postMessage({ type: 'updatePosition', position: 'left' })`，extension 在 `onDidReceiveMessage` 中处理

### 3. 配置写入

在 Webview 中修改配置使用：
```typescript
await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
```
这会触发 `onDidChangeConfiguration` 事件，extension.ts 中的监听器会自动重建状态栏。

### 4. 配置双向同步

- Provider 监听 `onDidChangeConfiguration`，当 position 配置变化时调用 `postState()` 通知 webview
- Webview 收到 `updateState` 消息后调用 `renderPosition()` 更新 UI 高亮
- 这样 settings.json 手动修改也能同步到 UI

### 5. Webview Dispose 清理

`resolveWebviewView` 中注册的 `onDidDispose` 回调需要清理 `onDidChangeConfiguration` 监听器，避免内存泄漏/webview 复用后监听器重复注册。

### 6. 按钮点击动画反馈

- 点击位置按钮后立即调用 `renderPosition()` 更新 UI（乐观更新），不等待服务端确认
- 同时显示 Toast 提示"位置已更新"
- 如果扩展端操作失败（极少发生），用户刷新 webview 即可恢复
