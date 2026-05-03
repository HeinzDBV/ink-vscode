'use strict';

import { Disposable, OverviewRulerLane, Range, TextEditor, TextEditorDecorationType, window, workspace } from "vscode";
import { NodeMap } from "../models/NodeMap";

export class InkDecorationController {
    private readonly _knotDecoration: TextEditorDecorationType;
    private readonly _stitchDecoration: TextEditorDecorationType;
    private readonly _labelDecoration: TextEditorDecorationType;
    private readonly _disposable: Disposable;

    constructor() {
        this._knotDecoration = window.createTextEditorDecorationType({
            overviewRulerColor: "#6796E6",
            overviewRulerLane: OverviewRulerLane.Right
        });

        this._stitchDecoration = window.createTextEditorDecorationType({
            overviewRulerColor: "#B5CEA8",
            overviewRulerLane: OverviewRulerLane.Right
        });

        this._labelDecoration = window.createTextEditorDecorationType({
            overviewRulerColor: "#CE9178",
            overviewRulerLane: OverviewRulerLane.Right
        });

        this._disposable = Disposable.from(
            window.onDidChangeActiveTextEditor(editor => {
                if (editor) this._applyDecorations(editor);
            }),
            workspace.onDidChangeTextDocument(event => {
                const editor = window.activeTextEditor;
                if (editor && editor.document === event.document) {
                    this._applyDecorations(editor);
                }
            })
        );

        if (window.activeTextEditor) {
            this._applyDecorations(window.activeTextEditor);
        }
    }

    private _applyDecorations(editor: TextEditor) {
        if (editor.document.languageId !== "ink") {
            editor.setDecorations(this._knotDecoration, []);
            editor.setDecorations(this._stitchDecoration, []);
            editor.setDecorations(this._labelDecoration, []);
            return;
        }

        const nodeMap = NodeMap.nodeMapFromDocument(editor.document);
        const knotRanges: Range[] = [];
        const stitchRanges: Range[] = [];
        const labelRanges: Range[] = [];

        for (const knot of nodeMap.knots) {
            knotRanges.push(editor.document.lineAt(knot.startLine).range);
            for (const stitch of knot.stitches) {
                stitchRanges.push(editor.document.lineAt(stitch.startLine).range);
                for (const label of stitch.labels) {
                    labelRanges.push(editor.document.lineAt(label.line).range);
                }
            }
        }

        editor.setDecorations(this._knotDecoration, knotRanges);
        editor.setDecorations(this._stitchDecoration, stitchRanges);
        editor.setDecorations(this._labelDecoration, labelRanges);
    }

    public dispose() {
        this._knotDecoration.dispose();
        this._stitchDecoration.dispose();
        this._labelDecoration.dispose();
        this._disposable.dispose();
    }
}
