# VS Code 扩展中使用 Codicon 图标

## 使用场景
在 VS Code 扩展开发中，需要用 VS Code 风格的图标替换 emoji，以保持与 VS Code 整体 UI 一致。

## 关键要点

### 1. 不同场景的图标引用方式

**StatusBarItem（状态栏）**：使用 `$(icon-name)` 语法
```typescript
statusBar.text = `$(search)`;
statusBar.tooltip = new vscode.MarkdownString(
  `$(play) 直接执行`
);
```

**Webview（webview 视图）**：需加载 codicon CSS 后使用 `codicon codicon-{name}` class
```html
<!-- 加载 codicon CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0/dist/codicon.css" />

<!-- 使用图标 -->
<span class="codicon codicon-search"></span>
```

### 2. CSP 配置
在 webview 中加载外部 codicon CSS 时，需要更新 Content-Security-Policy：
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               style-src 'unsafe-inline' https://cdn.jsdelivr.net; 
               font-src https://cdn.jsdelivr.net; 
               script-src 'unsafe-inline';">
```

### 3. 模板字面量转义陷阱
webview HTML 通过 TypeScript 模板字面量生成时，内嵌的 JavaScript 模板字面量必须转义：
- 内层反引号 → `\`` （反斜杠+反引号）
- 内层 `${...}` → `\${...}` （反斜杠+美元符号）

```typescript
// TypeScript 文件中的正确写法
private getHtmlContent(): string {
  return `
    <script>
      const name = 'test';
      // webview JS 的模板字面量必须转义
      const html = \`<span>\${name}</span>\`;
    </script>
  `;
}
```

### 4. 常用 Codicon 名称映射
| 用途 | Codicon 名称 |
|------|-------------|
| 搜索/审查 | search |
| 文档/阅读 | book |
| 测试 | beaker |
| 优化/闪电 | zap |
| 注释/评论 | comment |
| 同步/重构 | sync |
| 魔法/AI | sparkle |
| 播放/执行 | play |
| 编辑 | edit |
| 代码 | code |
| 火箭 | rocket |
| 眼睛/查看 | eye |
| 灯泡/建议 | lightbulb |

### 6. Webview 编辑后同步状态栏
Webview 中编辑了数据（如修改图标名称）后，状态栏不会自动刷新。需要通过事件机制同步：

**Provider 端** — 添加 EventEmitter 事件：
```typescript
export class MyProvider implements vscode.WebviewViewProvider {
  private _onDidChangeData = new vscode.EventEmitter<void>();
  readonly onDidChangeData: vscode.Event<void> = this._onDidChangeData.event;

  // 数据变更时触发
  private onDataChanged(): void {
    this._onDidChangeData.fire();
  }
}
```

**Extension 端** — 监听事件，dispose 旧按钮重新创建：
```typescript
// 使用数组跟踪 disposable 以便 dispose
const disposables: vscode.Disposable[] = [];
createStatusBarItems(storage, disposables);

provider.onDidChangeData(() => {
  // dispose 旧的
  for (const d of disposables) d.dispose();
  disposables.length = 0;
  // 重新创建
  createStatusBarItems(storage, disposables);
});
```

注意：`onDidChangeData` 返回的 Disposable 应加入 `context.subscriptions` 以便清理。

### 5. 与 `@vscode/codicons` 包
- npm 包名：`@vscode/codicons`
- CDN：`https://cdn.jsdelivr.net/npm/@vscode/codicons@0/dist/codicon.css`
- 完整的图标列表可在 VS Code 源码或 codicons 仓库中查看
