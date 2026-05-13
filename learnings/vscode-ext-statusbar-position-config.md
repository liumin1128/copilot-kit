# VS Code 扩展：状态栏位置配置

## 背景

为 Copilot Kit 扩展的状态栏按钮增加位置配置选项。

## 关键经验

### 1. `StatusBarAlignment` 只有 `Left` 和 `Right`

- `StatusBarAlignment.Left = 1`: 左侧，priority 越高越靠左
- `StatusBarAlignment.Right = 2`: 右侧，priority 越高越靠右
- 没有 `Center` 对齐方式，可以通过设置 `Left` 搭配极低 priority（如 1）模拟居中效果

### 2. Priority 策略

- VS Code 默认状态栏图标 priority 约为 100
- 左侧：priority > 100 即比默认图标更靠左；priority < 100 则在默认图标右边（靠近中间）
- 右侧：priority > 100 即比默认图标更靠右；priority < 100 则在默认图标左边（靠近中间）

### 3. 配置贡献点

在 `package.json` 的 `contributes.configuration` 中定义，支持 `enum` + `enumDescriptions`：

```json
"copilotKit.statusBarPosition": {
  "type": "string",
  "enum": ["leftAfterIcon", "left", "center", "right", "rightAfterIcon"],
  "enumDescriptions": ["左侧，在默认图标右边", "左侧靠边", "居中", "右侧", "右侧，在默认图标右边"],
  "default": "leftAfterIcon",
  "description": "状态栏快捷按钮的显示位置"
}
```

### 4. 监听配置变更

使用 `vscode.workspace.onDidChangeConfiguration` 监听配置变化，通过 `e.affectsConfiguration(key)` 判断是否相关变更，自动重建状态栏。

### 5. 状态栏重建模式

- 将所有 `StatusBarItem` 的 `Disposable` 放在一个数组中
- 重建时先 dispose 所有旧项，清空数组，再创建新项
- 这样保证状态栏始终反映最新配置和提示词数据

### 6. 分组内部优先级

保持分组内相对顺序一致：火箭图标 → 新建聊天按钮 → 提示词按钮

- 火箭图标: `basePriority + 1`
- 新建聊天: `basePriority + 0.5`
- 提示词按钮: `basePriority`

这样无论左对齐还是右对齐，分组内视觉顺序保持一致。
