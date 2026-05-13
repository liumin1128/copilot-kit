import * as vscode from "vscode";
/** 状态栏位置配置 */
export type StatusBarPosition = "leftLeft" | "leftRight" | "rightLeft" | "rightRight";
export declare const CONFIG_KEY = "copilotQuickPrompts.statusBarPosition";
/**
 * 根据配置获取状态栏对齐方式和优先级
 * @returns alignment - 对齐方向
 * @returns basePriority - 分组在状态栏上的基准位置
 * @returns buttonsBeforeRocket - true=按钮在火箭左边/上边，false=火箭在按钮左边/上边
 */
export declare function getPositionConfig(): {
    alignment: vscode.StatusBarAlignment;
    basePriority: number;
    buttonsBeforeRocket: boolean;
};
/** 预设提示词定义 */
export interface PromptItem {
    id: string;
    icon: string;
    label: string;
    prompt: string;
    color: string;
    mode: "direct" | "write";
}
export declare const STORAGE_KEY = "copilotQuickPrompts.prompts";
/** 默认预设提示词列表 */
export declare const DEFAULT_PROMPTS: PromptItem[];
export declare class QuickPromptsProvider implements vscode.WebviewViewProvider {
    private readonly extensionUri;
    private readonly storage;
    private prompts;
    private webviewView?;
    private _configListener;
    /** 提示词变更事件（用于通知 extension 刷新状态栏等） */
    private _onDidChangePrompts;
    readonly onDidChangePrompts: vscode.Event<void>;
    constructor(extensionUri: vscode.Uri, storage: vscode.Memento);
    /** 从全局存储加载提示词 */
    private loadPrompts;
    /** 保存提示词到全局存储 */
    private savePrompts;
    /** 向 webview 发送更新后的数据 */
    private postState;
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    /** 发送提示词 */
    private sendPrompt;
    /** 发送提示词并附加上当前编辑器选中的代码 */
    private handleSendWithEditor;
    private getHtmlContent;
}
