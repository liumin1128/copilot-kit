# VSCode 扩展 UI 国际化：中文→英文转换

## 场景
将 VSCode 扩展项目中的所有中文 UI 字符串替换为英文，实现全英文展示。

## 需要替换的位置

### 1. `package.json`
- `description` — 扩展描述
- `configuration.properties.*.enumDescriptions` — 配置项的枚举描述
- `configuration.properties.*.description` — 配置项描述
- `viewsContainers.activitybar[].title` — 活动栏容器标题
- `views.*[].name` — 视图名称
- `commands[].title` — 命令标题

### 2. `extension.ts`（用户可见字符串）
- `statusBar.name` — 状态栏项名称
- `statusBar.tooltip` — 状态栏工具提示（含 MarkdownString）
- `statusBar.command.title` — 命令显示标题
- `window.showInformationMessage` — 信息提示消息

### 3. `quickPromptsProvider.ts`
- `BUILT_IN_PROMPTS` 中的 `label` — 内置按钮显示名称
- HTML `lang` 属性
- HTML 中所有可见文本（标题、按钮、标签、占位符、提示文字）
- 内联 JS 中的 toast 消息、按钮 title、label-meta 文字
- 模态框标题、表单标签、按钮文字

## 注意事项
- 代码注释（JSDoc、普通注释）不属于 UI，无需翻译
- 状态栏 tooltip 使用了 `MarkdownString`，需一并替换其中的中文片段
- JS 模板字符串中的三元表达式中文需替换（如 `p.builtIn ? '内置' : '直接'`）
- Toast 消息是用户频繁看到的 UI，必须全部替换
- 使用 `multi_replace_string_in_file` 可批量替换，但需注意重复字符串需单独用上下文区分
