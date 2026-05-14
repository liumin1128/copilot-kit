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
  // Register Webview View Provider
  const provider = new QuickPromptsProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("copilotKit.main", provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // Register send prompt command
  const sendPromptCommand = vscode.commands.registerCommand(
    "copilotKit.sendPrompt",
    async (promptText: string, mode: "direct" | "write" = "write") => {
      await sendToCopilotChat(promptText, mode);
    },
  );
  context.subscriptions.push(sendPromptCommand);

  // Register smart chat command (no tab → create, has tab → split)
  const smartChatCommand = vscode.commands.registerCommand(
    "copilotKit.smartChatAction",
    async () => {
      await smartChatAction();
    },
  );
  context.subscriptions.push(smartChatCommand);

  // Register close all tabs command
  const closeAllCommand = vscode.commands.registerCommand(
    "copilotKit.closeAll",
    async () => {
      await closeAllTabs();
    },
  );
  context.subscriptions.push(closeAllCommand);

  // Register layout chat tabs command
  const layoutChatCommand = vscode.commands.registerCommand(
    "copilotKit.layoutChatTabs",
    async () => {
      await layoutChatTabs();
    },
  );
  context.subscriptions.push(layoutChatCommand);

  // Initialize status bar
  const statusBarDisposables: vscode.Disposable[] = [];
  const rebuildStatusBar = () =>
    createStatusBarItems(context, statusBarDisposables);
  rebuildStatusBar();

  // Listen for config changes to auto-refresh status bar
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

  // Listen for prompt data changes (sidebar edit icon, label, etc.), auto-refresh status bar
  context.subscriptions.push(
    provider.onDidChangePrompts(() => {
      rebuildStatusBar();
    }),
  );
}

/** Create status bar quick buttons */
function createStatusBarItems(
  context: vscode.ExtensionContext,
  disposables: vscode.Disposable[],
): void {
  // Dispose old buttons first
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;

  const prompts = loadPrompts();
  const { alignment, basePriority } = getPositionConfig();

  // Iterate all items (built-in + custom), skip hidden items
  for (const item of prompts) {
    if (item.hidden) continue;
    const statusBar = createPromptButton(item, alignment, basePriority);
    disposables.push(statusBar);
  }
}

/** Built-in item → command ID mapping */
function getBuiltInCommand(item: PromptItem): string | undefined {
  if (item.id === "builtin:smartChat") return "copilotKit.smartChatAction";
  if (item.id === "builtin:layoutChat") return "copilotKit.layoutChatTabs";
  if (item.id === "builtin:closeAll") return "copilotKit.closeAll";
  return undefined;
}

/** Create a single prompt status bar button */
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
    // Built-in: bind command directly
    const cmd = getBuiltInCommand(item);
    statusBar.tooltip = item.label;
    if (cmd) {
      statusBar.command = cmd;
    }
  } else {
    // Custom: send prompt
    const modeLabel =
      item.mode === "direct"
        ? "$(play) Direct Execute"
        : "$(edit) Write to Input";
    statusBar.tooltip = new vscode.MarkdownString(
      `**${item.label}**  \n$(triangle-right) ${modeLabel}  \n$(triangle-right) Click to trigger`,
    );
    statusBar.command = {
      command: "copilotKit.sendPrompt",
      title: "Send Prompt",
      arguments: [item.prompt, item.mode],
    };
  }
  statusBar.show();
  return statusBar;
}

/** Load prompt list from VS Code config, preserving storage order */
function loadPrompts(): PromptItem[] {
  const saved = vscode.workspace
    .getConfiguration()
    .get<PromptItem[]>(PROMPTS_CONFIG_KEY, []);
  let allItems = saved
    .filter((p) => !DEFAULT_PROMPT_IDS.has(p.id))
    .map((p) => ({ ...p, displayMode: p.displayMode || "icon" }));

  // Ensure built-in items exist in list (supplement on first load)
  const existingIds = new Set(allItems.map((p) => p.id));
  for (const builtIn of BUILT_IN_PROMPTS) {
    if (!existingIds.has(builtIn.id)) {
      allItems.push({ ...builtIn });
    }
  }

  return allItems;
}

/**
 * Send prompt to Copilot Chat
 * @param mode 'direct' - execute directly (auto-send) | 'write' - write to input (wait for confirmation)
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

/** Check if any editor tabs exist */
function hasAnyTab(): boolean {
  return vscode.window.tabGroups.all.some((group) => group.tabs.length > 0);
}

/** Smart chat action: no tab → create chat editor tab, has tab → split right */
async function smartChatAction(): Promise<void> {
  if (hasAnyTab()) {
    await vscode.commands.executeCommand("workbench.action.splitEditorRight");
  } else {
    await vscode.commands.executeCommand("workbench.action.chat.openInEditor");
  }
}

/** Close all tabs and Copilot sidebar */
async function closeAllTabs(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
}

/**
 * Evenly distribute all editor groups to equal sizes
 *
 * Uses VS Code's built-in evenEditorWidths command which reliably
 * distributes all editor groups to equal proportions.
 */
async function layoutChatTabs(): Promise<void> {
  const groups = vscode.window.tabGroups.all;
  if (groups.length <= 1) {
    vscode.window.showInformationMessage("No editor groups to layout");
    return;
  }

  await vscode.commands.executeCommand("workbench.action.evenEditorWidths");
}

export function deactivate() {}
