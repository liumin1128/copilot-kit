import * as vscode from "vscode";
import {
  QuickPromptsProvider,
  PromptItem,
  STORAGE_KEY,
  DEFAULT_PROMPTS,
} from "./quickPromptsProvider";

export function activate(context: vscode.ExtensionContext) {
  // 注册 Webview View Provider（传入 globalState 用于持久化）
  const provider = new QuickPromptsProvider(
    context.extensionUri,
    context.globalState,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "copilotQuickPrompts.main",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      },
    ),
  );

  // 注册发送提示词的命令
  const sendPromptCommand = vscode.commands.registerCommand(
    "copilotQuickPrompts.sendPrompt",
    async (promptText: string, mode: "direct" | "write" = "write") => {
      await sendToCopilotChat(promptText, mode);
    },
  );
  context.subscriptions.push(sendPromptCommand);

  // 注册快捷选择面板命令（聊天标题栏按钮会触发这个）
  const quickPickCommand = vscode.commands.registerCommand(
    "copilotQuickPrompts.showQuickPick",
    async () => {
      const prompts = loadPrompts(context.globalState);
      const items = prompts.map((p) => ({
        label: `${p.icon} ${p.label}`,
        description: p.mode === "direct" ? "⚡ 直接执行" : "✍️ 写入输入框",
        detail: p.prompt,
        id: p.id,
        prompt: p.prompt,
        mode: p.mode,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "选择要触发的快捷提示词…",
        title: "Copilot 快捷提示词",
      });

      if (selected) {
        await sendToCopilotChat(selected.prompt, selected.mode);
      }
    },
  );
  context.subscriptions.push(quickPickCommand);

  // 创建状态栏快捷按钮
  createStatusBarItems(context);
}

/** 创建状态栏快捷按钮（每个预设提示词一个图标按钮） */
function createStatusBarItems(context: vscode.ExtensionContext): void {
  const prompts = loadPrompts(context.globalState);

  // 添加一个分组标签
  const label = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    -101,
  );
  label.text = "$(rocket)";
  label.name = "快捷提示";
  label.tooltip = "Copilot 快捷提示词";
  label.show();
  context.subscriptions.push(label);

  prompts.forEach((item) => {
    const statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      -100,
    );
    statusBar.name = `快捷提示: ${item.label}`;
    statusBar.text = `${item.icon}`;
    statusBar.tooltip = new vscode.MarkdownString(
      `**${item.label}**  \n$(triangle-right) ${item.mode === "direct" ? "⚡ 直接执行" : "✍️ 写入输入框"}  \n$(triangle-right) 点击触发`,
    );
    statusBar.command = {
      command: "copilotQuickPrompts.sendPrompt",
      title: "发送提示词",
      arguments: [item.prompt, item.mode],
    };
    statusBar.show();
    context.subscriptions.push(statusBar);
  });
}

/** 从全局存储加载提示词列表 */
function loadPrompts(storage: vscode.Memento): PromptItem[] {
  const saved = storage.get<string>(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as PromptItem[];
    } catch {
      // ignore
    }
  }
  return DEFAULT_PROMPTS.map((p) => ({ ...p }));
}

/**
 * 将提示词发送到 Copilot 聊天
 * @param mode 'direct' - 直接执行（自动发送）| 'write' - 写入输入框（等待确认）
 */
async function sendToCopilotChat(
  promptText: string,
  mode: "direct" | "write",
): Promise<void> {
  try {
    if (mode === "direct") {
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: promptText,
      });
    } else {
      await vscode.env.clipboard.writeText(promptText);
      await vscode.commands.executeCommand("workbench.action.chat.open");
      await new Promise((r) => setTimeout(r, 100));
      await vscode.commands.executeCommand(
        "editor.action.clipboardPasteAction",
      );
    }
  } catch {
    await vscode.env.clipboard.writeText(promptText);
    vscode.window.showInformationMessage("📋 提示词已复制到剪贴板");
  }
}

export function deactivate() {}
