'use strict';
/* Ink for VS Code Extension Main File */

import { ExtensionContext, DocumentFilter, ProgressLocation, languages, window, commands, workspace } from "vscode";
import { InkDivertDefinitionProvider } from "./providers/InkDivertDefinitionProvider";
import { InkFunctionDefinitionProvider } from "./providers/InkFunctionDefinitionProvider";
import { DivertCompletionProvider } from "./providers/DivertCompletionProvider";
import { InkVariableDefinitionProvider } from "./providers/InkVariableDefinitionProvider";
import { InkFoldingProvider } from "./providers/InkFoldingProvider";
import { InkDocumentSymbolProvider } from "./providers/InkDocumentSymbolProvider";
import { InkDecorationController } from "./controllers/InkDecorationController";
import { InkStructureCompletionProvider } from "./providers/InkStructureCompletionProvider";
import { InkHoverProvider } from "./providers/InkHoverProvider";
import { InkDiagnosticsController } from "./controllers/InkDiagnosticsController";
import { generateNodeMaps, NodeController } from "./controllers/NodeController";
import { FunctionController, generateFunctionMaps } from "./controllers/FunctionController";
import { InkKnotGraphProvider } from "./providers/InkKnotGraphProvider";
import { InkGraphWebviewProvider } from "./providers/InkGraphWebviewProvider";
import { WordNodeCounterController } from "./controllers/WordCountController";
import { WordCounterService } from "./controllers/WordCounterService";

const INK : DocumentFilter = { language: 'ink' };

export function activate(context: ExtensionContext) {
    const disposables = [];

    // Services and controllers.
    const wordCounter = new WordCounterService();
    const wordCounterController = new WordNodeCounterController(wordCounter);
    const nodeController = new NodeController();
    const functionController = new FunctionController();
    const decorationController = new InkDecorationController();
    const diagnosticsController = new InkDiagnosticsController();

    // Add to a list of disposables to be disposed when this extension is deactivated.
    disposables.push(wordCounter, wordCounterController, nodeController, functionController, decorationController, diagnosticsController);

    // Knot graph view
    const knotGraphProvider = new InkKnotGraphProvider();
    disposables.push(window.registerTreeDataProvider("inkKnotGraph", knotGraphProvider));
    disposables.push(commands.registerCommand("ink.graph.refresh", () => knotGraphProvider.refresh()));
    disposables.push(commands.registerCommand("ink.graph.openVisual", () => {
        const editor = window.activeTextEditor;
        if (editor && editor.document.languageId === "ink") {
            InkGraphWebviewProvider.createOrShow(context, editor.document.uri.fsPath, editor.document.getText());
        } else {
            window.showInformationMessage("Open an Ink file to view its knot graph.");
        }
    }));

    // Initialize graph with the currently open ink file (if any)
    const activeEditor = window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === "ink") {
        knotGraphProvider.setActiveFile(activeEditor.document.uri.fsPath, activeEditor.document.getText());
    }

    // Update graph when the active editor changes
    disposables.push(
        window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === "ink") {
                knotGraphProvider.setActiveFile(editor.document.uri.fsPath, editor.document.getText());
                if (InkGraphWebviewProvider.isOpen()) {
                    InkGraphWebviewProvider.update(editor.document.uri.fsPath, editor.document.getText());
                }
            }
        }),
        workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === "ink" && event.document === window.activeTextEditor?.document) {
                knotGraphProvider.setActiveFile(event.document.uri.fsPath, event.document.getText());
                if (InkGraphWebviewProvider.isOpen()) {
                    InkGraphWebviewProvider.update(event.document.uri.fsPath, event.document.getText());
                }
            }
        })
    );

    // Show mapping progress, runs in parallel.
    (async () => {
        try {
          await Promise.all([
            window.withProgress({ location: ProgressLocation.Window, title: "Mapping knots and stitches..." }, generateNodeMaps),
            window.withProgress({ location: ProgressLocation.Window, title: "Mapping function declarations..." }, generateFunctionMaps)
          ]);
        } catch (err) {
          console.error("Error while mapping:", err);
        }
    })();
    
    // Register language features and push to disposables.
    disposables.push(
        languages.registerCompletionItemProvider(INK, new DivertCompletionProvider(), '>', '-', ' '),
        languages.registerDefinitionProvider(INK, new InkDivertDefinitionProvider()),
        languages.registerDefinitionProvider(INK, new InkFunctionDefinitionProvider()),
        languages.registerDefinitionProvider(INK, new InkVariableDefinitionProvider()),
        languages.registerCompletionItemProvider(INK, new InkStructureCompletionProvider(), '/'),
        languages.registerFoldingRangeProvider(INK, new InkFoldingProvider()),
        languages.registerDocumentSymbolProvider(INK, new InkDocumentSymbolProvider()),
        languages.registerHoverProvider(INK, new InkHoverProvider())
    );

    // Register everything for disposal.
    context.subscriptions.push(...disposables);
}