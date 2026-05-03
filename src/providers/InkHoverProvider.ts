'use strict';

import { Hover, HoverProvider, MarkdownString, Position, ProviderResult, Range, TextDocument } from "vscode";
import { getNodeByNameAndScope } from "../controllers/NodeController";
import { KnotNode } from "../models/KnotNode";
import { StitchNode } from "../models/StitchNode";

export class InkHoverProvider implements HoverProvider {
    private static readonly divertRegex = /->\s*([\w.]+)/g;

    provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
        const lineText = document.lineAt(position.line).text;

        // Find which divert (if any) the cursor is over
        let match: RegExpExecArray | null;
        const regex = new RegExp(InkHoverProvider.divertRegex.source, "g");

        while ((match = regex.exec(lineText)) !== null) {
            const nameStart = match.index + match[0].indexOf(match[1]);
            const nameEnd = nameStart + match[1].length;

            if (position.character < nameStart || position.character > nameEnd) continue;

            const [targetName] = match[1].split(".");
            if (targetName === "END" || targetName === "DONE") return;

            const node = getNodeByNameAndScope(targetName, document.uri.fsPath, position.line);
            if (!node) return;

            const preview = this._extractPreview(document, node);
            if (!preview) return;

            const md = new MarkdownString();
            md.appendCodeblock(node.name ?? "", "ink");
            md.appendMarkdown(preview);

            return new Hover(md, new Range(position.line, nameStart, position.line, nameEnd));
        }
    }

    private _extractPreview(document: TextDocument, node: KnotNode | StitchNode | any): string {
        const startLine: number = node.startLine ?? node.line;
        const endLine: number = node.endLine ?? (startLine + 1);

        const lines: string[] = [];
        for (let i = startLine + 1; i < Math.min(endLine, startLine + 20); i++) {
            const text = document.lineAt(i).text.trim();
            // Skip empty lines, comments, diverts, variable assignments, choices
            if (!text || text.startsWith("//") || text.startsWith("/*") || text.startsWith("~")
                || text.startsWith("->") || text.startsWith("*") || text.startsWith("+")
                || text.startsWith("-") || text.startsWith("=")) continue;

            lines.push(text);
            if (lines.length >= 3) break;
        }

        return lines.join("\n\n");
    }
}
