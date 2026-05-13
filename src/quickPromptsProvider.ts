import * as vscode from "vscode";

/** 预设提示词定义 */
export interface PromptItem {
  id: string;
  icon: string;
  label: string;
  prompt: string;
  color: string;
  mode: "direct" | "write";
}

export const STORAGE_KEY = "copilotQuickPrompts.prompts";

/** 默认预设提示词列表 */
export const DEFAULT_PROMPTS: PromptItem[] = [
  {
    id: "review",
    icon: "search",
    label: "代码审查",
    prompt: "请审查以下代码，找出潜在的问题、安全漏洞和改进建议：",
    color: "#4fc3f7",
    mode: "write",
  },
  {
    id: "explain",
    icon: "book",
    label: "解释代码",
    prompt: "请详细解释以下代码的功能、工作原理和关键逻辑：",
    color: "#81c784",
    mode: "write",
  },
  {
    id: "test",
    icon: "beaker",
    label: "编写测试",
    prompt: "请为以下代码编写全面的单元测试，覆盖主要场景和边界情况：",
    color: "#ffb74d",
    mode: "write",
  },
  {
    id: "optimize",
    icon: "zap",
    label: "优化代码",
    prompt: "请优化以下代码，提高性能、可读性和可维护性：",
    color: "#e57373",
    mode: "write",
  },
  {
    id: "docs",
    icon: "comment",
    label: "添加注释",
    prompt: "请为以下代码添加详细的中文注释，解释每个函数和关键逻辑：",
    color: "#ba68c8",
    mode: "write",
  },
  {
    id: "refactor",
    icon: "sync",
    label: "重构建议",
    prompt: "请分析以下代码并提供重构建议，使其更符合设计模式和最佳实践：",
    color: "#4db6ac",
    mode: "write",
  },
];

export class QuickPromptsProvider implements vscode.WebviewViewProvider {
  private prompts: PromptItem[];
  private webviewView?: vscode.WebviewView;

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

  /** 从全局存储加载提示词 */
  private loadPrompts(): PromptItem[] {
    const saved = this.storage.get<string>(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as PromptItem[];
      } catch {
        // ignore
      }
    }
    return DEFAULT_PROMPTS.map((p) => ({ ...p }));
  }

  /** 保存提示词到全局存储 */
  private savePrompts(): void {
    this.storage.update(STORAGE_KEY, JSON.stringify(this.prompts));
  }

  /** 向 webview 发送更新后的数据 */
  private postPrompts(): void {
    this.webviewView?.webview.postMessage({
      type: "updatePrompts",
      prompts: this.prompts,
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

    // 向 webview 发送初始数据
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "ready":
          // webview 就绪后发送数据
          this.postPrompts();
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
          this.postPrompts();
          this._onDidChangePrompts.fire();
          break;

        case "toggleMode": {
          const item = this.prompts.find((p) => p.id === message.id);
          if (item) {
            item.mode = item.mode === "direct" ? "write" : "direct";
            this.savePrompts();
            this.postPrompts();
            this._onDidChangePrompts.fire();
          }
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
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: var(--fg);
      font-size: 13px;
    }
    .container { display: flex; flex-direction: column; gap: 6px; }
    .section-title {
      font-size: 11px;
      color: var(--desc);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 0;
      font-weight: 600;
    }

    /* --- 提示词卡片 --- */
    .prompt-card {
      display: flex;
      align-items: stretch;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      overflow: hidden;
      transition: border-color 0.2s;
    }
    .prompt-card:hover { border-color: var(--btn-primary); }

    /* 左侧点击区域 */
    .prompt-body {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      min-width: 0;
    }
    .prompt-body:hover {
      background: var(--hover);
    }
    .prompt-body .icon { font-size: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 24px; }
    .prompt-info { flex: 1; min-width: 0; }
    .prompt-info .label {
      font-weight: 600;
      font-size: 13px;
      display: block;
    }
    .prompt-info .preview {
      font-size: 11px;
      color: var(--desc);
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    /* 右侧操作按钮区 */
    .prompt-actions {
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--border);
      flex-shrink: 0;
    }
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      flex: 1;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--desc);
      font-size: 14px;
      transition: background 0.15s, color 0.15s;
      padding: 4px;
    }
    .action-btn:hover { background: var(--hover); }
    .action-btn.edit-btn:hover { color: #4fc3f7; }
    .action-btn.mode-btn.direct { color: #ffa726; }
    .action-btn.mode-btn.write { color: var(--desc); }
    .mode-btn .mode-icon { font-size: 13px; pointer-events: none; }

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

    .badge {
      display: inline-block;
      font-size: 9px;
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 500;
      margin-left: 6px;
      vertical-align: middle;
    }
    .badge.direct { background: #ffa72633; color: #ffa726; }
    .badge.write { background: #88888833; color: #999; }
    .hint {
      font-size: 10px;
      color: var(--desc);
      text-align: center;
      padding: 6px 0 2px;
      opacity: 0.7;
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
      border-radius: 6px;
      font-size: 12px;
      color: var(--vscode-editorWidget-foreground);
      white-space: nowrap;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toast.show { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="section-title"><span class="codicon codicon-sparkle" style="margin-right: 4px; font-size: 12px;"></span>快捷提示词</div>
    <div id="promptList"></div>
    <div class="hint">左键执行 · 右键附带代码 · <span class="codicon codicon-play"></span>切换模式 · <span class="codicon codicon-edit"></span>编辑</div>
    <div class="toast" id="toast"></div>
  </div>

  <!-- 编辑弹窗 -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <h3 id="modalTitle">编辑提示词</h3>
      <label>标题</label>
      <input type="text" id="editLabel" placeholder="按钮显示名称" />
      <label>图标（codicon 名称）</label>
      <input type="text" id="editIcon" placeholder="例如：search, book, beaker, zap..." />
      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:6px;" id="iconSuggestions"></div>
      <label>提示词内容</label>
      <textarea id="editPrompt" placeholder="输入提示词..."></textarea>
      <div class="modal-actions">
        <button class="btn-cancel" id="btnCancel">取消</button>
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

      // 编辑弹窗元素
      const modalOverlay = document.getElementById('modalOverlay');
      const editLabel = document.getElementById('editLabel');
      const editIcon = document.getElementById('editIcon');
      const editPrompt = document.getElementById('editPrompt');
      const modalTitle = document.getElementById('modalTitle');
      const iconSuggestions = document.getElementById('iconSuggestions');
      let editingId = null;
      let promptsCache = [];

      // 常用 codicon 列表
      const COMMON_ICONS = ['search', 'book', 'beaker', 'zap', 'comment', 'sync', 'eye', 'lightbulb', 'sparkle', 'code', 'rocket', 'pulse', 'star', 'heart', 'tools', 'wrench', 'flame', 'check', 'info', 'question', 'warning', 'error', 'lock', 'globe', 'fire', 'key', 'pin', 'tag', 'trash', 'organization', 'person', 'graph', 'note', 'quote'];

      // ---- 渲染 ----
      function render(prompts) {
        promptsCache = prompts;
        promptList.innerHTML = prompts.map(p => {
          const modeIcon = p.mode === 'direct' ? 'play' : 'edit';
          const modeIconClass = 'codicon codicon-' + modeIcon;
          const modeTitle = p.mode === 'direct' ? '直接执行' : '写入输入框';
          return \`
            <div class="prompt-card" style="--card-color: \${p.color}">
              <div class="prompt-body" data-id="\${p.id}">
                <span class="icon codicon codicon-\${p.icon}"></span>
                <div class="prompt-info">
                  <span class="label">
                    \${escapeHtml(p.label)}
                    <span class="badge \${p.mode}">\${modeTitle}</span>
                  </span>
                  <span class="preview">\${escapeHtml(p.prompt)}</span>
                </div>
              </div>
              <div class="prompt-actions">
                <button class="action-btn mode-btn \${p.mode}" data-id="\${p.id}" title="切换执行模式（当前：\${modeTitle}）">
                  <span class="mode-icon codicon codicon-\${modeIcon}"></span>
                </button>
                <button class="action-btn edit-btn" data-id="\${p.id}" title="编辑提示词">
                  <span class="codicon codicon-edit"></span>
                </button>
              </div>
            </div>
          \`;
        }).join('');

        // 绑定事件
        document.querySelectorAll('.prompt-body').forEach(el => {
          el.addEventListener('click', () => {
            const id = el.dataset.id;
            const item = promptsCache.find(p => p.id === id);
            if (item) {
              vscode.postMessage({ type: 'sendPrompt', prompt: item.prompt, mode: item.mode });
              showToast(item.mode === 'direct' ? '已发送执行' : '已填入输入框');
            }
          });
          el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const id = el.dataset.id;
            const item = promptsCache.find(p => p.id === id);
            if (item) {
              vscode.postMessage({ type: 'sendPromptWithEditor', prompt: item.prompt, mode: item.mode });
              showToast('已附带选中代码' + (item.mode === 'direct' ? '发送' : '填入'));
            }
          });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            vscode.postMessage({ type: 'toggleMode', id });
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
      }

      /** 渲染图标建议列表 */
      function renderIconSuggestions(selected) {
        iconSuggestions.innerHTML = COMMON_ICONS.map(name =>
          \`<span class="icon-option\${name === selected ? ' active' : ''}" data-icon="\${name}" title="\${name}">
            <span class="codicon codicon-\${name}"></span>
          </span>\`
        ).join('');
      }

      // ---- 编辑弹窗 ----
      function openEditModal(item) {
        editingId = item.id;
        modalTitle.textContent = '编辑提示词';
        editLabel.value = item.label;
        editIcon.value = item.icon || 'sparkle';
        editPrompt.value = item.prompt;
        renderIconSuggestions(editIcon.value);
        modalOverlay.classList.add('show');
        editLabel.focus();
        updateIconPreview();
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

      // 图标建议点击选择
      iconSuggestions.addEventListener('click', (e) => {
        const option = e.target.closest('.icon-option');
        if (option) {
          editIcon.value = option.dataset.icon;
          updateIconPreview();
        }
      });

      document.getElementById('btnCancel').addEventListener('click', closeEditModal);
      document.getElementById('btnSave').addEventListener('click', () => {
        if (!editingId) return;
        const label = editLabel.value.trim();
        const icon = editIcon.value.trim() || 'sparkle';
        const prompt = editPrompt.value.trim();
        if (!label || !prompt) {
          showToast('标题和内容不能为空');
          return;
        }
        const updated = promptsCache.map(p =>
          p.id === editingId ? { ...p, label, icon, prompt } : p
        );
        vscode.postMessage({ type: 'savePrompts', prompts: updated });
        closeEditModal();
        showToast('已保存');
      });

      // 点击遮罩关闭
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeEditModal();
      });

      // 回车保存
      editLabel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') editIcon.focus();
      });
      editIcon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') editPrompt.focus();
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

      // ---- 通信 ----
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'updatePrompts') {
          render(msg.prompts);
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
