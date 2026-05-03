"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(extension_exports);
var import_vscode16 = require("vscode");

// src/controllers/NodeController.ts
var import_vscode4 = require("vscode");

// src/controllers/AbstractMapController.ts
var import_vscode = require("vscode");
var AbstractMapController = class {
  constructor(mapStore, matchTrigger, mapFromDocument) {
    this.mapStore = mapStore;
    this.matchTrigger = matchTrigger;
    this.mapFromDocument = mapFromDocument;
    const subscriptions = [
      import_vscode.workspace.onDidChangeTextDocument(this._handleTextChange, this)
    ];
    this._disposable = import_vscode.Disposable.from(...subscriptions);
  }
  _handleTextChange({ contentChanges, document }) {
    if (!contentChanges.some((change) => this.matchTrigger.test(change.text))) return;
    const { fsPath } = document.uri;
    this.mapStore[fsPath] = this.mapFromDocument(document);
  }
  dispose() {
    this._disposable.dispose();
  }
};
async function generateMapsFromFiles(loader) {
  const allFiles = await import_vscode.workspace.findFiles("**/*.ink");
  const uniqueFiles = Array.from(new Map(allFiles.map((f) => [f.fsPath, f])).values());
  const maps = await Promise.all(uniqueFiles.map((file) => loader(file.fsPath)));
  const result = {};
  for (const map of maps) {
    const key = map.filePath;
    result[key] = map;
  }
  return result;
}
function findDefinition(name, filePath, maps, extractor) {
  const local = maps[filePath];
  if (local) {
    const found = extractor(local).find((def) => def.name === name);
    if (found) return found;
  }
  for (const key in maps) {
    if (key === filePath) continue;
    const found = extractor(maps[key]).find((def) => def.name === name);
    if (found) return found;
  }
  return null;
}

// src/models/NodeMap.ts
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));

// src/models/KnotNode.ts
var import_vscode3 = require("vscode");

// src/models/DivertTarget.ts
var import_vscode2 = require("vscode");
var DivertTarget = class {
  constructor(name) {
    this.name = name;
  }
  get line() {
    throw new Error("Subclasses must implement 'line' getter");
  }
  get parentFile() {
    throw new Error("Subclasses must implement 'parentFile' getter");
  }
  toCompletionItem() {
    return new import_vscode2.CompletionItem(this.name ?? "", import_vscode2.CompletionItemKind.Reference);
  }
};

// src/models/LabelNode.ts
var LabelNode = class extends DivertTarget {
  constructor(name, _line, parentStitch) {
    super(name);
    this.name = name;
    this._line = _line;
    this.parentStitch = parentStitch;
  }
  get line() {
    return this._line + this.parentStitch.startLine;
  }
  get parentFile() {
    return this.parentStitch.parentKnot.parentFile;
  }
};

// src/models/StitchNode.ts
var StitchNode = class extends DivertTarget {
  constructor(name, _relativeStart, _relativeEnd, parentKnot, textContent, lastLine = false) {
    super(name);
    this.name = name;
    this._relativeStart = _relativeStart;
    this._relativeEnd = _relativeEnd;
    this.parentKnot = parentKnot;
    this.lastLine = lastLine;
    this.labels = this._extractLabels(textContent);
  }
  get line() {
    return this.startLine;
  }
  get startLine() {
    return this.parentKnot.startLine + this._relativeStart;
  }
  get endLine() {
    return this.parentKnot.startLine + this._relativeEnd + (this.lastLine ? 1 : 0);
  }
  get parentFile() {
    return this.parentKnot.parentFile;
  }
  _extractLabels(text) {
    const labelRegex = /^\s*(?:[-*+]\s*)+\((\w+)\)/;
    const lines = text.split("\n");
    const labels = [];
    for (let i = 0; i < lines.length; i++) {
      const match = labelRegex.exec(lines[i]);
      if (match) {
        labels.push(new LabelNode(match[1], i, this));
      }
    }
    return labels;
  }
};

// src/models/KnotNode.ts
var KnotNode = class extends DivertTarget {
  constructor(name, startLine, endLine, _parentFile, textContent, isFunction = false, lastLine = false) {
    super(name);
    this.name = name;
    this.startLine = startLine;
    this.endLine = endLine;
    this._parentFile = _parentFile;
    this.isFunction = isFunction;
    this.lastLine = lastLine;
    this.stitches = this._parseStitches(textContent);
  }
  get line() {
    return this.startLine;
  }
  get parentFile() {
    return this._parentFile;
  }
  toCompletionItem() {
    const itemKind = this.isFunction ? import_vscode3.CompletionItemKind.Function : import_vscode3.CompletionItemKind.Reference;
    return new import_vscode3.CompletionItem(this.name ?? "", itemKind);
  }
  _parseStitches(content) {
    const lines = content.split("\n");
    const stitches = [];
    const stitchRegex = /^\s*=\s*(\w+)/;
    let currentName = null;
    let currentStart = 0;
    let currentLines = [];
    const pushStitch = (end, isFinal = false) => {
      if (!currentName) return;
      const text = currentLines.join("\n");
      stitches.push(new StitchNode(currentName, currentStart, end, this, text, isFinal));
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = stitchRegex.exec(line);
      if (match) {
        if (currentLines.length > 0) {
          pushStitch(i);
        }
        currentName = match[1];
        currentStart = i;
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
      const isLastLine = i === lines.length - 1;
      if (isLastLine && currentName) {
        pushStitch(i + 1, this.lastLine);
      }
    }
    return stitches;
  }
};

// src/models/NodeMap.ts
var NodeMap = class _NodeMap {
  constructor(filePath, fileText) {
    this.filePath = filePath;
    const lines = fileText.split("\n");
    this.knots = this._parseKnots(lines);
    this.includes = this._parseIncludes(lines);
    console.log("Knots found:", this.knots.map((k) => k.name));
  }
  _parseKnots(lines) {
    const knots = [];
    const headerRegex = /^\s*===(\s*function)?\s*(\w+)/;
    let currentLines = [];
    let lastStart = 0;
    let lastName = null;
    let isFunction = false;
    const pushKnot = (end, isFinal = false) => {
      if (lastName !== null) {
        const content = currentLines.join("\n");
        knots.push(new KnotNode(lastName, lastStart, end, this, content, isFunction, isFinal));
      }
    };
    lines.forEach((line, index) => {
      const match = headerRegex.exec(line);
      if (match) {
        pushKnot(index);
        lastName = match[2];
        isFunction = !!match[1];
        lastStart = index;
        currentLines = [line];
      } else {
        currentLines.push(line);
        if (index === lines.length - 1) {
          pushKnot(index + 1, true);
        }
      }
    });
    return knots;
  }
  _parseIncludes(lines) {
    const includeRegex = /^\s*INCLUDE\s+(\w+\.ink)/;
    return lines.map((line) => includeRegex.exec(line)).filter(Boolean).map((match) => {
      const filename = match[1];
      return import_path.default.resolve(import_path.default.dirname(this.filePath), filename);
    });
  }
  static async loadFromFilePath(filePath) {
    try {
      const data = await import_fs.default.promises.readFile(filePath, "utf8");
      return new _NodeMap(filePath, data);
    } catch (err) {
      console.error("Error opening file:", err);
      return new _NodeMap(filePath, "");
    }
  }
  static nodeMapFromDocument(document) {
    return new _NodeMap(document.uri.fsPath, document.getText());
  }
};

// src/controllers/NodeController.ts
var nodeMaps = {};
var PERMANENT_DIVERTS = [
  new import_vscode4.CompletionItem("END", import_vscode4.CompletionItemKind.Keyword),
  new import_vscode4.CompletionItem("DONE", import_vscode4.CompletionItemKind.Keyword),
  new import_vscode4.CompletionItem("->", import_vscode4.CompletionItemKind.Keyword)
];
var NodeController = class extends AbstractMapController {
  constructor() {
    super(
      nodeMaps,
      /[\n*+\(\)\-=\[]/,
      // Trigger characters
      NodeMap.nodeMapFromDocument
    );
  }
};
async function generateNodeMaps() {
  try {
    const allFiles = await import_vscode4.workspace.findFiles("**/*.ink");
    const uniqueFiles = Array.from(new Map(allFiles.map((f) => [f.fsPath, f])).values());
    const maps = await Promise.all(uniqueFiles.map((f) => NodeMap.loadFromFilePath(f.fsPath)));
    maps.forEach((map) => {
      nodeMaps[map.filePath] = map;
    });
  } catch (err) {
    console.error("Error generating node maps:", err);
  }
}
function getDivertCompletionTargets(filePath, line) {
  return [
    ...getDivertsInScope(filePath, line).filter((target) => target.name).map((target) => target.toCompletionItem()),
    ...PERMANENT_DIVERTS
  ];
}
function stitchFor(filePath, line) {
  const map = nodeMaps[filePath];
  if (!map) return null;
  const knot = map.knots.find((k) => k.startLine <= line && k.endLine > line);
  if (!knot) return null;
  return knot.stitches.find((s) => s.startLine <= line && s.endLine > line) ?? null;
}
function getIncludeScope(filePath, visited = /* @__PURE__ */ new Set()) {
  if (visited.has(filePath)) return Array.from(visited);
  visited.add(filePath);
  const map = nodeMaps[filePath];
  if (!map) return Array.from(visited);
  for (const include of map.includes) {
    getIncludeScope(include, visited);
  }
  return Array.from(visited);
}
function getDivertsInScope(filePath, line) {
  const map = nodeMaps[filePath];
  if (!map) return [];
  const scopeFiles = getIncludeScope(filePath);
  const targets = scopeFiles.flatMap((path3) => nodeMaps[path3]?.knots ?? []);
  const stitch = stitchFor(filePath, line);
  if (stitch) {
    targets.push(...stitch.parentKnot.stitches);
    targets.push(...stitch.labels);
  }
  return targets;
}
function getDefinitionByNameAndScope(name, filePath, line) {
  let target = getDivertsInScope(filePath, line).find((t) => t.name === name);
  if (!target) {
    for (const key in nodeMaps) {
      target = getDivertsInScope(key, line).find((t) => t.name === name);
      if (target) break;
    }
  }
  if (!target) return;
  return new import_vscode4.Location(import_vscode4.Uri.file(target.parentFile.filePath), new import_vscode4.Position(target.line, 0));
}
function getNodeByNameAndScope(name, filePath, line) {
  let target = getDivertsInScope(filePath, line).find((t) => t.name === name);
  if (!target) {
    for (const key in nodeMaps) {
      target = getDivertsInScope(key, line).find((t) => t.name === name);
      if (target) break;
    }
  }
  return target;
}

// src/providers/InkDivertDefinitionProvider.ts
var InkDivertDefinitionProvider = class _InkDivertDefinitionProvider {
  static {
    this.divertRegex = /->\s*([\w.]+)/;
  }
  provideDefinition(document, position) {
    try {
      const lineText = document.lineAt(position.line).text;
      const cursorPos = position.character;
      const match = _InkDivertDefinitionProvider.divertRegex.exec(lineText.slice(0, cursorPos) + lineText.slice(cursorPos));
      if (!match) return;
      const [target] = match[1].split(".");
      return getDefinitionByNameAndScope(target, document.uri.fsPath, position.line);
    } catch (err) {
      console.error("Ink divert definition failed:", err);
      return;
    }
  }
};

// src/providers/InkFunctionDefinitionProvider.ts
var import_vscode5 = require("vscode");

// src/models/FunctionMap.ts
var fs2 = __toESM(require("fs"));
var FunctionMap = class _FunctionMap {
  constructor(filePath, functions, variables) {
    this.functions = [];
    this.variables = [];
    this.filePath = filePath;
    this.functions = functions;
    this.variables = variables;
  }
  static fromDocument(doc) {
    const filePath = doc.uri.fsPath;
    const text = doc.getText();
    const lines = text.split(/\r?\n/);
    const functions = [];
    const variables = [];
    lines.forEach((line, i) => {
      const externalMatch = line.match(/^\s*EXTERNAL\s+(\w+)\s*\(/i);
      if (externalMatch) {
        functions.push({
          name: externalMatch[1],
          line: i,
          filePath,
          type: "EXTERNAL"
        });
      }
      const functionMatch = line.match(/^\s*===\s*function\s+(\w+)\s*/i);
      if (functionMatch) {
        functions.push({
          name: functionMatch[1],
          line: i,
          filePath,
          type: "FUNCTION"
        });
      }
      const varMatch = line.match(/^\s*VAR\s+(\w+)\s*=/i);
      if (varMatch) {
        variables.push({
          name: varMatch[1],
          line: i,
          filePath,
          type: "VAR"
        });
      }
      const tempMatch = line.match(/^\s*~\s*temp\s+(\w+)\s*=/i);
      if (tempMatch) {
        variables.push({
          name: tempMatch[1],
          line: i,
          filePath,
          type: "TEMP"
        });
      }
    });
    return new _FunctionMap(filePath, functions, variables);
  }
  static async from(filePath) {
    const content = fs2.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const functions = [];
    const variables = [];
    lines.forEach((line, i) => {
      const externalMatch = line.match(/^\s*EXTERNAL\s+(\w+)\s*\(/i);
      if (externalMatch) {
        functions.push({
          name: externalMatch[1],
          line: i,
          filePath,
          type: "EXTERNAL"
        });
      }
      const functionMatch = line.match(/^\s*===\s*function\s+(\w+)\s*/i);
      if (functionMatch) {
        functions.push({
          name: functionMatch[1],
          line: i,
          filePath,
          type: "FUNCTION"
        });
      }
      const varMatch = line.match(/^\s*VAR\s+(\w+)\s*=/i);
      if (varMatch) {
        variables.push({
          name: varMatch[1],
          line: i,
          filePath,
          type: "VAR"
        });
      }
      const tempMatch = line.match(/^\s*~\s*temp\s+(\w+)\s*=/i);
      if (tempMatch) {
        variables.push({
          name: tempMatch[1],
          line: i,
          filePath,
          type: "TEMP"
        });
      }
    });
    return new _FunctionMap(filePath, functions, variables);
  }
};

// src/controllers/FunctionController.ts
var functionMaps = {};
var FunctionController = class extends AbstractMapController {
  constructor() {
    super(functionMaps, /[\n=]|EXTERNAL/, FunctionMap.fromDocument);
  }
};
async function generateFunctionMaps() {
  Object.assign(functionMaps, await generateMapsFromFiles(FunctionMap.from));
}
function getFunctionDefinitionByName(name, filePath) {
  return findDefinition(name, filePath, functionMaps, (m) => m.functions);
}
function getVariableDefinitionByName(name, filePath) {
  return findDefinition(name, filePath, functionMaps, (m) => m.variables);
}

// src/providers/InkFunctionDefinitionProvider.ts
var InkFunctionDefinitionProvider = class _InkFunctionDefinitionProvider {
  static {
    this.functionCallRegex = /\b([\w]+)\s*/;
  }
  provideDefinition(document, position) {
    try {
      const lineText = document.lineAt(position.line).text;
      if (!lineText.trimStart().startsWith("~")) return;
      const match = _InkFunctionDefinitionProvider.functionCallRegex.exec(lineText);
      if (!match) return;
      const functionName = match[1];
      const result = getFunctionDefinitionByName(functionName, document.uri.fsPath);
      if (!result) return;
      return new import_vscode5.Location(import_vscode5.Uri.file(result.filePath), new import_vscode5.Position(result.line, 0));
    } catch (err) {
      console.error("Ink function definition failed:", err);
      return;
    }
  }
};

// src/providers/DivertCompletionProvider.ts
var import_vscode6 = require("vscode");
var DivertCompletionProvider = class _DivertCompletionProvider {
  static {
    this.divertPattern = /(->|<-) ?$/;
  }
  static {
    this.doubleArrowPattern = /-> ?-> ?$/;
  }
  provideCompletionItems(document, position) {
    const lineText = document.getText(new import_vscode6.Range(
      position.with(position.line, 0),
      position
    ));
    if (!_DivertCompletionProvider.divertPattern.test(lineText)) return;
    if (_DivertCompletionProvider.doubleArrowPattern.test(lineText)) return;
    return getDivertCompletionTargets(document.uri.fsPath, position.line);
  }
};

// src/providers/InkVariableDefinitionProvider.ts
var import_vscode7 = require("vscode");
var InkVariableDefinitionProvider = class {
  provideDefinition(document, position) {
    try {
      const wordRange = document.getWordRangeAtPosition(position);
      if (!wordRange) return;
      const variableName = document.getText(wordRange);
      if (!variableName) return;
      const result = getVariableDefinitionByName(variableName, document.uri.fsPath);
      if (!result) return;
      return new import_vscode7.Location(import_vscode7.Uri.file(result.filePath), new import_vscode7.Position(result.line, 0));
    } catch (err) {
      console.error("Ink variable definition failed:", err);
      return;
    }
  }
};

// src/providers/InkFoldingProvider.ts
var import_vscode8 = require("vscode");
function choiceDepth(lineText) {
  const m = /^\s*([*+][*+\s]*)/.exec(lineText);
  if (!m) return 0;
  return (m[1].match(/[*+]/g) || []).length;
}
function gatherDepth(lineText) {
  const trimmed = lineText.trimStart();
  if (!trimmed.startsWith("-") || trimmed.startsWith("->")) return 0;
  const m = /^\s*([-][\-\s]*)/.exec(lineText);
  return m ? (m[1].match(/-/g) || []).length : 0;
}
var SECTION_HEADER_REGEX = /^\s*={1,3}\s*\w/;
var InkFoldingProvider = class {
  provideFoldingRanges(document) {
    const nodeMap = NodeMap.nodeMapFromDocument(document);
    const ranges = [];
    for (const knot of nodeMap.knots) {
      if (knot.endLine - 1 > knot.startLine) {
        ranges.push(new import_vscode8.FoldingRange(knot.startLine, knot.endLine - 1, import_vscode8.FoldingRangeKind.Region));
      }
      for (const stitch of knot.stitches) {
        if (stitch.endLine - 1 > stitch.startLine) {
          ranges.push(new import_vscode8.FoldingRange(stitch.startLine, stitch.endLine - 1, import_vscode8.FoldingRangeKind.Region));
        }
        for (let i = 0; i < stitch.labels.length; i++) {
          const labelStart = stitch.labels[i].line;
          const labelEnd = i + 1 < stitch.labels.length ? stitch.labels[i + 1].line - 1 : stitch.endLine - 1;
          if (labelEnd > labelStart) {
            ranges.push(new import_vscode8.FoldingRange(labelStart, labelEnd, import_vscode8.FoldingRangeKind.Region));
          }
        }
      }
    }
    for (let i = 0; i < document.lineCount; i++) {
      const depth = choiceDepth(document.lineAt(i).text);
      if (depth === 0) continue;
      let end = document.lineCount - 1;
      for (let j = i + 1; j < document.lineCount; j++) {
        const jText = document.lineAt(j).text;
        const jChoice = choiceDepth(jText);
        if (jChoice > 0 && jChoice <= depth) {
          end = j - 1;
          break;
        }
        const jGather = gatherDepth(jText);
        if (jGather > 0 && jGather <= depth) {
          end = j - 1;
          break;
        }
        if (SECTION_HEADER_REGEX.test(jText)) {
          end = j - 1;
          break;
        }
      }
      if (end > i) {
        ranges.push(new import_vscode8.FoldingRange(i, end));
      }
    }
    return ranges;
  }
};

// src/providers/InkDocumentSymbolProvider.ts
var import_vscode9 = require("vscode");
var LABEL_REGEX = /^\s*(?:[-*+]\s*)+\((\w+)\)/;
function extractChoiceText(lineText) {
  const m = /^\s*[*+][*+\s]*(?!\()(.+)/.exec(lineText);
  if (!m) return null;
  let text = m[1].trim();
  text = text.replace(/^\{[^}]*\}\s*/g, "").trim();
  const bracketMatch = /^\[([^\]]*)\]/.exec(text);
  if (bracketMatch) return bracketMatch[1].trim() || null;
  return text.substring(0, 60).trim() || null;
}
var InkDocumentSymbolProvider = class {
  provideDocumentSymbols(document) {
    const nodeMap = NodeMap.nodeMapFromDocument(document);
    const symbols = [];
    for (const knot of nodeMap.knots) {
      const kind = knot.isFunction ? import_vscode9.SymbolKind.Function : import_vscode9.SymbolKind.Module;
      const knotRange = new import_vscode9.Range(knot.startLine, 0, knot.endLine - 1, 0);
      const knotSelection = document.lineAt(knot.startLine).range;
      const knotSymbol = new import_vscode9.DocumentSymbol(knot.name ?? "", "", kind, knotRange, knotSelection);
      const stitchSymbolsByLine = /* @__PURE__ */ new Map();
      for (const stitch of knot.stitches) {
        const stitchRange = new import_vscode9.Range(stitch.startLine, 0, stitch.endLine - 1, 0);
        const stitchSel = document.lineAt(stitch.startLine).range;
        stitchSymbolsByLine.set(
          stitch.startLine,
          new import_vscode9.DocumentSymbol(stitch.name, "", import_vscode9.SymbolKind.Method, stitchRange, stitchSel)
        );
      }
      let currentParent = knotSymbol;
      for (let i = knot.startLine + 1; i < knot.endLine && i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        const stitchSymbol = stitchSymbolsByLine.get(i);
        if (stitchSymbol) {
          knotSymbol.children.push(stitchSymbol);
          currentParent = stitchSymbol;
          continue;
        }
        const labelMatch = LABEL_REGEX.exec(lineText);
        if (labelMatch) {
          const lr = document.lineAt(i).range;
          currentParent.children.push(new import_vscode9.DocumentSymbol(labelMatch[1], "", import_vscode9.SymbolKind.Field, lr, lr));
        } else {
          const choiceText = extractChoiceText(lineText);
          if (choiceText) {
            const lr = document.lineAt(i).range;
            currentParent.children.push(new import_vscode9.DocumentSymbol(choiceText, "", import_vscode9.SymbolKind.Property, lr, lr));
          }
        }
      }
      symbols.push(knotSymbol);
    }
    return symbols;
  }
};

// src/controllers/InkDecorationController.ts
var import_vscode10 = require("vscode");
var InkDecorationController = class {
  constructor() {
    this._knotDecoration = import_vscode10.window.createTextEditorDecorationType({
      overviewRulerColor: "#6796E6",
      overviewRulerLane: import_vscode10.OverviewRulerLane.Right
    });
    this._stitchDecoration = import_vscode10.window.createTextEditorDecorationType({
      overviewRulerColor: "#B5CEA8",
      overviewRulerLane: import_vscode10.OverviewRulerLane.Right
    });
    this._labelDecoration = import_vscode10.window.createTextEditorDecorationType({
      overviewRulerColor: "#CE9178",
      overviewRulerLane: import_vscode10.OverviewRulerLane.Right
    });
    this._disposable = import_vscode10.Disposable.from(
      import_vscode10.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this._applyDecorations(editor);
      }),
      import_vscode10.workspace.onDidChangeTextDocument((event) => {
        const editor = import_vscode10.window.activeTextEditor;
        if (editor && editor.document === event.document) {
          this._applyDecorations(editor);
        }
      })
    );
    if (import_vscode10.window.activeTextEditor) {
      this._applyDecorations(import_vscode10.window.activeTextEditor);
    }
  }
  _applyDecorations(editor) {
    if (editor.document.languageId !== "ink") {
      editor.setDecorations(this._knotDecoration, []);
      editor.setDecorations(this._stitchDecoration, []);
      editor.setDecorations(this._labelDecoration, []);
      return;
    }
    const nodeMap = NodeMap.nodeMapFromDocument(editor.document);
    const knotRanges = [];
    const stitchRanges = [];
    const labelRanges = [];
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
  dispose() {
    this._knotDecoration.dispose();
    this._stitchDecoration.dispose();
    this._labelDecoration.dispose();
    this._disposable.dispose();
  }
};

// src/providers/InkStructureCompletionProvider.ts
var import_vscode11 = require("vscode");
var STRUCTURES = [
  { label: "knot", detail: "=== knot_name ===", snippet: "=== ${1:knot_name} ===\n$0\n-" },
  { label: "stitch", detail: "= stitch_name", snippet: "= ${1:stitch_name}\n$0" },
  { label: "func", detail: "=== function name(params) ===", snippet: "=== function ${1:name}(${2:params}) ===\n	~ return $0" },
  { label: "VAR", detail: "VAR name = value", snippet: "VAR ${1:name} = ${2:value}" },
  { label: "CONST", detail: "CONST name = value", snippet: "CONST ${1:name} = ${2:value}" },
  { label: "LIST", detail: "LIST name = item1, item2", snippet: "LIST ${1:name} = ${2:item1}, ${3:item2}" },
  { label: "INCLUDE", detail: "INCLUDE file.ink", snippet: "INCLUDE ${1:file}.ink" },
  { label: "choice", detail: "* [text]", snippet: "* [${1:text}]$0" },
  { label: "nchoice", detail: "* (label) [text]", snippet: "* (${1:label}) [${2:text}]$0" },
  { label: "schoice", detail: "+ [text]  (sticky)", snippet: "+ [${1:text}]$0" },
  { label: "cond", detail: "{condition: true | false}", snippet: "{${1:condition}: ${2:if true}|${3:if false}}" },
  { label: "if", detail: "{ condition: ... - else: ... }", snippet: "{ ${1:condition}:\n	${2:// if true}\n- else:\n	${3:// if false}\n}" },
  { label: "ifelseif", detail: "{ condition: ... - else if ... }", snippet: "{ ${1:condition}:\n	${2:// if true}\n- else if ${3:other}:\n	${4:// else if}\n- else:\n	${5:// else}\n}" },
  { label: "->", detail: "-> divert target", snippet: "-> ${1:target}" },
  { label: "->->", detail: "-> tunnel ->", snippet: "-> ${1:target} ->" },
  { label: "<-", detail: "<- thread", snippet: "<- ${1:target}" },
  { label: "~ ", detail: "~ variable = value", snippet: "~ ${1:variable} = ${2:value}" },
  { label: "temp", detail: "~ temp name = value", snippet: "~ temp ${1:name} = ${2:value}" },
  { label: "tag", detail: "# tag", snippet: "# ${1:tag}" },
  { label: "glabel", detail: "- (label_name)  (gather with label)", snippet: "- (${1:label_name})$0" },
  { label: "TODO", detail: "TODO: description", snippet: "TODO: ${1:description}" }
];
var InkStructureCompletionProvider = class {
  provideCompletionItems(document, position) {
    const lineText = document.getText(new import_vscode11.Range(position.with(void 0, 0), position));
    const match = /^(\s*)\/(\S*)$/.exec(lineText);
    if (!match) return;
    const slashStart = match[1].length;
    const replaceRange = new import_vscode11.Range(position.line, slashStart, position.line, position.character);
    return STRUCTURES.map((entry, index) => {
      const item = new import_vscode11.CompletionItem(entry.label, import_vscode11.CompletionItemKind.Snippet);
      item.detail = entry.detail;
      item.insertText = new import_vscode11.SnippetString(entry.snippet);
      item.filterText = "/" + entry.label;
      item.range = replaceRange;
      item.sortText = String(index).padStart(4, "0");
      return item;
    });
  }
};

// src/providers/InkHoverProvider.ts
var import_vscode12 = require("vscode");
var InkHoverProvider = class _InkHoverProvider {
  static {
    this.divertRegex = /->\s*([\w.]+)/g;
  }
  provideHover(document, position) {
    const lineText = document.lineAt(position.line).text;
    let match;
    const regex = new RegExp(_InkHoverProvider.divertRegex.source, "g");
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
      const md = new import_vscode12.MarkdownString();
      md.appendCodeblock(node.name ?? "", "ink");
      md.appendMarkdown(preview);
      return new import_vscode12.Hover(md, new import_vscode12.Range(position.line, nameStart, position.line, nameEnd));
    }
  }
  _extractPreview(document, node) {
    const startLine = node.startLine ?? node.line;
    const endLine = node.endLine ?? startLine + 1;
    const lines = [];
    for (let i = startLine + 1; i < Math.min(endLine, startLine + 20); i++) {
      const text = document.lineAt(i).text.trim();
      if (!text || text.startsWith("//") || text.startsWith("/*") || text.startsWith("~") || text.startsWith("->") || text.startsWith("*") || text.startsWith("+") || text.startsWith("-") || text.startsWith("=")) continue;
      lines.push(text);
      if (lines.length >= 3) break;
    }
    return lines.join("\n\n");
  }
};

// src/controllers/InkDiagnosticsController.ts
var import_vscode13 = require("vscode");
var PERMANENT_TARGETS = /* @__PURE__ */ new Set(["END", "DONE"]);
var DIVERT_REGEX = /->\s*([\w.]+)/g;
var LABEL_SCAN_REGEX = /(?:[-*+]\s*)+\((\w+)\)/;
function buildLocalTargetSet(document) {
  const nodeMap = NodeMap.nodeMapFromDocument(document);
  const names = /* @__PURE__ */ new Set();
  for (const knot of nodeMap.knots) {
    if (knot.name) names.add(knot.name);
    for (const stitch of knot.stitches) {
      names.add(stitch.name);
    }
  }
  for (let i = 0; i < document.lineCount; i++) {
    const m = LABEL_SCAN_REGEX.exec(document.lineAt(i).text);
    if (m) names.add(m[1]);
  }
  return names;
}
var InkDiagnosticsController = class {
  constructor() {
    this._collection = import_vscode13.languages.createDiagnosticCollection("ink");
    this._disposable = import_vscode13.Disposable.from(
      import_vscode13.workspace.onDidOpenTextDocument((doc) => this._validate(doc)),
      import_vscode13.workspace.onDidChangeTextDocument(({ document }) => this._validate(document)),
      import_vscode13.workspace.onDidCloseTextDocument((doc) => this._collection.delete(doc.uri))
    );
    import_vscode13.workspace.textDocuments.forEach((doc) => this._validate(doc));
  }
  _validate(document) {
    if (document.languageId !== "ink") return;
    const localTargets = buildLocalTargetSet(document);
    const diagnostics = [];
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      const lineText = document.lineAt(lineIndex).text;
      const regex = new RegExp(DIVERT_REGEX.source, "g");
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        const [targetName] = match[1].split(".");
        if (PERMANENT_TARGETS.has(targetName)) continue;
        if (localTargets.has(targetName)) continue;
        if (getDefinitionByNameAndScope(targetName, document.uri.fsPath, lineIndex)) continue;
        const nameStart = match.index + match[0].indexOf(match[1]);
        const range = new import_vscode13.Range(
          new import_vscode13.Position(lineIndex, nameStart),
          new import_vscode13.Position(lineIndex, nameStart + targetName.length)
        );
        diagnostics.push(new import_vscode13.Diagnostic(
          range,
          `Unknown divert target: '${targetName}'`,
          import_vscode13.DiagnosticSeverity.Error
        ));
      }
    }
    this._collection.set(document.uri, diagnostics);
  }
  dispose() {
    this._collection.dispose();
    this._disposable.dispose();
  }
};

// src/providers/InkKnotGraphProvider.ts
var vscode = __toESM(require("vscode"));

// src/utils/inkParser.ts
var DIVERT_REGEX2 = /->\s*([\w.]+)/g;
var SKIP_TARGETS = /* @__PURE__ */ new Set(["END", "DONE", "->"]);
var KNOT_HEADER_REGEX = /^\s*===(\s*function)?\s*(\w+)/;
function parseKnots(lines) {
  const knots = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const match = KNOT_HEADER_REGEX.exec(lines[i]);
    if (match) {
      if (current) {
        knots.push({ ...current, endLine: i });
      }
      current = { name: match[2], startLine: i, isFunction: !!match[1]?.trim() };
    }
  }
  if (current) {
    knots.push({ ...current, endLine: lines.length });
  }
  return knots;
}
function extractDiverts(lines, knot) {
  const targets = [];
  const end = Math.min(knot.endLine, lines.length);
  for (let i = knot.startLine; i < end; i++) {
    const line = lines[i];
    if (/^\s*\/\//.test(line)) continue;
    DIVERT_REGEX2.lastIndex = 0;
    let match;
    while ((match = DIVERT_REGEX2.exec(line)) !== null) {
      const baseName = match[1].split(".")[0];
      if (baseName && !SKIP_TARGETS.has(baseName)) {
        targets.push(baseName);
      }
    }
  }
  return targets;
}

// src/providers/InkKnotGraphProvider.ts
var KnotGraphItem = class extends vscode.TreeItem {
  constructor(kind, label, knotName, targetLine, collapsible, exists = true) {
    super(label, collapsible);
    this.kind = kind;
    this.knotName = knotName;
    this.targetLine = targetLine;
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
};
var InkKnotGraphProvider = class {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.fileLines = [];
    this.parsedKnots = [];
  }
  setActiveFile(filePath, text) {
    this.fileLines = text.split("\n");
    this.parsedKnots = parseKnots(this.fileLines);
    this._onDidChangeTreeData.fire();
  }
  refresh() {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === "ink") {
      this.setActiveFile(editor.document.uri.fsPath, editor.document.getText());
    } else {
      this._onDidChangeTreeData.fire();
    }
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
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
  _getKnotItems() {
    const knotNames = new Set(this.parsedKnots.map((k) => k.name));
    return this.parsedKnots.map((knot) => {
      const unique = [...new Set(extractDiverts(this.fileLines, knot))];
      const collapsible = unique.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
      const label = knot.isFunction ? `${knot.name} (function)` : knot.name;
      const item = new KnotGraphItem(
        "knot",
        label,
        knot.isFunction ? "__function__" : knot.name,
        knot.startLine,
        collapsible,
        !knot.isFunction
      );
      item.description = unique.length > 0 ? `${unique.length} divert${unique.length > 1 ? "s" : ""}` : void 0;
      return item;
    });
  }
  _getDivertItems(knotItem) {
    const knot = this.parsedKnots.find((k) => k.startLine === knotItem.targetLine);
    if (!knot) return [];
    const knotNames = new Set(this.parsedKnots.map((k) => k.name));
    const seen = /* @__PURE__ */ new Set();
    return extractDiverts(this.fileLines, knot).filter((target) => {
      if (seen.has(target)) return false;
      seen.add(target);
      return true;
    }).map((target) => {
      const exists = knotNames.has(target);
      const targetKnot = this.parsedKnots.find((k) => k.name === target);
      return new KnotGraphItem(
        "divert",
        `\u2192 ${target}`,
        target,
        targetKnot ? targetKnot.startLine : 0,
        vscode.TreeItemCollapsibleState.None,
        exists
      );
    });
  }
};

// src/providers/InkGraphWebviewProvider.ts
var vscode2 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var InkGraphWebviewProvider = class _InkGraphWebviewProvider {
  static createOrShow(context, filePath, text) {
    const column = vscode2.window.activeTextEditor ? vscode2.window.activeTextEditor.viewColumn + 1 : vscode2.ViewColumn.Two;
    if (_InkGraphWebviewProvider.currentPanel) {
      _InkGraphWebviewProvider.currentPanel.reveal(column);
      _InkGraphWebviewProvider.update(filePath, text);
      return;
    }
    const panel = vscode2.window.createWebviewPanel(
      "inkKnotGraphVisual",
      "Ink: Knot Graph",
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.webview.html = _InkGraphWebviewProvider._getHtml();
    panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          await _InkGraphWebviewProvider._handleMessage(message);
        } catch (err) {
          console.error("InkGraphWebview error:", err);
        }
      },
      void 0,
      context.subscriptions
    );
    panel.onDidDispose(() => {
      _InkGraphWebviewProvider.currentPanel = void 0;
    }, null, context.subscriptions);
    _InkGraphWebviewProvider.currentPanel = panel;
    _InkGraphWebviewProvider.currentFilePath = filePath;
    setTimeout(() => _InkGraphWebviewProvider.update(filePath, text), 150);
  }
  static async _handleMessage(message) {
    const filePath = _InkGraphWebviewProvider.currentFilePath;
    if (!filePath) return;
    switch (message.command) {
      case "revealKnot": {
        const doc = await vscode2.workspace.openTextDocument(filePath);
        const editor = await vscode2.window.showTextDocument(doc, {
          preserveFocus: false,
          preview: false,
          viewColumn: vscode2.ViewColumn.One
        });
        const pos = new vscode2.Position(message.line, 0);
        editor.selection = new vscode2.Selection(pos, pos);
        editor.revealRange(new vscode2.Range(pos, pos), vscode2.TextEditorRevealType.AtTop);
        break;
      }
      case "requestAddKnot": {
        const name = await vscode2.window.showInputBox({
          prompt: "Enter a name for the new knot",
          placeHolder: "knot_name",
          validateInput: (v) => /^\w+$/.test(v) ? null : "Use only letters, numbers and underscores"
        });
        if (name) {
          await _InkGraphWebviewProvider._addKnotToFile(filePath, name);
        }
        break;
      }
      case "addDivert": {
        if (message.from && message.to && message.from !== message.to) {
          await _InkGraphWebviewProvider._addDivertToFile(filePath, message.from, message.to);
        }
        break;
      }
      case "removeDivert": {
        const answer = await vscode2.window.showWarningMessage(
          `Remove divert "${message.from} \u2192 ${message.to}"?`,
          { modal: true },
          "Remove"
        );
        if (answer === "Remove") {
          await _InkGraphWebviewProvider._removeDivertFromFile(filePath, message.from, message.to);
        }
        break;
      }
      case "removeKnot": {
        const answer = await vscode2.window.showWarningMessage(
          `Delete knot "${message.name}" and all its content?`,
          { modal: true },
          "Delete"
        );
        if (answer === "Delete") {
          await _InkGraphWebviewProvider._removeKnotFromFile(filePath, message.name);
        }
        break;
      }
    }
  }
  // ── File mutation helpers ──────────────────────────────────────────────────
  static async _addKnotToFile(filePath, name) {
    const doc = await vscode2.workspace.openTextDocument(filePath);
    const edit = new vscode2.WorkspaceEdit();
    const lastLine = doc.lineCount - 1;
    const lastLineText = doc.lineAt(lastLine).text;
    const prefix = lastLineText.trim() ? "\n" : "";
    edit.insert(doc.uri, new vscode2.Position(doc.lineCount, 0), `${prefix}
=== ${name} ===

`);
    await vscode2.workspace.applyEdit(edit);
  }
  static async _addDivertToFile(filePath, fromKnot, toKnot) {
    const doc = await vscode2.workspace.openTextDocument(filePath);
    const lines = doc.getText().split("\n");
    const knots = parseKnots(lines);
    const knot = knots.find((k) => k.name === fromKnot);
    if (!knot) return;
    const existing = extractDiverts(lines, knot);
    if (existing.includes(toKnot)) {
      vscode2.window.showInformationMessage(`Divert "${fromKnot} \u2192 ${toKnot}" already exists.`);
      return;
    }
    let insertAt = knot.endLine - 1;
    while (insertAt > knot.startLine && lines[insertAt]?.trim() === "") {
      insertAt--;
    }
    const edit = new vscode2.WorkspaceEdit();
    edit.insert(doc.uri, new vscode2.Position(insertAt + 1, 0), `-> ${toKnot}
`);
    await vscode2.workspace.applyEdit(edit);
  }
  static async _removeDivertFromFile(filePath, fromKnot, toKnot) {
    const doc = await vscode2.workspace.openTextDocument(filePath);
    const lines = doc.getText().split("\n");
    const knots = parseKnots(lines);
    const knot = knots.find((k) => k.name === fromKnot);
    if (!knot) return;
    const edit = new vscode2.WorkspaceEdit();
    let removed = false;
    for (let i = knot.startLine; i < knot.endLine && !removed; i++) {
      const line = lines[i];
      if (new RegExp(`^\\s*->\\s*${toKnot}\\s*$`).test(line)) {
        edit.delete(doc.uri, new vscode2.Range(new vscode2.Position(i, 0), new vscode2.Position(i + 1, 0)));
        removed = true;
      } else {
        const m = line.match(new RegExp(`^(.*?)\\s*->\\s*${toKnot}\\s*$`));
        if (m) {
          edit.replace(doc.uri, new vscode2.Range(new vscode2.Position(i, 0), new vscode2.Position(i, line.length)), m[1].trimEnd());
          removed = true;
        }
      }
    }
    if (removed) {
      await vscode2.workspace.applyEdit(edit);
    } else {
      vscode2.window.showWarningMessage(`Could not auto-remove divert to "${toKnot}" \u2014 it may be inside a conditional expression.`);
    }
  }
  static async _removeKnotFromFile(filePath, knotName) {
    const doc = await vscode2.workspace.openTextDocument(filePath);
    const lines = doc.getText().split("\n");
    const knots = parseKnots(lines);
    const knot = knots.find((k) => k.name === knotName);
    if (!knot) return;
    const edit = new vscode2.WorkspaceEdit();
    edit.delete(doc.uri, new vscode2.Range(
      new vscode2.Position(knot.startLine, 0),
      new vscode2.Position(knot.endLine, 0)
    ));
    await vscode2.workspace.applyEdit(edit);
  }
  // ── Public update ─────────────────────────────────────────────────────────
  static update(filePath, text) {
    if (!_InkGraphWebviewProvider.currentPanel) return;
    _InkGraphWebviewProvider.currentFilePath = filePath;
    const lines = text.split("\n");
    const knots = parseKnots(lines);
    const knotNames = new Set(knots.map((k) => k.name));
    const nodes = knots.map((knot) => ({
      id: knot.name,
      label: knot.name,
      line: knot.startLine,
      isFunction: knot.isFunction
    }));
    const edgeMap = /* @__PURE__ */ new Map();
    const edges = [];
    for (const knot of knots) {
      for (const target of new Set(extractDiverts(lines, knot))) {
        const key = `${knot.name}\u2192${target}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, true);
          edges.push({ id: key, from: knot.name, to: target, exists: knotNames.has(target) });
        }
      }
    }
    _InkGraphWebviewProvider.currentPanel.webview.postMessage({
      command: "update",
      nodes,
      edges,
      fileName: path2.basename(filePath)
    });
  }
  static isOpen() {
    return !!_InkGraphWebviewProvider.currentPanel;
  }
  // ── HTML ──────────────────────────────────────────────────────────────────
  static _getHtml() {
    return (
      /* html */
      `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://unpkg.com 'unsafe-inline'; style-src 'unsafe-inline';">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1e1e1e; overflow:hidden; font-family: Consolas,'Courier New',monospace; color:#d4d4d4; }
#graph { width:100vw; height:100vh; }

/* \u2500\u2500 Toolbar \u2500\u2500 */
#toolbar {
  position:absolute; top:0; left:0; right:0; height:40px;
  background:#252526; border-bottom:1px solid #3e3e3e;
  display:flex; align-items:center; padding:0 10px; gap:8px;
  z-index:20; user-select:none;
}
#file-title { flex:1; font-size:11px; color:#858585; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tb-btn {
  background:#3c3c3c; border:1px solid #555; color:#d4d4d4;
  padding:3px 10px; border-radius:3px; font-size:11px; cursor:pointer;
  white-space:nowrap; transition: background 0.1s;
}
.tb-btn:hover { background:#4f4f4f; }
.tb-btn.active { background:#0e639c; border-color:#1177bb; color:#fff; }

/* \u2500\u2500 Edit hint bar \u2500\u2500 */
#edit-hint {
  position:absolute; bottom:0; left:0; right:0; height:28px;
  background:#0e639c; display:flex; align-items:center; justify-content:center;
  font-size:11px; color:#cce7ff; z-index:20;
  transition: opacity 0.2s;
}
#edit-hint.hidden { opacity:0; pointer-events:none; }

/* \u2500\u2500 vis manipulation toolbar override \u2500\u2500 */
.vis-manipulation {
  background:#252526 !important; border-bottom:1px solid #3e3e3e !important;
  display:none !important;  /* we drive it programmatically */
}

/* \u2500\u2500 Context menu \u2500\u2500 */
#ctx-menu {
  position:absolute; background:#252526; border:1px solid #454545;
  border-radius:4px; padding:4px 0; z-index:30; min-width:160px;
  box-shadow:0 4px 12px rgba(0,0,0,0.5);
}
#ctx-menu.hidden { display:none; }
#ctx-menu li { list-style:none; padding:6px 14px; font-size:12px; cursor:pointer; }
#ctx-menu li:hover { background:#094771; }
#ctx-menu li.danger:hover { background:#6e1414; }
#ctx-menu .sep { border-top:1px solid #454545; margin:4px 0; padding:0; cursor:default; }
#ctx-menu .sep:hover { background:transparent; }

/* \u2500\u2500 Delete button (selected state) \u2500\u2500 */
#btn-delete { display:none; }
#btn-delete.visible { display:inline-block; background:#6e1414; border-color:#a02020; }
#btn-delete.visible:hover { background:#8a1818; }
</style>
</head>
<body>

<div id="toolbar">
  <span id="file-title">Ink Knot Graph</span>
  <button class="tb-btn" id="btn-fit" title="Fit all nodes in view">\u229E Fit</button>
  <button class="tb-btn" id="btn-add-knot" title="Create a new knot">+ Knot</button>
  <button class="tb-btn" id="btn-delete" title="Delete selected node or edge">\u2715 Delete</button>
  <button class="tb-btn" id="btn-edit" title="Toggle edit mode to add/remove connections">\u270E Edit Mode</button>
</div>

<div id="graph"></div>

<div id="edit-hint" class="hidden">
  Edit mode &mdash; Drag between nodes to add a divert &nbsp;\xB7&nbsp; Select a node or edge then click <strong>\u2715 Delete</strong>
</div>

<ul id="ctx-menu" class="hidden">
  <li id="ctx-goto">\u2197 Go to section</li>
  <li id="ctx-add-divert">\u27F6 Add divert to\u2026</li>
  <li class="sep"></li>
  <li id="ctx-remove-edge" class="danger">\u2715 Remove this divert</li>
  <li id="ctx-remove-node" class="danger">\u2715 Delete knot</li>
</ul>

<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<script>
(function() {
  const vscodeApi = acquireVsCodeApi();
  const container = document.getElementById('graph');

  // \u2500\u2500 DataSets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const nodesDs = new vis.DataSet([]);
  const edgesDs = new vis.DataSet([]);

  // \u2500\u2500 State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  let editMode = false;
  let ctxTarget = null; // { type: 'node'|'edge', id }

  // \u2500\u2500 vis options \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const options = {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        sortMethod: 'directed',
        levelSeparation: 110,
        nodeSpacing: 160,
        treeSpacing: 200,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true,
        shakeTowards: 'leaves'
      }
    },
    physics: { enabled: false },
    nodes: {
      shape: 'box',
      margin: 8,
      font: { color: '#d4d4d4', size: 13, face: 'Consolas,monospace', bold: { color: '#fff' } },
      borderWidth: 1.5,
      borderWidthSelected: 2.5,
      color: {
        border: '#3a7ec8',
        background: '#1f3f5e',
        highlight: { border: '#569cd6', background: '#0e4a7a' },
        hover: { border: '#569cd6', background: '#163a5c' }
      },
      shapeProperties: { borderRadius: 4 }
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 0.7 } },
      color: { color: '#3a7a3a', highlight: '#6a9955', hover: '#6a9955', inherit: false },
      width: 1.5,
      smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
      selectionWidth: 2.5
    },
    interaction: {
      hover: true,
      tooltipDelay: 300,
      dragNodes: true,
      dragView: true,
      zoomView: true,
      selectConnectedEdges: false
    },
    manipulation: {
      enabled: false,
      addNode: false,
      editNode: false,
      editEdge: false,
      addEdge: (data, callback) => {
        if (data.from !== data.to) {
          vscodeApi.postMessage({ command: 'addDivert', from: data.from, to: data.to });
        }
        callback(null); // don't add visually \u2014 file change will refresh
        // Re-enter add-edge mode so user can keep adding
        setTimeout(() => { if (editMode) network.addEdgeMode(); }, 50);
      },
      deleteNode: (data, callback) => {
        data.nodes.forEach(id => vscodeApi.postMessage({ command: 'removeKnot', name: id }));
        callback(null);
      },
      deleteEdge: (data, callback) => {
        data.edges.forEach(eid => {
          const e = edgesDs.get(eid);
          if (e) vscodeApi.postMessage({ command: 'removeDivert', from: e.from, to: e.to });
        });
        callback(null);
      }
    }
  };

  const network = new vis.Network(container, { nodes: nodesDs, edges: edgesDs }, options);

  // \u2500\u2500 Edit mode toggle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const btnEdit = document.getElementById('btn-edit');
  const btnDelete = document.getElementById('btn-delete');
  const editHint = document.getElementById('edit-hint');

  function setEditMode(val) {
    editMode = val;
    btnEdit.classList.toggle('active', val);
    editHint.classList.toggle('hidden', !val);

    if (val) {
      network.setOptions({ manipulation: { enabled: true } });
      network.addEdgeMode();
    } else {
      network.disableEditMode();
      network.setOptions({ manipulation: { enabled: false } });
    }
    updateDeleteBtn();
  }

  btnEdit.addEventListener('click', () => setEditMode(!editMode));

  // \u2500\u2500 Delete selected \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function updateDeleteBtn() {
    const sel = network.getSelectedNodes().length + network.getSelectedEdges().length;
    btnDelete.classList.toggle('visible', editMode && sel > 0);
  }

  network.on('select', updateDeleteBtn);
  network.on('deselectNode', updateDeleteBtn);
  network.on('deselectEdge', updateDeleteBtn);

  document.getElementById('btn-delete').addEventListener('click', () => {
    const selNodes = network.getSelectedNodes();
    const selEdges = network.getSelectedEdges();
    selNodes.forEach(id => vscodeApi.postMessage({ command: 'removeKnot', name: id }));
    selEdges.forEach(eid => {
      const e = edgesDs.get(eid);
      if (e) vscodeApi.postMessage({ command: 'removeDivert', from: e.from, to: e.to });
    });
  });

  // \u2500\u2500 Click to navigate (view mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  network.on('click', params => {
    if (!editMode && params.nodes.length > 0) {
      const node = nodesDs.get(params.nodes[0]);
      if (node && typeof node.line === 'number') {
        vscodeApi.postMessage({ command: 'revealKnot', line: node.line });
      }
    }
    hideCtxMenu();
  });

  // \u2500\u2500 Fit button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  document.getElementById('btn-fit').addEventListener('click', () => {
    network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  });

  // \u2500\u2500 Add Knot button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  document.getElementById('btn-add-knot').addEventListener('click', () => {
    vscodeApi.postMessage({ command: 'requestAddKnot' });
  });

  // \u2500\u2500 Context menu \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const ctxMenu = document.getElementById('ctx-menu');
  const ctxGoto = document.getElementById('ctx-goto');
  const ctxAddDivert = document.getElementById('ctx-add-divert');
  const ctxRemoveEdge = document.getElementById('ctx-remove-edge');
  const ctxRemoveNode = document.getElementById('ctx-remove-node');

  function hideCtxMenu() { ctxMenu.classList.add('hidden'); ctxTarget = null; }

  network.on('oncontext', params => {
    params.event.preventDefault();
    const nodeId = network.getNodeAt(params.pointer.DOM);
    const edgeId = nodeId == null ? network.getEdgeAt(params.pointer.DOM) : null;

    if (nodeId == null && edgeId == null) return;

    ctxTarget = nodeId != null ? { type: 'node', id: nodeId } : { type: 'edge', id: edgeId };

    ctxGoto.style.display = nodeId != null ? '' : 'none';
    ctxAddDivert.style.display = nodeId != null ? '' : 'none';
    ctxRemoveEdge.style.display = edgeId != null ? '' : 'none';
    ctxRemoveNode.style.display = nodeId != null ? '' : 'none';

    const x = params.event.clientX, y = params.event.clientY;
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top  = y + 'px';
    ctxMenu.classList.remove('hidden');
  });

  ctxGoto.addEventListener('click', () => {
    if (!ctxTarget || ctxTarget.type !== 'node') return;
    const node = nodesDs.get(ctxTarget.id);
    if (node) vscodeApi.postMessage({ command: 'revealKnot', line: node.line });
    hideCtxMenu();
  });

  ctxAddDivert.addEventListener('click', () => {
    if (!ctxTarget || ctxTarget.type !== 'node') return;
    setEditMode(true);
    network.selectNodes([ctxTarget.id]);
    // vis-network add-edge mode starts from a selected node automatically
    hideCtxMenu();
  });

  ctxRemoveEdge.addEventListener('click', () => {
    if (!ctxTarget || ctxTarget.type !== 'edge') return;
    const e = edgesDs.get(ctxTarget.id);
    if (e) vscodeApi.postMessage({ command: 'removeDivert', from: e.from, to: e.to });
    hideCtxMenu();
  });

  ctxRemoveNode.addEventListener('click', () => {
    if (!ctxTarget || ctxTarget.type !== 'node') return;
    vscodeApi.postMessage({ command: 'removeKnot', name: ctxTarget.id });
    hideCtxMenu();
  });

  document.addEventListener('click', hideCtxMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { setEditMode(false); hideCtxMenu(); } });

  // \u2500\u2500 Receive updates from host \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command !== 'update') return;

    document.getElementById('file-title').textContent =
      msg.fileName ? 'Ink Knot Graph \u2014 ' + msg.fileName : 'Ink Knot Graph';

    const newNodes = msg.nodes.map(n => ({
      id: n.id,
      label: n.label,
      line: n.line,
      title: n.label + ' (line ' + (n.line + 1) + ')',
      color: n.isFunction ? {
        border: '#8a4ea5', background: '#3a1550',
        highlight: { border: '#c586c0', background: '#4e1d6a' },
        hover:     { border: '#c586c0', background: '#4e1d6a' }
      } : undefined
    }));

    const newEdges = msg.edges.map(e => ({
      id: e.id,
      from: e.from,
      to: e.to,
      title: e.exists ? undefined : '"' + e.to + '" not found in this file',
      color: e.exists ? undefined : { color:'#c37a1a', highlight:'#e09a30', hover:'#e09a30', inherit:false },
      dashes: !e.exists
    }));

    const existingNodeIds = new Set(nodesDs.getIds());
    const incomingNodeIds = new Set(newNodes.map(n => n.id));
    nodesDs.remove([...existingNodeIds].filter(id => !incomingNodeIds.has(id)));
    nodesDs.update(newNodes);

    const existingEdgeIds = new Set(edgesDs.getIds());
    const incomingEdgeIds = new Set(newEdges.map(e => e.id));
    edgesDs.remove([...existingEdgeIds].filter(id => !incomingEdgeIds.has(id)));
    edgesDs.update(newEdges);

    network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });

    // Re-enter add-edge mode if we were editing
    if (editMode) { setTimeout(() => network.addEdgeMode(), 100); }
  });

})();
</script>
</body>
</html>`
    );
  }
};

// src/controllers/WordCountController.ts
var import_vscode14 = require("vscode");
var WordNodeCounterController = class {
  constructor(wordCounter) {
    this.wordCounter = wordCounter;
    this.wordCounter.updateWordCount();
    const subscriptions = [
      import_vscode14.window.onDidChangeTextEditorSelection(this._onEvent, this),
      import_vscode14.window.onDidChangeActiveTextEditor(this._onEvent, this)
    ];
    this._disposable = import_vscode14.Disposable.from(...subscriptions);
  }
  _onEvent() {
    this.wordCounter.updateWordCount();
  }
  dispose() {
    this._disposable.dispose();
  }
};

// src/controllers/WordCounterService.ts
var import_vscode15 = require("vscode");
var WordCounterService = class {
  plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }
  updateWordCount() {
    const editor = import_vscode15.window.activeTextEditor;
    if (!editor) {
      this._statusBarItem?.hide();
      return;
    }
    const doc = editor.document;
    if (doc.languageId !== "ink") {
      this._statusBarItem?.hide();
      return;
    }
    if (!this._statusBarItem) {
      this._statusBarItem = import_vscode15.window.createStatusBarItem(import_vscode15.StatusBarAlignment.Left);
    }
    const docContent = doc.getText();
    const wordCount = this._getWordCount(docContent);
    const nodeCount = this._getNodeCount(docContent);
    this._statusBarItem.text = `$(pencil) ${this.plural(wordCount, "word")} in ${this.plural(nodeCount, "node")}`;
    this._statusBarItem.show();
  }
  _getWordCount(content) {
    const lines = content.split("\n");
    const cleaned = this._stripMultilineBlocks(lines).map((line) => this._stripCommentsAndBlocks(line)).filter((line) => this._isNarrativeLine(line));
    const text = cleaned.join(" ");
    return text.split(/\s+/).filter((word) => /\w/.test(word)).length;
  }
  _stripCommentsAndBlocks(line) {
    line = line.replace(/\/\/.*$/, "");
    line = line.replace(/\{.*?\}/g, "");
    line = line.replace(/\/\*.*?\*\//g, "");
    return line.trim();
  }
  _isNarrativeLine(line) {
    if (line.trim().length === 0) return false;
    if (/^\s*(~|=|VAR|EXTERNAL|INCLUDE)/.test(line)) return false;
    return true;
  }
  _stripMultilineBlocks(lines) {
    let inBlock = false;
    let inComment = false;
    const result = [];
    for (let line of lines) {
      if (inBlock) {
        if (line.includes("}")) {
          inBlock = false;
          line = line.split("}")[1] || "";
        } else continue;
      }
      if (inComment) {
        if (line.includes("*/")) {
          inComment = false;
          line = line.split("*/")[1] || "";
        } else continue;
      }
      if (line.includes("/*") && !line.includes("*/")) {
        inComment = true;
        continue;
      }
      if (line.includes("{") && !line.includes("}")) {
        inBlock = true;
        continue;
      }
      result.push(line);
    }
    return result;
  }
  _getNodeCount(docContent) {
    return docContent.split("\n").filter((line) => line.match(/^\s*=/)).length;
  }
  dispose() {
    this._statusBarItem?.dispose();
  }
};

// src/extension.ts
var INK = { language: "ink" };
function activate(context) {
  const disposables = [];
  const wordCounter = new WordCounterService();
  const wordCounterController = new WordNodeCounterController(wordCounter);
  const nodeController = new NodeController();
  const functionController = new FunctionController();
  const decorationController = new InkDecorationController();
  const diagnosticsController = new InkDiagnosticsController();
  disposables.push(wordCounter, wordCounterController, nodeController, functionController, decorationController, diagnosticsController);
  const knotGraphProvider = new InkKnotGraphProvider();
  disposables.push(import_vscode16.window.registerTreeDataProvider("inkKnotGraph", knotGraphProvider));
  disposables.push(import_vscode16.commands.registerCommand("ink.graph.refresh", () => knotGraphProvider.refresh()));
  disposables.push(import_vscode16.commands.registerCommand("ink.graph.openVisual", () => {
    const editor = import_vscode16.window.activeTextEditor;
    if (editor && editor.document.languageId === "ink") {
      InkGraphWebviewProvider.createOrShow(context, editor.document.uri.fsPath, editor.document.getText());
    } else {
      import_vscode16.window.showInformationMessage("Open an Ink file to view its knot graph.");
    }
  }));
  const activeEditor = import_vscode16.window.activeTextEditor;
  if (activeEditor && activeEditor.document.languageId === "ink") {
    knotGraphProvider.setActiveFile(activeEditor.document.uri.fsPath, activeEditor.document.getText());
  }
  disposables.push(
    import_vscode16.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === "ink") {
        knotGraphProvider.setActiveFile(editor.document.uri.fsPath, editor.document.getText());
        if (InkGraphWebviewProvider.isOpen()) {
          InkGraphWebviewProvider.update(editor.document.uri.fsPath, editor.document.getText());
        }
      }
    }),
    import_vscode16.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "ink" && event.document === import_vscode16.window.activeTextEditor?.document) {
        knotGraphProvider.setActiveFile(event.document.uri.fsPath, event.document.getText());
        if (InkGraphWebviewProvider.isOpen()) {
          InkGraphWebviewProvider.update(event.document.uri.fsPath, event.document.getText());
        }
      }
    })
  );
  (async () => {
    try {
      await Promise.all([
        import_vscode16.window.withProgress({ location: import_vscode16.ProgressLocation.Window, title: "Mapping knots and stitches..." }, generateNodeMaps),
        import_vscode16.window.withProgress({ location: import_vscode16.ProgressLocation.Window, title: "Mapping function declarations..." }, generateFunctionMaps)
      ]);
    } catch (err) {
      console.error("Error while mapping:", err);
    }
  })();
  disposables.push(
    import_vscode16.languages.registerCompletionItemProvider(INK, new DivertCompletionProvider(), ">", "-", " "),
    import_vscode16.languages.registerDefinitionProvider(INK, new InkDivertDefinitionProvider()),
    import_vscode16.languages.registerDefinitionProvider(INK, new InkFunctionDefinitionProvider()),
    import_vscode16.languages.registerDefinitionProvider(INK, new InkVariableDefinitionProvider()),
    import_vscode16.languages.registerCompletionItemProvider(INK, new InkStructureCompletionProvider(), "/"),
    import_vscode16.languages.registerFoldingRangeProvider(INK, new InkFoldingProvider()),
    import_vscode16.languages.registerDocumentSymbolProvider(INK, new InkDocumentSymbolProvider()),
    import_vscode16.languages.registerHoverProvider(INK, new InkHoverProvider())
  );
  context.subscriptions.push(...disposables);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
//# sourceMappingURL=extension.js.map