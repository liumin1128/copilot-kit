# Copilot Quick Prompts 🚀

为 VS Code Copilot Chat 提供一键快捷提示词按钮，避免重复输入常用提示词。

## 功能概述

在 **状态栏** 和 **侧边栏面板** 中提供可自定义的快捷提示词按钮，支持以下核心能力：

### 🔘 双入口操作

- **状态栏按钮**：一键触发提示词，始终可见
- **侧边栏面板**：完整的提示词管理界面，支持增删改查

### 🎯 两种执行模式

| 模式 | 说明 |
|------|------|
| **Write to Input** | 将提示词写入 Copilot Chat 输入框，确认后发送 |
| **Direct Execute** | 直接执行提示词，自动发送到 Copilot Chat |

### 🖱 交互方式

| 操作 | 行为 |
|------|------|
| 左键点击 | 按配置模式发送提示词 |
| 右键点击 | 附带当前编辑器中选中的代码一起发送 |
| 内置按钮点击 | 直接触发对应命令 |

### 📦 内置快捷按钮

| 按钮 | 功能 |
|------|------|
| 💬 **New Chat Tab** | 智能聊天：无标签页时创建聊天编辑器，有标签页时向右拆分 |
| ❌ **Close All Tabs** | 关闭所有编辑器标签页和 Copilot 侧边栏 |

### ⚙️ 自定义提示词

通过侧边栏面板可直接管理提示词列表：

- **新增**：点击底部 `+ Add Shortcut` 按钮
- **编辑**：点击提示词右侧编辑图标，可修改标签、图标、显示模式、提示内容、执行模式
- **删除**：编辑弹窗中点击 Delete 按钮，二次确认后删除
- **排序**：通过上下箭头调整提示词顺序
- **显示/隐藏**：通过眼睛图标控制是否在状态栏显示

每个自定义提示词支持以下属性：

| 属性 | 说明 |
|------|------|
| `label` | 按钮显示标签 |
| `icon` | 按钮图标（支持 VS Code Codicon 图标库，带搜索过滤） |
| `prompt` | 发送给 Copilot 的提示内容 |
| `displayMode` | 显示模式：`icon`（仅图标）、`text`（仅文本）、`both`（图标+文本） |
| `mode` | 执行模式：`write`（写入输入框）、`direct`（直接执行） |

### 📊 状态栏按钮显示模式

支持三种显示模式，可在编辑弹窗中为每个按钮独立设置：

- **Icon Only** — 仅显示图标，简洁紧凑
- **Text Only** — 仅显示文本标签
- **Icon + Text** — 同时显示图标和标签

### 📐 状态栏位置配置

通过 VS Code 设置 `copilotQuickPrompts.statusBarPosition` 可调整按钮在状态栏中的位置：

| 配置值 | 对齐方式 | 优先级 |
|--------|----------|--------|
| `leftLeft` | 左侧 | 高优先级（靠左边缘） |
| `leftRight` | 左侧 | 低优先级（靠左中） |
| `rightLeft` | 右侧 | 低优先级（靠右中） |
| `rightRight` | 右侧 | 高优先级（靠右边缘） |

## 安装

### 从源码安装

```bash
git clone <repo-url>
cd copilot-quick-prompts
npm install
npm run compile
```

然后在 VS Code 中运行 `Extensions: Install from VSIX...` 或复制到扩展目录。

### 开发模式

```bash
npm run watch    # 监听 TypeScript 变更自动编译
```

按 `F5` 启动 Extension Development Host 进行调试。

## 配置

### VS Code 设置

打开 VS Code 设置（`Cmd+,`），搜索 `Copilot Quick Prompts`，或直接编辑 `settings.json`：

```json
{
  "copilotQuickPrompts.statusBarPosition": "leftRight",
  "copilotQuickPrompts.prompts": [
    {
      "id": "custom-review",
      "icon": "code-review",
      "label": "Code Review",
      "prompt": "Please review the following code and identify potential issues...",
      "color": "#4fc3f7",
      "mode": "write",
      "displayMode": "icon"
    }
  ]
}
```

## 技术栈

- **语言**：TypeScript
- **平台**：VS Code Extension API (v1.93+)
- **构建**：TypeScript Compiler (tsc)
- **UI 框架**：原生 Webview + VS Code Codicon 图标库
- **无第三方依赖**：纯 VS Code API 实现

## 命令

| 命令 | 说明 |
|------|------|
| `copilotQuickPrompts.sendPrompt` | 发送提示词到 Copilot Chat |
| `copilotQuickPrompts.smartChatAction` | 智能聊天操作 |
| `copilotQuickPrompts.closeAll` | 关闭所有标签页和侧边栏 |

## 项目结构

```
copilot-quick-prompts/
├── package.json              # 扩展清单和配置
├── tsconfig.json             # TypeScript 配置
├── src/
│   ├── extension.ts          # 扩展入口：状态栏、命令注册
│   └── quickPromptsProvider.ts # Webview Provider + 提示词管理逻辑
├── media/                    # 静态资源（预留）
├── learnings/                # 开发学习记录
└── skills-lock.json          # 技能锁定文件
```

## 许可

MIT
