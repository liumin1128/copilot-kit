import * as vscode from "vscode";
import {
  QuickPromptsProvider,
  PromptItem,
  DEFAULT_PROMPT_IDS,
  BUILT_IN_PROMPTS,
  CONFIG_KEY,
  PROMPTS_CONFIG_KEY,
  StatusBarPosition,
  getPositionConfig,
} from "./quickPromptsProvider";

export function activate(context: vscode.ExtensionContext) {
  // 注册 Webview View Provider
  const provider = new QuickPromptsProvider(context.extensionUri);
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
      if (
        e.affectsConfiguration(CONFIG_KEY) ||
        e.affectsConfiguration(PROMPTS_CONFIG_KEY)
      ) {
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

  const prompts = loadPrompts();
  const { alignment, basePriority } = getPositionConfig();

  // 统一遍历所有项（内置项 + 自定义项），跳过隐藏项
  for (const item of prompts) {
    if (item.hidden) continue;
    const statusBar = createPromptButton(item, alignment, basePriority);
    disposables.push(statusBar);
  }
}

/** 内置项 → 命令 ID 映射 */
function getBuiltInCommand(item: PromptItem): string | undefined {
  if (item.id === "builtin:smartChat")
    return "copilotQuickPrompts.smartChatAction";
  if (item.id === "builtin:closeAll") return "copilotQuickPrompts.closeAll";
  return undefined;
}

/** 创建单个提示词状态栏按钮 */
function createPromptButton(
  item: PromptItem,
  alignment: vscode.StatusBarAlignment,
  priority: number,
): vscode.StatusBarItem {
  const statusBar = vscode.window.createStatusBarItem(alignment, priority);
  statusBar.name = `Quick Prompt: ${item.label}`;

  if (item.displayMode === "text") {
    statusBar.text = item.label;
  } else if (item.displayMode === "both") {
    statusBar.text = `$(${item.icon}) ${item.label}`;
  } else {
    statusBar.text = `$(${item.icon})`;
  }

  if (item.builtIn) {
    // 内置项：直接绑定命令
    const cmd = getBuiltInCommand(item);
    statusBar.tooltip = item.label;
    if (cmd) {
      statusBar.command = cmd;
    }
  } else {
    // 自定义项：发送提示词
    const modeLabel =
      item.mode === "direct"
        ? "$(play) Direct Execute"
        : "$(edit) Write to Input";
    statusBar.tooltip = new vscode.MarkdownString(
      `**${item.label}**  \n$(triangle-right) ${modeLabel}  \n$(triangle-right) Click to trigger`,
    );
    statusBar.command = {
      command: "copilotQuickPrompts.sendPrompt",
      title: "Send Prompt",
      arguments: [item.prompt, item.mode],
    };
  }
  statusBar.show();
  return statusBar;
}

/** 从 VS Code 配置加载提示词列表，保持存储中的顺序 */
function loadPrompts(): PromptItem[] {
  const saved = vscode.workspace
    .getConfiguration()
    .get<PromptItem[]>(PROMPTS_CONFIG_KEY, []);
  let allItems = saved
    .filter((p) => !DEFAULT_PROMPT_IDS.has(p.id))
    .map((p) => ({ ...p, displayMode: p.displayMode || "icon" }));

  // 确保内置项存在于列表中（首次加载时补充）
  const existingIds = new Set(allItems.map((p) => p.id));
  for (const builtIn of BUILT_IN_PROMPTS) {
    if (!existingIds.has(builtIn.id)) {
      allItems.push({ ...builtIn });
    }
  }

  return allItems;
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
    vscode.window.showInformationMessage("Prompt copied to clipboard");
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
