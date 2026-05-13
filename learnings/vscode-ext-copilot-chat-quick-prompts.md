# VS Code 扩展开发：Copilot 聊天快捷提示词

## 背景

开发一个 VS Code 扩展，在侧边栏添加快捷提示词按钮，点击后自动将预设提示词发送到 Copilot 聊天输入框。

## 关键经验

### 1. 扩展架构

- **Webview View Provider**: 实现 `vscode.WebviewViewProvider` 接口，在侧边栏创建自定义视图
- **Activity Bar 图标**: 在 `package.json` 的 `viewsContainers.activitybar` 中声明，可在活动栏添加自定义图标
- **视图位置**: 使用 `views` 贡献点将 Webview 视图绑定到自定义的 view container

### 2. 与 Copilot 聊天交互

- **发送提示词到聊天输入框**: 使用 `vscode.commands.executeCommand('workbench.action.chat.open', { query: promptText })`
- **备选方案**: 如果上述命令不支持参数，降级为复制到剪贴板 + 聚焦聊天面板
- **聚焦聊天**: `vscode.commands.executeCommand('workbench.action.chat.focus')`

### 3. Webview 开发要点

- **CSP 设置**: Webview 需要设置 Content-Security-Policy，使用 `'unsafe-inline'` 允许内联脚本和样式
- **通信机制**: 使用 `acquireVsCodeApi().postMessage()` 从 Webview 向扩展进程发送消息
- **data 属性**: 预设提示词通过 `data-prompt` 属性存储在按钮上，注意 HTML 转义

### 4. 预设提示词设计

- 使用图标 + 文字组合，直观易用
- 每个按钮有不同颜色区分功能
- 左键点击：发送提示词
- 右键点击：附带当前编辑器选中代码一起发送

### 5. 持久化存储

- 使用 `ExtensionContext.globalState` 存储用户自定义的提示词
- 通过 `Memento` 接口的 `get<T>()` 和 `update()` 方法读写
- Provider 构造函数注入 `vscode.Memento`，避免直接依赖整个 context

### 6. Webview 状态同步模式

- **init 流程**: webview 加载完成后发送 `{ type: 'ready' }`，扩展收到后回传数据
- **双向同步**: 扩展端维护数据源（globalState），通过 `postMessage` 推送更新到 webview
- **增量更新**: 用户编辑 → webview 发送 `savePrompts` → 扩展保存并广播 `updatePrompts`

### 7. 两种执行模式

- **direct（直接执行）**: `workbench.action.chat.open` 带 `query` 参数，打开聊天即发送
- **write（写入输入框）**: 复制到剪贴板 + `workbench.action.chat.focus`，用户自行粘贴发送
- 命令参数扩展：`registerCommand` 的 handler 支持第二个参数传递 mode

### 8. 弹窗编辑 UI

- 使用底部弹出式 Modal（`align-items: flex-end`），类似 iOS 风格
- 遮罩层点击关闭 + 取消按钮关闭
- Enter 键在标题输入框跳转到内容输入框
- 表单验证：标题和内容不能为空

### 9. 注意事项

- VS Code 版本需 >= 1.93.0 以获得 Chat API 支持
- `workbench.action.chat.open` 的 `query` 参数在不同版本支持程度不同
- Webview 中的 `console.log` 不会显示在扩展宿主控制台，需要用 `vscode.window.showInformationMessage` 调试
- 编译时 tsconfig 需要配置 `"lib": ["ES2022", "DOM"]` 以支持浏览器 API 类型
- 模板字符串中使用 `\${}` 时，在 TS 中需要用反斜杠转义以区分模板字面量

### 10. 状态栏扩展

- `vscode.window.createStatusBarItem(alignment, priority)` 创建状态栏项
- `StatusBarAlignment.Right` 右对齐，priority 越小越靠右
- `statusBar.text` 支持图标语法 `$(iconName)` 或直接使用 emoji
- `statusBar.command` 绑定点击命令，支持 `arguments` 传参
- 状态栏不支持右键菜单，复杂交互需用侧边栏 Webview
- Copilot 聊天输入框下方工具栏不是公开 API 扩展点，无法直接注入按钮
