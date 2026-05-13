# VS Code 扩展：代码简化模式

## 常见简化模式

### 1. hasAnyTab → Array.some()

```typescript
// 优化前
function hasAnyTab(): boolean {
  for (const group of vscode.window.tabGroups.all) {
    if (group.tabs.length > 0) return true;
  }
  return false;
}

// 优化后
function hasAnyTab(): boolean {
  return vscode.window.tabGroups.all.some(group => group.tabs.length > 0);
}
```

### 2. 复制数组：map({...}) → slice()

```typescript
// 优化前
return DEFAULT_PROMPTS.map(p => ({ ...p }));

// 优化后（当元素是不可变对象时）
return DEFAULT_PROMPTS.slice();
```

### 3. try/catch 范围缩窄 + early return

```typescript
// 优化前：整个函数被 try 包裹
async function sendToCopilotChat(text: string, mode: string): Promise<void> {
  try {
    if (mode === "direct") { ... }
    else { ... }
  } catch { ... }
}

// 优化后：direct 模式提前 return，try 只包裹容易失败的逻辑
async function sendToCopilotChat(text: string, mode: string): Promise<void> {
  if (mode === "direct") { ...; return; }
  try { ... } catch { ... }
}
```

### 4. 提取辅助函数减少重复

将重复的状态栏创建逻辑提取为独立函数 `createPromptButton`，降低 `createStatusBarItems` 的圈复杂度。

### 5. forEach → for...of

当循环体内有 `return`、`break`、`await` 或需要提前退出时用 `for...of` 更清晰；纯遍历时 `forEach` 仍可用。
