# VSCode 扩展配置迁移：globalState → settings.json

## 场景
将扩展的配置数据从 `context.globalState`（SQLite 存储）迁移到 VS Code 的 `settings.json`，使所有配置对用户可见且可直接编辑。

## 关键步骤

### 1. `package.json` 定义配置项
```json
"copilotKit.prompts": {
  "type": "array",
  "default": [],
  "description": "...",
  "items": { "type": "object" }
}
```

### 2. 读取配置
```typescript
const data = vscode.workspace.getConfiguration().get<Type[]>(CONFIG_KEY, []);
```

### 3. 写入配置
```typescript
await vscode.workspace.getConfiguration().update(
  CONFIG_KEY,
  data,
  vscode.ConfigurationTarget.Global,
);
```

### 4. 监听配置变更
```typescript
vscode.workspace.onDidChangeConfiguration((e) => {
  if (e.affectsConfiguration(CONFIG_KEY)) {
    // 重新加载
  }
});
```

## 注意事项
- `ConfigurationTarget.Global` 写入用户级 `settings.json`，`Workspace` 写入 `.vscode/settings.json`
- `update()` 是异步操作，需要 `await`
- `object`/`array` 类型的配置项在 VS Code 设置 UI 中不渲染编辑器，用户需要在 `settings.json` 中直接编辑 JSON
- 迁移后 `context.globalState` 中的旧数据不会自动清除，可考虑做一次性迁移或忽略
- 内置项（builtIn）建议在加载时动态补充，不持久化到配置中保持干净
