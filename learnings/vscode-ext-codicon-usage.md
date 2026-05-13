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

### 4. 图标选择器实现方案

**问题**：Webview 中需要让用户选择 codicon 图标，如何展示全部 600+ 个图标？

**推荐方案**：将所有 codicon 名称嵌入 JS 数组 + 搜索过滤

```
// ❌ 不推荐：只展示几十个常用图标，用户找不到想要的
const COMMON_ICONS = ['search', 'book', 'beaker', ...]; // 35 个

// ✅ 推荐：嵌入完整列表 + 搜索输入框过滤
const ALL_CODICONS = ['account', 'add', ...]; // 649 个
let iconFilter = '';

// 根据搜索词过滤
function renderIconSuggestions(selected) {
  const filter = iconFilter.toLowerCase();
  const filtered = filter
    ? ALL_CODICONS.filter(name => name.includes(filter))
    : ALL_CODICONS;
  // 渲染...
}
```

**关键要点**：
- 完整 codicon 列表约 649 个图标名称，纯文本仅 ~15KB，不影响 VSIX 包体积
- codicon 字体文件（~80KB）已通过 CDN 加载，无论展示多少图标都不会增加额外网络开销
- 必须配合**搜索输入框**，否则用户难以从 600+ 个图标中找到目标
- 图标网格容器需设置 `max-height` + `overflow-y: auto`，避免撑爆弹窗
- 可用 `curl` 从 CDN 的 CSS 中提取完整图标名：
  ```bash
  curl -s "https://cdn.jsdelivr.net/npm/@vscode/codicons@0/dist/codicon.css" \
    | grep -o '\.codicon-[a-zA-Z0-9_-]*:before' \
    | sed 's/\.codicon-//;s/:before//' | sort -u
  ```
- 无需额外网络请求（connect-src），所有图标名已嵌入 HTML，符合最低权限原则

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
