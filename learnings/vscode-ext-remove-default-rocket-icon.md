# VS Code 扩展：删除默认火箭图标

## 背景

之前状态栏默认有一个火箭图标(`$(rocket)`)，仅作为分组标识，无任何点击功能。用户要求删除。

## 改动要点

1. **`extension.ts`**: 
   - 删除 `rocketPri`、`btnPri` 双优先级逻辑，统一用 `basePriority`
   - 删除火箭 `StatusBarItem` 的创建代码
   - 移除 `buttonsBeforeRocket` 解构（已从 `getPositionConfig` 移除）

2. **`quickPromptsProvider.ts`**:
   - `getPositionConfig()` 返回类型移除 `buttonsBeforeRocket` 字段
   - 各 case 分支移除 `buttonsBeforeRocket` 返回值

3. **`package.json`**:
   - `enumDescriptions` 文案移除对火箭的引用

## 经验

- 状态栏分组标识图标若没有点击事件，纯属视觉冗余，应考虑删除
- `buttonsBeforeRocket` 这类仅用于协调火箭位置的配置项，删除火箭后一并清理
