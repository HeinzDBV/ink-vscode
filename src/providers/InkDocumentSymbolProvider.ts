'use strict';

import { DocumentSymbol, DocumentSymbolProvider, ProviderResult, Range, SymbolKind, TextDocument } from "vscode";
import { NodeMap } from "../models/NodeMap";

const LABEL_REGEX = /^\s*(?:[-*+]\s*)+\((\w+)\)/;

// Returns display text for a choice line (*, +), or null if line is not a choice
function extractChoiceText(lineText: string): string | null {
    // Must start with * or + (skip labeled choices like `* (name)`)
    const m = /^\s*[*+][*+\s]*(?!\()(.+)/.exec(lineText);
    if (!m) return null;
    let text = m[1].trim();
    // Strip ink conditions: {condition}
    text = text.replace(/^\{[^}]*\}\s*/g, '').trim();
    // If bracketed (player-facing display text), use bracket content
    const bracketMatch = /^\[([^\]]*)\]/.exec(text);
    if (bracketMatch) return bracketMatch[1].trim() || null;
    return text.substring(0, 60).trim() || null;
}

export class InkDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: TextDocument): ProviderResult<DocumentSymbol[]> {
        const nodeMap = NodeMap.nodeMapFromDocument(document);
        const symbols: DocumentSymbol[] = [];

        for (const knot of nodeMap.knots) {
            const kind = knot.isFunction ? SymbolKind.Function : SymbolKind.Module;
            const knotRange = new Range(knot.startLine, 0, knot.endLine - 1, 0);
            const knotSelection = document.lineAt(knot.startLine).range;
            const knotSymbol = new DocumentSymbol(knot.name ?? "", "", kind, knotRange, knotSelection);

            // Build stitch symbols indexed by startLine
            const stitchSymbolsByLine = new Map<number, DocumentSymbol>();
            for (const stitch of knot.stitches) {
                const stitchRange = new Range(stitch.startLine, 0, stitch.endLine - 1, 0);
                const stitchSel = document.lineAt(stitch.startLine).range;
                stitchSymbolsByLine.set(stitch.startLine,
                    new DocumentSymbol(stitch.name, "", SymbolKind.Method, stitchRange, stitchSel));
            }

            // Single line-by-line pass: add stitches and labels in document order
            let currentParent: DocumentSymbol = knotSymbol;
            for (let i = knot.startLine + 1; i < knot.endLine && i < document.lineCount; i++) {
                const lineText = document.lineAt(i).text;

                // If this line is a stitch header, switch parent
                const stitchSymbol = stitchSymbolsByLine.get(i);
                if (stitchSymbol) {
                    knotSymbol.children.push(stitchSymbol);
                    currentParent = stitchSymbol;
                    continue;
                }

                // If this line has a label, add it to the current parent
                const labelMatch = LABEL_REGEX.exec(lineText);
                if (labelMatch) {
                    const lr = document.lineAt(i).range;
                    currentParent.children.push(new DocumentSymbol(labelMatch[1], "", SymbolKind.Field, lr, lr));
                } else {
                    // Unnamed choice/sticky choice — show choice text
                    const choiceText = extractChoiceText(lineText);
                    if (choiceText) {
                        const lr = document.lineAt(i).range;
                        currentParent.children.push(new DocumentSymbol(choiceText, "", SymbolKind.Property, lr, lr));
                    }
                }
            }

            symbols.push(knotSymbol);
        }

        return symbols;
    }
}
