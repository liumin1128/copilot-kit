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

  // 注册打开新聊天标签页的命令
  const openNewChatTabCommand = vscode.commands.registerCommand(
    "copilotQuickPrompts.openNewChatTab",
    async () => {
      await openNewChatTab();
    },
  );
  context.subscriptions.push(openNewChatTabCommand);

  // 创建状态栏快捷按钮，并监听 provider 变更事件
  const statusBarDisposables: vscode.Disposable[] = [];
  createStatusBarItems(context.globalState, statusBarDisposables);
  context.subscriptions.push(
    provider.onDidChangePrompts(() => {
      createStatusBarItems(context.globalState, statusBarDisposables);
    }),
  );
}

/** 创建状态栏快捷按钮（每个预设提示词一个图标按钮） */
function createStatusBarItems(
  storage: vscode.Memento,
  disposables: vscode.Disposable[],
): void {
  // 先释放旧的按钮
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;

  const prompts = loadPrompts(storage);

  // 添加一个分组标签（放在最左边）
  const label = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  label.text = "$(rocket)";
  label.name = "快捷提示";
  label.tooltip = "Copilot 快捷提示词";
  label.show();
  disposables.push(label);

  // 新增聊天标签页按钮
  const newChatTabBtn = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99.5,
  );
  newChatTabBtn.text = "$(plus)";
  newChatTabBtn.name = "新建聊天标签页";
  newChatTabBtn.tooltip = "新建聊天标签页（向右拆分编辑器）";
  newChatTabBtn.command = {
    command: "copilotQuickPrompts.openNewChatTab",
    title: "新建聊天标签页",
  };
  newChatTabBtn.show();
  disposables.push(newChatTabBtn);

  prompts.forEach((item) => {
    const statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99,
    );
    statusBar.name = `快捷提示: ${item.label}`;
    statusBar.text = `$(${item.icon})`;
    statusBar.tooltip = new vscode.MarkdownString(
      `**${item.label}**  \n$(triangle-right) ${item.mode === "direct" ? "$(play) 直接执行" : "$(edit) 写入输入框"}  \n$(triangle-right) 点击触发`,
    );
    statusBar.command = {
      command: "copilotQuickPrompts.sendPrompt",
      title: "发送提示词",
      arguments: [item.prompt, item.mode],
    };
    statusBar.show();
    disposables.push(statusBar);
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
    vscode.window.showInformationMessage("提示词已复制到剪贴板");
  }
}

/**
 * 打开一个新的聊天标签页（在编辑器区域，而非侧边栏）
 * - 当前有标签页时：向右拆分编辑器，在新组中打开聊天
 * - 当前无标签页时：直接在当前组打开聊天（避免产生空白标签页）
 */
async function openNewChatTab(): Promise<void> {
  try {
    const hasTabs = vscode.window.tabGroups.activeTabGroup.tabs.length > 0;

    if (hasTabs) {
      // 已有标签页 → 向右拆分，在新组中打开聊天
      await vscode.commands.executeCommand("workbench.action.splitEditorRight");
      await vscode.commands.executeCommand("workbench.action.openChat");
    } else {
      // 无标签页 → 直接在当前组打开聊天（避免产生空白 untitled 标签页）
      await vscode.commands.executeCommand("workbench.action.openChat");
    }
  } catch {
    await vscode.commands.executeCommand("workbench.action.openChat");
  }
}

export function deactivate() {}
