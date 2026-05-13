import * as vscode from "vscode";

/** 状态栏位置配置 */
export type StatusBarPosition =
  | "leftLeft"
  | "leftRight"
  | "rightLeft"
  | "rightRight";

export const CONFIG_KEY = "copilotQuickPrompts.statusBarPosition";

/**
 * 根据配置获取状态栏对齐方式和优先级
 * @returns alignment - 对齐方向
 * @returns basePriority - 分组在状态栏上的基准位置
 */
export function getPositionConfig(): {
  alignment: vscode.StatusBarAlignment;
  basePriority: number;
} {
  const position = vscode.workspace
    .getConfiguration()
    .get<StatusBarPosition>(CONFIG_KEY, "leftRight");

  switch (position) {
    case "leftLeft":
      return { alignment: vscode.StatusBarAlignment.Left, basePriority: 200 };
    case "leftRight":
      return { alignment: vscode.StatusBarAlignment.Left, basePriority: 50 };
    case "rightLeft":
      return { alignment: vscode.StatusBarAlignment.Right, basePriority: 50 };
    case "rightRight":
      return { alignment: vscode.StatusBarAlignment.Right, basePriority: 200 };
  }
}

/** 预设提示词定义 */
export interface PromptItem {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  color: string;
  mode: "direct" | "write";
  displayMode: "icon" | "text" | "both";
  hidden?: boolean;
  /** 是否为内置项（智能聊天、关闭所有），内置项不可编辑 */
  builtIn?: boolean;
}

/** 内置特殊按钮定义 */
export const BUILT_IN_PROMPTS: PromptItem[] = [
  {
    id: "builtin:smartChat",
    icon: "comment-discussion",
    label: "智能聊天",
    prompt: "",
    color: "#4fc3f7",
    mode: "direct",
    displayMode: "icon",
    builtIn: true,
  },
  {
    id: "builtin:closeAll",
    icon: "close-all",
    label: "关闭所有",
    prompt: "",
    color: "#e53935",
    mode: "direct",
    displayMode: "icon",
    builtIn: true,
  },
];

export const STORAGE_KEY = "copilotQuickPrompts.prompts";

/** 预设默认提示词的 ID 列表，用于迁移时过滤掉旧数据中的默认项 */
export const DEFAULT_PROMPT_IDS = new Set([
  "review",
  "explain",
  "test",
  "optimize",
  "docs",
  "refactor",
]);

/** 默认预设提示词列表（已清空，只保留用户新建的） */
export const DEFAULT_PROMPTS: PromptItem[] = [];

export class QuickPromptsProvider implements vscode.WebviewViewProvider {
  private prompts: PromptItem[];
  private webviewView?: vscode.WebviewView;
  private _configListener: vscode.Disposable | undefined;

  /** 提示词变更事件（用于通知 extension 刷新状态栏等） */
  private _onDidChangePrompts = new vscode.EventEmitter<void>();
  readonly onDidChangePrompts: vscode.Event<void> =
    this._onDidChangePrompts.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: vscode.Memento,
  ) {
    this.prompts = this.loadPrompts();
  }

  /** 从全局存储加载提示词，保持存储中的顺序 */
  private loadPrompts(): PromptItem[] {
    const saved = this.storage.get<string>(STORAGE_KEY);
    let allItems: PromptItem[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PromptItem[];
        allItems = parsed
          .filter((p) => !DEFAULT_PROMPT_IDS.has(p.id))
          .map((p) => ({ ...p, displayMode: p.displayMode || "icon" }));
      } catch {
        // ignore
      }
    }

    // 确保内置项存在于列表中（首次加载时补充）
    const existingIds = new Set(allItems.map((p) => p.id));
    for (const builtIn of BUILT_IN_PROMPTS) {
      if (!existingIds.has(builtIn.id)) {
        allItems.push({ ...builtIn });
      }
    }

    return allItems;
  }

  /** 保存提示词到全局存储 */
  private savePrompts(): void {
    this.storage.update(STORAGE_KEY, JSON.stringify(this.prompts));
  }

  /** 向 webview 发送更新后的数据 */
  private postState(): void {
    const position = vscode.workspace
      .getConfiguration()
      .get<StatusBarPosition>(CONFIG_KEY, "leftRight");
    this.webviewView?.webview.postMessage({
      type: "updateState",
      prompts: this.prompts,
      position,
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    // 监听配置变更，同步更新 webview
    webviewView.onDidDispose(() => {
      this._configListener?.dispose();
      this._configListener = undefined;
    });
    this._configListener?.dispose();
    this._configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_KEY) && this.webviewView) {
        this.postState();
      }
    });

    // 向 webview 发送初始数据
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "ready":
          // webview 就绪后发送数据
          this.postState();
          break;

        case "sendPrompt":
          await this.sendPrompt(message.prompt, message.mode ?? "write");
          break;

        case "sendPromptWithEditor":
          await this.handleSendWithEditor(
            message.prompt,
            message.mode ?? "write",
          );
          break;

        case "savePrompts":
          this.prompts = message.prompts;
          this.savePrompts();
          this.postState();
          this._onDidChangePrompts.fire();
          break;

        case "executeCommand": {
          await vscode.commands.executeCommand(message.command);
          break;
        }

        case "updatePosition": {
          await vscode.workspace
            .getConfiguration()
            .update(
              CONFIG_KEY,
              message.position,
              vscode.ConfigurationTarget.Global,
            );
          break;
        }
      }
    });
  }

  /** 发送提示词 */
  private async sendPrompt(
    prompt: string,
    mode: "direct" | "write",
  ): Promise<void> {
    await vscode.commands.executeCommand(
      "copilotQuickPrompts.sendPrompt",
      prompt,
      mode,
    );
  }

  /** 发送提示词并附加上当前编辑器选中的代码 */
  private async handleSendWithEditor(
    prompt: string,
    mode: "direct" | "write",
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    let fullPrompt = prompt;

    if (editor) {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      if (selectedText) {
        fullPrompt = `${prompt}\n\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``;
      }
    }

    await vscode.commands.executeCommand(
      "copilotQuickPrompts.sendPrompt",
      fullPrompt,
      mode,
    );
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; script-src 'unsafe-inline';">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0/dist/codicon.css" />
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --fg: var(--vscode-sideBarTitle-foreground);
      --border: var(--vscode-panel-border);
      --hover: var(--vscode-list-hoverBackground);
      --desc: var(--vscode-descriptionForeground);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border, transparent);
      --btn-primary: var(--vscode-button-background);
      --btn-primary-fg: var(--vscode-button-foreground);
      --btn-secondary: var(--vscode-button-secondaryBackground);
      --btn-secondary-fg: var(--vscode-button-secondaryForeground);
      --list-active: var(--vscode-list-activeSelectionBackground);
      --list-active-fg: var(--vscode-list-activeSelectionForeground);
      --list-inactive: var(--vscode-list-inactiveSelectionBackground);
      --list-inactive-fg: var(--vscode-list-inactiveSelectionForeground);
      --list-focus: var(--vscode-list-focusBackground);
      --list-focus-fg: var(--vscode-list-focusForeground);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: var(--fg);
      font-size: 13px;
    }
    .container { display: flex; flex-direction: column; }

    /* --- VS Code 风格标题 --- */
    .section-header {
      display: flex;
      align-items: center;
      padding: 12px 12px 4px;
      gap: 6px;
      user-select: none;
    }
    .section-header .codicon {
      font-size: 14px;
      color: var(--desc);
      flex-shrink: 0;
    }
    .section-title {
      font-size: 11px;
      color: var(--desc);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    /* --- VS Code 原生列表风格 --- */
    .prompt-list {
      padding: 2px 8px;
    }
    .prompt-card {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      gap: 8px;
      border-radius: 4px;
      cursor: default;
      transition: background 0.1s;
    }
    .prompt-card:hover {
      background: var(--hover);
    }

    /* 点击区域 */
    .prompt-body {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      min-width: 0;
      padding: 2px 0;
    }
    .prompt-body .icon {
      font-size: 16px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
    }
    .prompt-body .label {
      font-size: 13px;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--fg);
    }

    /* 编辑按钮（默认隐藏，悬停显示） */
    .action-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--desc);
      font-size: 12px;
      border-radius: 4px;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .prompt-card:hover .action-btn { display: flex; }
    .action-btn:hover { background: var(--hover); color: var(--fg); }
    .action-btn:disabled { opacity: 0.3; cursor: default; }
    .action-btn:disabled:hover { background: transparent; color: var(--desc); }

    /* 上移/下移按钮 */
    .move-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--desc);
      font-size: 11px;
      border-radius: 3px;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .prompt-card:hover .move-btn { display: flex; }
    .move-btn:hover { background: var(--hover); color: var(--fg); }
    .move-btn:disabled { opacity: 0.3; cursor: default; }
    .move-btn:disabled:hover { background: transparent; color: var(--desc); }

    /* 隐藏项样式 */
    .prompt-card.hidden-item {
      opacity: 0.4;
    }
    .prompt-card.hidden-item:hover {
      opacity: 1;
    }

    /* --- 编辑弹窗 --- */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 999;
      align-items: flex-end;
      justify-content: center;
    }
    .modal-overlay.show { display: flex; }
    .modal {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px 12px 0 0;
      padding: 16px 20px 24px;
      width: 100%;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
    }
    .modal h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .modal label {
      display: block;
      font-size: 11px;
      color: var(--desc);
      margin-bottom: 4px;
      margin-top: 10px;
    }
    .modal label:first-of-type { margin-top: 0; }
    .modal input, .modal textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--input-border);
      border-radius: 6px;
      background: var(--input-bg);
      color: var(--input-fg);
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    .modal input:focus, .modal textarea:focus {
      border-color: var(--btn-primary);
    }
    .modal textarea {
      resize: vertical;
      min-height: 80px;
    }
    .modal-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
    .modal-actions button {
      flex: 1;
      padding: 8px 0;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-cancel {
      background: var(--btn-secondary);
      color: var(--btn-secondary-fg);
    }
    .btn-save {
      background: var(--btn-primary);
      color: var(--btn-primary-fg);
    }

    .icon-option {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      color: var(--fg);
      transition: border-color 0.15s, background 0.15s;
    }
    .icon-option:hover { border-color: var(--btn-primary); background: var(--hover); }
    .icon-option.active { border-color: var(--btn-primary); background: var(--btn-primary); color: var(--btn-primary-fg); }

    .hint {
      font-size: 11px;
      color: var(--desc);
      text-align: center;
      padding: 8px 0 4px;
      opacity: 0.7;
    }

    /* --- 位置选择器 --- */
    .position-section {
      border-top: 1px solid var(--border);
      margin-top: 4px;
      padding-top: 4px;
    }
    .position-options {
      display: flex;
      gap: 4px;
    }
    .pos-btn {
      flex: 1;
      text-align: center;
      padding: 5px 2px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: transparent;
      color: var(--desc);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
      line-height: 1.3;
    }
    .pos-btn:hover {
      border-color: var(--btn-primary);
      color: var(--fg);
    }
    .pos-btn.active {
      background: var(--btn-primary);
      color: var(--btn-primary-fg);
      border-color: var(--btn-primary);
    }
    .toast {
      display: none;
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--vscode-editorWidget-foreground);
      white-space: nowrap;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toast.show { display: block; }
    /* 添加按钮 */
    .add-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 6px 8px;
      border: 1px dashed var(--border);
      border-radius: 4px;
      background: transparent;
      color: var(--desc);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .add-btn:hover {
      border-color: var(--btn-primary);
      color: var(--btn-primary-fg);
      background: var(--btn-primary);
    }

    /* 删除确认弹窗 */
    .confirm-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .confirm-overlay.show { display: flex; }
    .confirm-box {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px 24px;
      width: 280px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      text-align: center;
    }
    .confirm-box p {
      font-size: 14px;
      margin-bottom: 18px;
      line-height: 1.5;
    }
    .confirm-actions {
      display: flex;
      gap: 8px;
    }
    .confirm-actions button {
      flex: 1;
      padding: 8px 0;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-danger {
      background: #e53935;
      color: #fff;
    }
    .btn-danger:hover { background: #c62828; }
    /* 显示方式选择 */
    .display-mode-options {
      display: flex;
      gap: 4px;
      margin-top: 6px;
    }
    .mode-option {
      flex: 1;
      text-align: center;
      padding: 6px 4px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--desc);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .mode-option:hover {
      border-color: var(--btn-primary);
      color: var(--fg);
    }
    .mode-option.active {
      background: var(--btn-primary);
      color: var(--btn-primary-fg);
      border-color: var(--btn-primary);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="section-header">
      <span class="codicon codicon-sparkle"></span>
      <span class="section-title">快捷提示词</span>
    </div>
    <div class="prompt-list" id="promptList"></div>
    <div style="padding: 0 12px;">
      <button class="add-btn" id="addBtn"><span class="codicon codicon-plus"></span> 添加快捷按钮</button>
      <div class="hint">点击执行 · 右键附带代码</div>
    </div>
    <div class="position-section">
      <div class="section-title"><span class="codicon codicon-arrow-left" style="margin-right: 4px; font-size: 12px;"></span>状态栏位置</div>
      <div class="position-options" id="positionOptions">
        <button class="pos-btn" data-pos="leftLeft">左左</button>
        <button class="pos-btn" data-pos="leftRight">左右</button>
        <button class="pos-btn" data-pos="rightLeft">右左</button>
        <button class="pos-btn" data-pos="rightRight">右右</button>
      </div>
    </div>
    <div class="toast" id="toast"></div>
  </div>

  <!-- 删除确认弹窗 -->
  <div class="confirm-overlay" id="confirmOverlay">
    <div class="confirm-box">
      <p><span class="codicon codicon-trash" style="font-size: 24px; color: #e53935; display: block; margin-bottom: 8px;"></span>确定要删除该快捷按钮吗？</p>
      <div class="confirm-actions">
        <button class="btn-cancel" id="confirmCancel">取消</button>
        <button class="btn-danger" id="confirmDelete">确认删除</button>
      </div>
    </div>
  </div>

  <!-- 编辑弹窗 -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <h3 id="modalTitle">编辑提示词</h3>
      <label>标题</label>
      <input type="text" id="editLabel" placeholder="按钮显示名称" />
      <label>图标（codicon 名称）</label>
      <input type="text" id="editIcon" placeholder="输入图标名称搜索..." />
      <input type="text" id="iconFilter" placeholder="搜索图标..." style="margin-top:4px; font-size:12px; padding:4px 8px;" />
      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:6px; max-height:180px; overflow-y:auto; padding:2px 0;" id="iconSuggestions"></div>
      <label>显示方式</label>
      <div class="display-mode-options" id="displayModeOptions">
        <button class="mode-option active" data-mode="icon">仅图标</button>
        <button class="mode-option" data-mode="text">仅文本</button>
        <button class="mode-option" data-mode="both">图标+文本</button>
      </div>
      <label>提示词内容</label>
      <textarea id="editPrompt" placeholder="输入提示词..."></textarea>
      <label>执行模式</label>
      <div class="display-mode-options" id="execModeOptions">
        <button class="mode-option" data-mode="write">写入输入框</button>
        <button class="mode-option" data-mode="direct">直接执行</button>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" id="btnCancel">取消</button>
        <button class="btn-danger" id="btnDelete" style="display:none">删除</button>
        <button class="btn-save" id="btnSave">保存</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const promptList = document.getElementById('promptList');
      const toast = document.getElementById('toast');
      let toastTimer = null;

      // 删除确认弹窗元素
      const confirmOverlay = document.getElementById('confirmOverlay');
      const confirmDelete = document.getElementById('confirmDelete');
      const confirmCancel = document.getElementById('confirmCancel');
      let pendingDeleteId = null;

      // 编辑弹窗元素
      const modalOverlay = document.getElementById('modalOverlay');
      const editLabel = document.getElementById('editLabel');
      const editIcon = document.getElementById('editIcon');
      const editPrompt = document.getElementById('editPrompt');
      const modalTitle = document.getElementById('modalTitle');
      const iconSuggestions = document.getElementById('iconSuggestions');
      let editingId = null;
      let promptsCache = [];

      // 完整的 codicon 列表（自动从 codicon.css 提取，共 649 个）
      const ALL_CODICONS = [
        'account','activate-breakpoints','add','add-small','agent','alert','archive','array','arrow-both','arrow-circle-down','arrow-circle-left','arrow-circle-right','arrow-circle-up','arrow-down','arrow-left','arrow-right','arrow-small-down','arrow-small-left','arrow-small-right','arrow-small-up','arrow-swap','arrow-up','ask','attach','azure','azure-devops','beaker','beaker-stop','bell','bell-dot','bell-slash','bell-slash-dot','blank','bold','book','bookmark','bracket','bracket-dot','bracket-error','briefcase','broadcast','browser','bug','build','calendar','call-incoming','call-outgoing','case-sensitive','chat-sparkle','chat-sparkle-error','chat-sparkle-warning','check','check-all','checklist','chevron-down','chevron-left','chevron-right','chevron-up','chip','chrome-close','chrome-maximize','chrome-minimize','chrome-restore','circle','circle-filled','circle-large','circle-large-filled','circle-large-outline','circle-outline','circle-slash','circle-small','circle-small-filled','circuit-board','claude','clear-all','clippy','clock','clockface','clone','close','close-all','close-dirty','cloud','cloud-download','cloud-small','cloud-upload','code','code-oss','code-review','coffee','collapse-all','collection','collection-small','color-mode','combine','comment','comment-add','comment-discussion','comment-discussion-quote','comment-discussion-sparkle','comment-draft','comment-unresolved','compare-changes','compass','compass-active','compass-dot','console','copilot','copilot-blocked','copilot-error','copilot-in-progress','copilot-large','copilot-not-connected','copilot-snooze','copilot-success','copilot-unavailable','copilot-warning','copilot-warning-large','copy','coverage','credit-card','cursor','dash','dashboard','database','debug','debug-all','debug-alt','debug-alt-small','debug-breakpoint','debug-breakpoint-conditional','debug-breakpoint-conditional-disabled','debug-breakpoint-conditional-unverified','debug-breakpoint-data','debug-breakpoint-data-disabled','debug-breakpoint-data-unverified','debug-breakpoint-disabled','debug-breakpoint-function','debug-breakpoint-function-disabled','debug-breakpoint-function-unverified','debug-breakpoint-log','debug-breakpoint-log-disabled','debug-breakpoint-log-unverified','debug-breakpoint-unsupported','debug-breakpoint-unverified','debug-connected','debug-console','debug-continue','debug-continue-small','debug-coverage','debug-disconnect','debug-hint','debug-line-by-line','debug-pause','debug-rerun','debug-restart','debug-restart-frame','debug-reverse-continue','debug-stackframe','debug-stackframe-active','debug-stackframe-dot','debug-stackframe-focused','debug-start','debug-step-back','debug-step-into','debug-step-out','debug-step-over','debug-stop','desktop-download','device-camera','device-camera-video','device-desktop','device-mobile','diff','diff-added','diff-ignored','diff-modified','diff-multiple','diff-removed','diff-renamed','diff-sidebyside','diff-single','discard','download','edit','edit-code','edit-session','edit-sparkle','editor-layout','ellipsis','empty-window','eraser','error','error-small','exclude','expand-all','export','extensions','extensions-large','eye','eye-closed','eye-unwatch','eye-watch','feedback','file','file-add','file-binary','file-code','file-directory','file-directory-create','file-media','file-pdf','file-submodule','file-symlink-directory','file-symlink-file','file-text','file-zip','files','filter','filter-filled','flag','flame','fold','fold-down','fold-horizontal','fold-horizontal-filled','fold-up','fold-vertical','fold-vertical-filled','folder','folder-active','folder-library','folder-opened','forward','game','gather','gear','gift','gist','gist-fork','gist-new','gist-private','gist-secret','git-branch','git-branch-changes','git-branch-conflicts','git-branch-create','git-branch-delete','git-branch-staged-changes','git-commit','git-compare','git-fetch','git-fork-private','git-merge','git-pull-request','git-pull-request-abandoned','git-pull-request-assignee','git-pull-request-closed','git-pull-request-create','git-pull-request-done','git-pull-request-draft','git-pull-request-go-to-changes','git-pull-request-label','git-pull-request-milestone','git-pull-request-new-changes','git-pull-request-reviewer','git-stash','git-stash-apply','git-stash-pop','github','github-action','github-alt','github-inverted','github-project','globe','go-to-editing-session','go-to-file','go-to-search','grabber','graph','graph-left','graph-line','graph-scatter','gripper','group-by-ref-type','heart','heart-filled','history','home','horizontal-rule','hubot','inbox','indent','index-zero','info','insert','inspect','issue-closed','issue-draft','issue-opened','issue-reopened','issues','italic','jersey','json','kebab-horizontal','kebab-vertical','key','keyboard','keyboard-tab','keyboard-tab-above','keyboard-tab-below','law','layers','layers-active','layers-dot','layout','layout-activitybar-left','layout-activitybar-right','layout-centered','layout-menubar','layout-panel','layout-panel-center','layout-panel-dock','layout-panel-justify','layout-panel-left','layout-panel-off','layout-panel-right','layout-sidebar-left','layout-sidebar-left-dock','layout-sidebar-left-off','layout-sidebar-right','layout-sidebar-right-dock','layout-sidebar-right-off','layout-statusbar','library','light-bulb','lightbulb','lightbulb-autofix','lightbulb-empty','lightbulb-sparkle','link','link-external','list-filter','list-flat','list-ordered','list-selection','list-tree','list-unordered','live-share','loading','location','lock','lock-small','log-in','log-out','logo-github','magnet','mail','mail-read','mail-reply','map','map-filled','map-horizontal','map-horizontal-filled','map-vertical','map-vertical-filled','mark-github','markdown','mcp','megaphone','mention','menu','merge','merge-into','mic','mic-filled','microscope','milestone','mirror','mirror-private','mirror-public','more','mortar-board','move','multiple-windows','music','mute','new-collection','new-file','new-folder','new-session','newline','no-newline','note','notebook','notebook-template','octoface','open-in-product','open-in-window','open-preview','openai','organization','organization-filled','organization-outline','output','package','paintcan','pass','pass-filled','pencil','percentage','person','person-add','person-filled','person-follow','person-outline','piano','pie-chart','pin','pinned','pinned-dirty','play','play-circle','plug','plus','preserve-case','preview','primitive-dot','primitive-square','project','pulse','python','question','quote','quotes','radio-tower','reactions','record','record-keys','record-small','redo','references','refresh','regex','remote','remote-explorer','remove','remove-close','remove-small','rename','repl','replace','replace-all','reply','repo','repo-clone','repo-create','repo-delete','repo-fetch','repo-force-push','repo-forked','repo-pinned','repo-pull','repo-push','repo-selected','repo-sync','report','request-changes','robot','rocket','root-folder','root-folder-opened','rss','ruby','run','run-above','run-all','run-all-coverage','run-below','run-coverage','run-errors','run-with-deps','save','save-all','save-as','screen-cut','screen-full','screen-normal','search','search-fuzzy','search-large','search-save','search-sparkle','search-stop','selection','send','send-to-remote-agent','server','server-environment','server-process','session-in-progress','settings','settings-gear','share','shield','sign-in','sign-out','skip','smiley','snake','sort-percentage','sort-precedence','source-control','sparkle','sparkle-filled','split-horizontal','split-vertical','squirrel','star','star-add','star-delete','star-empty','star-full','star-half','stop','stop-circle','strikethrough','surround-with','symbol-array','symbol-boolean','symbol-class','symbol-color','symbol-constant','symbol-constructor','symbol-enum','symbol-enum-member','symbol-event','symbol-field','symbol-file','symbol-folder','symbol-function','symbol-interface','symbol-key','symbol-keyword','symbol-method','symbol-method-arrow','symbol-misc','symbol-module','symbol-namespace','symbol-null','symbol-number','symbol-numeric','symbol-object','symbol-operator','symbol-package','symbol-parameter','symbol-property','symbol-reference','symbol-ruler','symbol-snippet','symbol-string','symbol-struct','symbol-structure','symbol-text','symbol-type-parameter','symbol-unit','symbol-value','symbol-variable','sync','sync-ignored','table','tag','tag-add','tag-remove','target','tasklist','telescope','terminal','terminal-bash','terminal-cmd','terminal-debian','terminal-decoration-error','terminal-decoration-incomplete','terminal-decoration-mark','terminal-decoration-success','terminal-git-bash','terminal-linux','terminal-powershell','terminal-tmux','terminal-ubuntu','text-size','thinking','three-bars','thumbsdown','thumbsdown-filled','thumbsup','thumbsup-filled','tools','trash','trashcan','triangle-down','triangle-left','triangle-right','triangle-up','twitter','type-hierarchy','type-hierarchy-sub','type-hierarchy-super','unarchive','unfold','ungroup-by-ref-type','unlock','unmute','unverified','variable','variable-group','verified','verified-filled','versions','vm','vm-active','vm-connect','vm-outline','vm-pending','vm-running','vm-small','vr','vscode','vscode-insiders','wand','warning','watch','whitespace','whole-word','window','window-active','word-wrap','workspace-trusted','workspace-unknown','workspace-untrusted','worktree','worktree-small','wrench','wrench-subaction','x','zap','zoom-in','zoom-out'
      ];
      let iconFilter = '';

      // ---- 内置项命令映射 ----
      const BUILT_IN_COMMANDS = {
        'builtin:smartChat': 'copilotQuickPrompts.smartChatAction',
        'builtin:closeAll': 'copilotQuickPrompts.closeAll',
      };

      // ---- 渲染 ----
      function render(prompts) {
        promptsCache = prompts;
        const total = prompts.length;
        promptList.innerHTML = prompts.map((p, index) => \`
          <div class="prompt-card\${p.hidden ? ' hidden-item' : ''}">
            <div class="prompt-body" data-id="\${p.id}" data-builtin="\${!!p.builtIn}">
              <span class="icon codicon codicon-\${p.icon}"></span>
              <span class="label">\${escapeHtml(p.label)}</span>
            </div>
            <button class="move-btn\${index === 0 ? '' : ''}" data-id="\${p.id}" data-action="up" title="上移"\${index === 0 ? ' disabled' : ''}>
              <span class="codicon codicon-chevron-up"></span>
            </button>
            <button class="move-btn" data-id="\${p.id}" data-action="down" title="下移"\${index === total - 1 ? ' disabled' : ''}>
              <span class="codicon codicon-chevron-down"></span>
            </button>
            <button class="action-btn eye-btn" data-id="\${p.id}" title="\${p.hidden ? '显示' : '隐藏'}">
              <span class="codicon codicon-\${p.hidden ? 'eye-closed' : 'eye'}"></span>
            </button>
            <button class="action-btn edit-btn" data-id="\${p.id}" title="\${p.builtIn ? '内置项不可编辑' : '编辑'}"\${p.builtIn ? ' disabled' : ''}>
              <span class="codicon codicon-edit"></span>
            </button>
          </div>
        \`).join('');

        // 绑定事件
        document.querySelectorAll('.prompt-body').forEach(el => {
          el.addEventListener('click', () => {
            const id = el.dataset.id;
            const item = promptsCache.find(p => p.id === id);
            if (item) {
              if (item.builtIn) {
                const cmd = BUILT_IN_COMMANDS[id];
                if (cmd) vscode.postMessage({ type: 'executeCommand', command: cmd });
                showToast('正在执行');
              } else {
                vscode.postMessage({ type: 'sendPrompt', prompt: item.prompt, mode: item.mode });
                showToast(item.mode === 'direct' ? '已发送执行' : '已填入输入框');
              }
            }
          });
          el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const id = el.dataset.id;
            const item = promptsCache.find(p => p.id === id);
            if (item) {
              if (item.builtIn) {
                const cmd = BUILT_IN_COMMANDS[id];
                if (cmd) vscode.postMessage({ type: 'executeCommand', command: cmd });
                showToast('正在执行');
              } else {
                vscode.postMessage({ type: 'sendPromptWithEditor', prompt: item.prompt, mode: item.mode });
                showToast('已附带选中代码' + (item.mode === 'direct' ? '发送' : '填入'));
              }
            }
          });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const item = promptsCache.find(p => p.id === id);
            if (item) openEditModal(item);
          });
        });

        // 上移/下移按钮
        document.querySelectorAll('.move-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            const idx = promptsCache.findIndex(p => p.id === id);
            if (idx < 0) return;
            if (action === 'up' && idx > 0) {
              const arr = [...promptsCache];
              [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
              saveAndRender(arr);
              showToast('已上移');
            } else if (action === 'down' && idx < promptsCache.length - 1) {
              const arr = [...promptsCache];
              [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
              saveAndRender(arr);
              showToast('已下移');
            }
          });
        });

        // 显示/隐藏按钮
        document.querySelectorAll('.eye-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const updated = promptsCache.map(p =>
              p.id === id ? { ...p, hidden: !p.hidden } : p
            );
            saveAndRender(updated);
            const target = updated.find(p => p.id === id);
            showToast(target?.hidden ? '已隐藏' : '已显示');
          });
        });
      }

      /** 渲染图标建议列表（支持搜索过滤） */
      function renderIconSuggestions(selected) {
        const filter = iconFilter.toLowerCase().trim();
        const filtered = filter
          ? ALL_CODICONS.filter(name => name.includes(filter))
          : ALL_CODICONS;
        iconSuggestions.innerHTML = filtered.map(name =>
          \`<span class="icon-option\${name === selected ? ' active' : ''}" data-icon="\${name}" title="\${name}">
            <span class="codicon codicon-\${name}"></span>
          </span>\`
        ).join('');
      }

      // ---- 编辑弹窗 ----
      const btnDelete = document.getElementById('btnDelete');

      function openEditModal(item) {
        editingId = item.id;
        modalTitle.textContent = item.id ? '编辑提示词' : '添加快捷按钮';
        editLabel.value = item.label || '';
        editIcon.value = item.icon || 'sparkle';
        editPrompt.value = item.prompt || '';
        // 重置图标搜索
        iconFilter = '';
        iconFilterInput.value = '';
        renderIconSuggestions(editIcon.value);
        // 设置显示方式
        const mode = item.displayMode || 'icon';
        document.querySelectorAll('#displayModeOptions .mode-option').forEach(el => {
          el.classList.toggle('active', el.dataset.mode === mode);
        });
        // 设置执行模式
        const execMode = item.mode || 'write';
        document.querySelectorAll('#execModeOptions .mode-option').forEach(el => {
          el.classList.toggle('active', el.dataset.mode === execMode);
        });
        // 显示/隐藏删除按钮（新增时隐藏）
        btnDelete.style.display = item.id ? 'block' : 'none';
        modalOverlay.classList.add('show');
        editLabel.focus();
        updateIconPreview();
      }

      /** 添加新快捷按钮 */
      function openAddModal() {
        openEditModal({
          id: '',
          label: '',
          icon: 'sparkle',
          prompt: '',
          color: '#4fc3f7',
          mode: 'write',
          displayMode: 'icon',
        });
      }

      function closeEditModal() {
        modalOverlay.classList.remove('show');
        editingId = null;
      }

      /** 更新图标实时预览 */
      function updateIconPreview() {
        const name = editIcon.value.trim() || 'sparkle';
        editIcon.style.backgroundImage = 'none';
        // 高亮对应的建议项
        iconSuggestions.querySelectorAll('.icon-option').forEach(el => {
          el.classList.toggle('active', el.dataset.icon === name);
        });
      }

      // 图标输入实时预览
      editIcon.addEventListener('input', updateIconPreview);

      // 图标搜索过滤
      const iconFilterInput = document.getElementById('iconFilter');
      iconFilterInput.addEventListener('input', () => {
        iconFilter = iconFilterInput.value;
        renderIconSuggestions(editIcon.value.trim() || 'sparkle');
      });

      // 图标建议点击选择
      iconSuggestions.addEventListener('click', (e) => {
        const option = e.target.closest('.icon-option');
        if (option) {
          editIcon.value = option.dataset.icon;
          updateIconPreview();
        }
      });

      // 显示方式选择
      document.getElementById('displayModeOptions').addEventListener('click', (e) => {
        const option = e.target.closest('.mode-option');
        if (option) {
          document.querySelectorAll('#displayModeOptions .mode-option').forEach(el => {
            el.classList.toggle('active', el === option);
          });
        }
      });

      // 执行模式选择
      document.getElementById('execModeOptions').addEventListener('click', (e) => {
        const option = e.target.closest('.mode-option');
        if (option) {
          document.querySelectorAll('#execModeOptions .mode-option').forEach(el => {
            el.classList.toggle('active', el === option);
          });
        }
      });

      // 添加按钮
      document.getElementById('addBtn').addEventListener('click', openAddModal);

      document.getElementById('btnCancel').addEventListener('click', closeEditModal);
      document.getElementById('btnSave').addEventListener('click', () => {
        const label = editLabel.value.trim();
        const icon = editIcon.value.trim() || 'sparkle';
        const prompt = editPrompt.value.trim();
        const displayModeEl = document.querySelector('#displayModeOptions .mode-option.active');
        const displayMode = displayModeEl ? displayModeEl.dataset.mode : 'icon';
        const execModeEl = document.querySelector('#execModeOptions .mode-option.active');
        const execMode = execModeEl ? execModeEl.dataset.mode : 'write';
        if (!label || !prompt) {
          showToast('标题和内容不能为空');
          return;
        }
        let updated;
        if (!editingId) {
          // 新增
          const newItem = {
            id: 'custom-' + Date.now(),
            label,
            icon,
            prompt,
            color: '#4fc3f7',
            mode: execMode,
            displayMode,
          };
          updated = [...promptsCache, newItem];
        } else {
          updated = promptsCache.map(p =>
            p.id === editingId ? { ...p, label, icon, prompt, displayMode, mode: execMode } : p
          );
        }
        vscode.postMessage({ type: 'savePrompts', prompts: updated });
        closeEditModal();
        showToast(editingId ? '已保存' : '已添加');
      });

      // 编辑弹窗内删除
      btnDelete.addEventListener('click', () => {
        if (editingId) {
          pendingDeleteId = editingId;
          closeEditModal();
          confirmOverlay.classList.add('show');
        }
      });

      // 删除确认
      confirmDelete.addEventListener('click', () => {
        if (pendingDeleteId) {
          const updated = promptsCache.filter(p => p.id !== pendingDeleteId);
          vscode.postMessage({ type: 'savePrompts', prompts: updated });
          showToast('已删除');
        }
        confirmOverlay.classList.remove('show');
        pendingDeleteId = null;
      });
      confirmCancel.addEventListener('click', () => {
        confirmOverlay.classList.remove('show');
        pendingDeleteId = null;
      });
      confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) {
          confirmOverlay.classList.remove('show');
          pendingDeleteId = null;
        }
      });

      // 点击遮罩关闭
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeEditModal();
      });

      // 回车跳转下一输入框（排除 IME 输入法确认）
      editLabel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) editIcon.focus();
      });
      editIcon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) editPrompt.focus();
      });

      // ---- Toast ----
      function showToast(text) {
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
      }

      // ---- 工具 ----
      function escapeHtml(text) {
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
      }

      /** 保存并重新渲染 */
      function saveAndRender(prompts) {
        promptsCache = prompts;
        vscode.postMessage({ type: 'savePrompts', prompts });
      }

      // ---- 位置选择 ----
      const positionOptions = document.getElementById('positionOptions');

      function renderPosition(position) {
        positionOptions.querySelectorAll('.pos-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.pos === position);
        });
      }

      positionOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.pos-btn');
        if (btn && !btn.classList.contains('active')) {
          const pos = btn.dataset.pos;
          vscode.postMessage({ type: 'updatePosition', position: pos });
          renderPosition(pos);
          showToast('位置已更新');
        }
      });

      // ---- 通信 ----
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'updateState') {
          render(msg.prompts);
          renderPosition(msg.position);
        }
      });

      // 通知扩展 webview 已就绪
      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
  }
}
