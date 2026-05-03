'use strict';

import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Disposable, languages, Position, Range, TextDocument, workspace } from "vscode";
import { getDefinitionByNameAndScope } from "../controllers/NodeController";
import { NodeMap } from "../models/NodeMap";

const PERMANENT_TARGETS = new Set(["END", "DONE"]);
const DIVERT_REGEX = /->\s*([\w.]+)/g;
const LABEL_SCAN_REGEX = /(?:[-*+]\s*)+\((\w+)\)/;

function buildLocalTargetSet(document: TextDocument): Set<string> {
    const nodeMap = NodeMap.nodeMapFromDocument(document);
    const names = new Set<string>();

    // Collect knot and stitch names from the model
    for (const knot of nodeMap.knots) {
        if (knot.name) names.add(knot.name);
        for (const stitch of knot.stitches) {
            names.add(stitch.name);
        }
    }

    // Scan all lines directly for labels — catches nested choices, pre-stitch labels, etc.
    for (let i = 0; i < document.lineCount; i++) {
        const m = LABEL_SCAN_REGEX.exec(document.lineAt(i).text);
        if (m) names.add(m[1]);
    }

    return names;
}

export class InkDiagnosticsController {
    private readonly _collection: DiagnosticCollection;
    private readonly _disposable: Disposable;

    constructor() {
        this._collection = languages.createDiagnosticCollection("ink");

        this._disposable = Disposable.from(
            workspace.onDidOpenTextDocument(doc => this._validate(doc)),
            workspace.onDidChangeTextDocument(({ document }) => this._validate(document)),
            workspace.onDidCloseTextDocument(doc => this._collection.delete(doc.uri))
        );

        // Validate all currently open ink documents
        workspace.textDocuments.forEach(doc => this._validate(doc));
    }

    private _validate(document: TextDocument): void {
        if (document.languageId !== "ink") return;

        // Build local target names by parsing the document fresh (no store dependency)
        const localTargets = buildLocalTargetSet(document);
        const diagnostics: Diagnostic[] = [];

        for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
            const lineText = document.lineAt(lineIndex).text;
            const regex = new RegExp(DIVERT_REGEX.source, "g");
            let match: RegExpExecArray | null;

            while ((match = regex.exec(lineText)) !== null) {
                const [targetName] = match[1].split(".");
                if (PERMANENT_TARGETS.has(targetName)) continue;

                // Check local targets first, then fall back to global store
                if (localTargets.has(targetName)) continue;
                if (getDefinitionByNameAndScope(targetName, document.uri.fsPath, lineIndex)) continue;

                const nameStart = match.index + match[0].indexOf(match[1]);
                const range = new Range(
                    new Position(lineIndex, nameStart),
                    new Position(lineIndex, nameStart + targetName.length)
                );

                diagnostics.push(new Diagnostic(
                    range,
                    `Unknown divert target: '${targetName}'`,
                    DiagnosticSeverity.Error
                ));
            }
        }

        this._collection.set(document.uri, diagnostics);
    }

    public dispose(): void {
        this._collection.dispose();
        this._disposable.dispose();
    }
}

