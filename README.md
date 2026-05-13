# Copilot Quick Prompts 🚀

One-click quick prompt buttons for VS Code Copilot Chat — eliminate repetitive typing of common prompts.

## Overview

Provides customizable quick prompt buttons in the **status bar** and **sidebar panel** with the following core capabilities:

### 🔘 Dual Entry Points

- **Status Bar Buttons**: One-click prompt trigger, always visible
- **Sidebar Panel**: Full prompt management interface with CRUD operations

### 🎯 Two Execution Modes

| Mode | Description |
|------|-------------|
| **Write to Input** | Writes the prompt to Copilot Chat input box, send after confirmation |
| **Direct Execute** | Executes the prompt directly, auto-sends to Copilot Chat |

### 🖱 Interaction

| Action | Behavior |
|--------|----------|
| Left click | Sends prompt according to configured mode |
| Right click | Sends prompt with currently selected code in editor |
| Built-in button click | Triggers corresponding command directly |

### 📦 Built-in Shortcuts

| Button | Function |
|--------|----------|
| 💬 **New Chat Tab** | Smart chat: creates chat editor if no tab exists, splits right if a tab exists |
| ❌ **Close All Tabs** | Closes all editor tabs and Copilot sidebar |

### ⚙️ Custom Prompts

Manage your prompt list directly via the sidebar panel:

- **Add**: Click the `+ Add Shortcut` button at the bottom
- **Edit**: Click the edit icon next to a prompt to modify label, icon, display mode, prompt content, and execution mode
- **Delete**: Click the Delete button in the edit modal, confirmed twice before deletion
- **Reorder**: Adjust prompt order using up/down arrows
- **Show/Hide**: Control visibility in the status bar via the eye icon

Each custom prompt supports the following properties:

| Property | Description |
|----------|-------------|
| `label` | Button display label |
| `icon` | Button icon (supports VS Code Codicon library with search filtering) |
| `prompt` | Prompt content sent to Copilot |
| `displayMode` | Display mode: `icon` (icon only), `text` (text only), `both` (icon + text) |
| `mode` | Execution mode: `write` (write to input), `direct` (execute directly) |

### 📊 Status Bar Display Modes

Three display modes are supported, configurable per button in the edit modal:

- **Icon Only** — Displays only the icon, compact and clean
- **Text Only** — Displays only the text label
- **Icon + Text** — Displays both icon and label

### 📐 Status Bar Position

Adjust the position of buttons in the status bar via the VS Code setting `copilotQuickPrompts.statusBarPosition`:

| Value | Alignment | Priority |
|-------|-----------|----------|
| `leftLeft` | Left side | High priority (near left edge) |
| `leftRight` | Left side | Low priority (near center-left) |
| `rightLeft` | Right side | Low priority (near center-right) |
| `rightRight` | Right side | High priority (near right edge) |

## Installation

### From Source

```bash
git clone <repo-url>
cd copilot-quick-prompts
npm install
npm run compile
```

Then run `Extensions: Install from VSIX...` in VS Code or copy to the extensions directory.

### Development Mode

```bash
npm run watch    # Watch TypeScript changes and auto-compile
```

Press `F5` to launch the Extension Development Host for debugging.

## Configuration

### VS Code Settings

Open VS Code settings (`Cmd+,`), search for `Copilot Quick Prompts`, or directly edit `settings.json`:

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

## Tech Stack

- **Language**: TypeScript
- **Platform**: VS Code Extension API (v1.93+)
- **Build**: TypeScript Compiler (tsc)
- **UI Framework**: Native Webview + VS Code Codicon library
- **Zero Third-party Dependencies**: Purely VS Code API implementation

## Commands

| Command | Description |
|---------|-------------|
| `copilotQuickPrompts.sendPrompt` | Send prompt to Copilot Chat |
| `copilotQuickPrompts.smartChatAction` | Smart chat operation |
| `copilotQuickPrompts.closeAll` | Close all tabs and sidebar |

## Project Structure

```
copilot-quick-prompts/
├── package.json              # Extension manifest and configuration
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── extension.ts          # Extension entry: status bar, command registration
│   └── quickPromptsProvider.ts # Webview Provider + prompt management logic
├── media/                    # Static assets (reserved)
├── learnings/                # Development learning notes
└── skills-lock.json          # Skills lock file
```

## License

MIT
