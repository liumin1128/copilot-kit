# VS Code 侧边栏 Webview 原生列表风格优化

## 背景
侧边栏 Webview 的列表项使用了卡片边框风格，显得拥挤且不像是 VS Code 原生 UI。

## 优化要点

### 1. 去掉卡片边框，使用纯背景 + hover 效果
- 删除 `border`、`border-radius`（大圆角）、`background` 显式设置
- 使用 `--vscode-list-hoverBackground` 实现悬停高亮
- 编辑按钮默认隐藏，悬停时显示（`display: none` → `display: flex`）

### 2. 使用 VS Code 原生列表变量
```css
--hover: var(--vscode-list-hoverBackground);
--list-active: var(--vscode-list-activeSelectionBackground);
--list-active-fg: var(--vscode-list-activeSelectionForeground);
```

### 3. 标题统一为 section-header 模式
- 标题容器 `display: flex; padding: 12px 12px 4px`
- codicon 图标 + 大写字母间距标题文本
- 位置区域用 `border-top` 分割线分隔

### 4. 间距调整
- body padding 从 `8px` 改为 `0`
- 列表区域 `padding: 2px 8px`
- 卡片项 `padding: 6px 8px`（适中行高）
- 按钮类区域 `padding: 0 12px`

### 5. 字号权重调整
- 列表项 label 从 `font-weight: 500` 改为 `400`（VS Code 标准）
- 字体大小保持 `13px`
