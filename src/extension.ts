import * as vscode from "vscode";
import {
  QuickPromptsProvider,
  PromptItem,
  STORAGE_KEY,
  DEFAULT_PROMPTS,
  DEFAULT_PROMPT_IDS,
  CONFIG_KEY,
  StatusBarPosition,
  getPositionConfig,
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

  // 注册智能聊天操作命令（无聊天标签→创建，有聊天标签→拆分）
  const smartChatCommand = vscode.commands.registerCommand(
    "copilotQuickPrompts.smartChatAction",
    async () => {
      await smartChatAction();
    },
  );
  context.subscriptions.push(smartChatCommand);

  // 注册关闭所有标签页命令
  const closeAllCommand = vscode.commands.registerCommand(
    "copilotQuickPrompts.closeAll",
    async () => {
      await closeAllTabs();
    },
  );
  context.subscriptions.push(closeAllCommand);

  // 初始化状态栏
  const statusBarDisposables: vscode.Disposable[] = [];
  const rebuildStatusBar = () =>
    createStatusBarItems(context, statusBarDisposables);
  rebuildStatusBar();

  // 监听配置变更自动刷新状态栏
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_KEY)) {
        rebuildStatusBar();
      }
    }),
  );

  // 监听提示词数据变更（侧边栏编辑 icon、label 等），自动刷新状态栏
  context.subscriptions.push(
    provider.onDidChangePrompts(() => {
      rebuildStatusBar();
    }),
  );
}

/** 创建状态栏快捷按钮 */
function createStatusBarItems(
  context: vscode.ExtensionContext,
  disposables: vscode.Disposable[],
): void {
  // 先释放旧的按钮
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;

  const prompts = loadPrompts(context.globalState);
  const { alignment, basePriority } = getPositionConfig();

  // 特殊按钮（放在自定义按钮左侧）
  const chatBtn = vscode.window.createStatusBarItem(alignment, basePriority);
  chatBtn.name = "智能聊天";
  chatBtn.text = "$(comment-discussion)";
  chatBtn.tooltip = "创建聊天标签页 / 向右拆分编辑器";
  chatBtn.command = "copilotQuickPrompts.smartChatAction";
  chatBtn.show();
  disposables.push(chatBtn);

  const closeAllBtn = vscode.window.createStatusBarItem(
    alignment,
    basePriority,
  );
  closeAllBtn.name = "关闭所有";
  closeAllBtn.text = "$(close-all)";
  closeAllBtn.tooltip = "关闭所有标签页和 Copilot 侧边栏";
  closeAllBtn.command = "copilotQuickPrompts.closeAll";
  closeAllBtn.show();
  disposables.push(closeAllBtn);

  // 自定义按钮（排除隐藏项）
  for (const item of prompts) {
    if (item.hidden) continue;
    const statusBar = createPromptButton(item, alignment, basePriority);
    disposables.push(statusBar);
  }
}

/** 创建单个提示词状态栏按钮 */
function createPromptButton(
  item: PromptItem,
  alignment: vscode.StatusBarAlignment,
  priority: number,
): vscode.StatusBarItem {
  const statusBar = vscode.window.createStatusBarItem(alignment, priority);
  statusBar.name = `快捷提示: ${item.label}`;

  if (item.displayMode === "text") {
    statusBar.text = item.label;
  } else if (item.displayMode === "both") {
    statusBar.text = `$(${item.icon}) ${item.label}`;
  } else {
    statusBar.text = `$(${item.icon})`;
  }

  const modeLabel =
    item.mode === "direct" ? "$(play) 直接执行" : "$(edit) 写入输入框";
  statusBar.tooltip = new vscode.MarkdownString(
    `**${item.label}**  \n$(triangle-right) ${modeLabel}  \n$(triangle-right) 点击触发`,
  );
  statusBar.command = {
    command: "copilotQuickPrompts.sendPrompt",
    title: "发送提示词",
    arguments: [item.prompt, item.mode],
  };
  statusBar.show();
  return statusBar;
}

/** 从全局存储加载提示词列表 */
function loadPrompts(storage: vscode.Memento): PromptItem[] {
  const saved = storage.get<string>(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as PromptItem[];
      return parsed
        .filter((p) => !DEFAULT_PROMPT_IDS.has(p.id))
        .map((p) => ({ ...p, displayMode: p.displayMode || "icon" }));
    } catch {
      // ignore
    }
  }
  return DEFAULT_PROMPTS.slice();
}

/**
 * 将提示词发送到 Copilot 聊天
 * @param mode 'direct' - 直接执行（自动发送）| 'write' - 写入输入框（等待确认）
 */
async function sendToCopilotChat(
  promptText: string,
  mode: "direct" | "write",
): Promise<void> {
  if (mode === "direct") {
    await vscode.commands.executeCommand("workbench.action.chat.open", {
      query: promptText,
    });
    return;
  }

  try {
    await vscode.env.clipboard.writeText(promptText);
    await vscode.commands.executeCommand("workbench.action.chat.open");
    await new Promise((r) => setTimeout(r, 100));
    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
  } catch {
    await vscode.env.clipboard.writeText(promptText);
    vscode.window.showInformationMessage("提示词已复制到剪贴板");
  }
}

/** 检测是否存在任何编辑器标签页 */
function hasAnyTab(): boolean {
  return vscode.window.tabGroups.all.some((group) => group.tabs.length > 0);
}

/** 智能聊天操作：无标签页→创建聊天编辑器标签页，有标签页→向右拆分 */
async function smartChatAction(): Promise<void> {
  if (hasAnyTab()) {
    await vscode.commands.executeCommand("workbench.action.splitEditorRight");
  } else {
    await vscode.commands.executeCommand("workbench.action.chat.openInEditor");
  }
}

/** 关闭所有标签页和 Copilot 侧边栏 */
async function closeAllTabs(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
}

export function deactivate() {}
