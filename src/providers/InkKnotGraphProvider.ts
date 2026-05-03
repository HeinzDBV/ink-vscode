import * as vscode from "vscode";
import { parseKnots, extractDiverts, ParsedKnot } from "../utils/inkParser";

export class KnotGraphItem extends vscode.TreeItem {
    constructor(
        public readonly kind: "knot" | "divert",
        label: string,
        public readonly knotName: string,
        public readonly targetLine: number,
        collapsible: vscode.TreeItemCollapsibleState,
        exists: boolean = true
    ) {
        super(label, collapsible);

        if (kind === "knot") {
            this.iconPath = new vscode.ThemeIcon(exists ? "symbol-module" : "symbol-function");
            this.contextValue = "inkKnot";
        } else {
            this.iconPath = new vscode.ThemeIcon(exists ? "arrow-right" : "warning");
            this.contextValue = "inkDivert";
            if (exists) {
                this.command = {
                    command: "revealLine",
                    title: "Go to knot",
                    arguments: [{ lineNumber: targetLine, at: "top" }]
                };
            }
            this.tooltip = exists ? `Go to ${knotName}` : `Knot "${knotName}" not found in this file`;
        }
    }
}

export class InkKnotGraphProvider implements vscode.TreeDataProvider<KnotGraphItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<KnotGraphItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private fileLines: string[] = [];
    private parsedKnots: ParsedKnot[] = [];

    setActiveFile(filePath: string, text: string): void {
        this.fileLines = text.split("\n");
        this.parsedKnots = parseKnots(this.fileLines);
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === "ink") {
            this.setActiveFile(editor.document.uri.fsPath, editor.document.getText());
        } else {
            this._onDidChangeTreeData.fire();
        }
    }

    getTreeItem(element: KnotGraphItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: KnotGraphItem): vscode.ProviderResult<KnotGraphItem[]> {
        if (this.parsedKnots.length === 0) {
            return [];
        }

        if (!element) {
            return this._getKnotItems();
        }

        if (element.kind === "knot") {
            return this._getDivertItems(element);
        }

        return [];
    }

    private _getKnotItems(): KnotGraphItem[] {
        const knotNames = new Set(this.parsedKnots.map(k => k.name));

        return this.parsedKnots.map(knot => {
            const unique = [...new Set(extractDiverts(this.fileLines, knot))];
            const collapsible = unique.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

            const label = knot.isFunction ? `${knot.name} (function)` : knot.name;
            const item = new KnotGraphItem(
                "knot",
                label,
                knot.isFunction ? "__function__" : knot.name,
                knot.startLine,
                collapsible,
                !knot.isFunction
            );
            item.description = unique.length > 0
                ? `${unique.length} divert${unique.length > 1 ? "s" : ""}`
                : undefined;
            return item;
        });
    }

    private _getDivertItems(knotItem: KnotGraphItem): KnotGraphItem[] {
        const knot = this.parsedKnots.find(k => k.startLine === knotItem.targetLine);
        if (!knot) return [];

        const knotNames = new Set(this.parsedKnots.map(k => k.name));
        const seen = new Set<string>();

        return extractDiverts(this.fileLines, knot)
            .filter(target => {
                if (seen.has(target)) return false;
                seen.add(target);
                return true;
            })
            .map(target => {
                const exists = knotNames.has(target);
                const targetKnot = this.parsedKnots.find(k => k.name === target);
                return new KnotGraphItem(
                    "divert",
                    `→ ${target}`,
                    target,
                    targetKnot ? targetKnot.startLine : 0,
                    vscode.TreeItemCollapsibleState.None,
                    exists
                );
            });
    }
}

