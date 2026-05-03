import * as vscode from "vscode";
import * as path from "path";
import { parseKnots, extractDiverts, ParsedKnot } from "../utils/inkParser";

export class InkGraphWebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentFilePath: string | undefined;

    static createOrShow(context: vscode.ExtensionContext, filePath: string, text: string): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn! + 1
            : vscode.ViewColumn.Two;

        if (InkGraphWebviewProvider.currentPanel) {
            InkGraphWebviewProvider.currentPanel.reveal(column);
            InkGraphWebviewProvider.update(filePath, text);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "inkKnotGraphVisual",
            "Ink: Knot Graph",
            column,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = InkGraphWebviewProvider._getHtml();

        panel.webview.onDidReceiveMessage(
            async (message) => {
                try { await InkGraphWebviewProvider._handleMessage(message); }
                catch (err) { console.error("InkGraphWebview error:", err); }
            },
            undefined,
            context.subscriptions
        );

        panel.onDidDispose(() => {
            InkGraphWebviewProvider.currentPanel = undefined;
        }, null, context.subscriptions);

        InkGraphWebviewProvider.currentPanel = panel;
        InkGraphWebviewProvider.currentFilePath = filePath;

        setTimeout(() => InkGraphWebviewProvider.update(filePath, text), 150);
    }

    private static async _handleMessage(message: any): Promise<void> {
        const filePath = InkGraphWebviewProvider.currentFilePath;
        if (!filePath) return;

        switch (message.command) {
            case "revealKnot": {
                const doc = await vscode.workspace.openTextDocument(filePath);
                const editor = await vscode.window.showTextDocument(doc, {
                    preserveFocus: false,
                    preview: false,
                    viewColumn: vscode.ViewColumn.One
                });
                const pos = new vscode.Position(message.line, 0);
                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
                break;
            }
            case "requestAddKnot": {
                const name = await vscode.window.showInputBox({
                    prompt: "Enter a name for the new knot",
                    placeHolder: "knot_name",
                    validateInput: v => /^\w+$/.test(v) ? null : "Use only letters, numbers and underscores"
                });
                if (name) { await InkGraphWebviewProvider._addKnotToFile(filePath, name); }
                break;
            }
            case "addDivert": {
                if (message.from && message.to && message.from !== message.to) {
                    await InkGraphWebviewProvider._addDivertToFile(filePath, message.from, message.to);
                }
                break;
            }
            case "removeDivert": {
                const answer = await vscode.window.showWarningMessage(
                    `Remove divert "${message.from} → ${message.to}"?`,
                    { modal: true }, "Remove"
                );
                if (answer === "Remove") {
                    await InkGraphWebviewProvider._removeDivertFromFile(filePath, message.from, message.to);
                }
                break;
            }
            case "removeKnot": {
                const answer = await vscode.window.showWarningMessage(
                    `Delete knot "${message.name}" and all its content?`,
                    { modal: true }, "Delete"
                );
                if (answer === "Delete") {
                    await InkGraphWebviewProvider._removeKnotFromFile(filePath, message.name);
                }
                break;
            }
        }
    }

    // ── File mutation helpers ──────────────────────────────────────────────────

    private static async _addKnotToFile(filePath: string, name: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(filePath);
        const edit = new vscode.WorkspaceEdit();
        const lastLine = doc.lineCount - 1;
        const lastLineText = doc.lineAt(lastLine).text;
        const prefix = lastLineText.trim() ? "\n" : "";
        edit.insert(doc.uri, new vscode.Position(doc.lineCount, 0), `${prefix}\n=== ${name} ===\n\n`);
        await vscode.workspace.applyEdit(edit);
    }

    private static async _addDivertToFile(filePath: string, fromKnot: string, toKnot: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(filePath);
        const lines = doc.getText().split("\n");
        const knots = parseKnots(lines);
        const knot = knots.find(k => k.name === fromKnot);
        if (!knot) return;

        // Check for duplicate
        const existing = extractDiverts(lines, knot);
        if (existing.includes(toKnot)) {
            vscode.window.showInformationMessage(`Divert "${fromKnot} → ${toKnot}" already exists.`);
            return;
        }

        // Find insertion point: last non-empty line before endLine
        let insertAt = knot.endLine - 1;
        while (insertAt > knot.startLine && lines[insertAt]?.trim() === "") { insertAt--; }

        const edit = new vscode.WorkspaceEdit();
        edit.insert(doc.uri, new vscode.Position(insertAt + 1, 0), `-> ${toKnot}\n`);
        await vscode.workspace.applyEdit(edit);
    }

    private static async _removeDivertFromFile(filePath: string, fromKnot: string, toKnot: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(filePath);
        const lines = doc.getText().split("\n");
        const knots = parseKnots(lines);
        const knot = knots.find(k => k.name === fromKnot);
        if (!knot) return;

        const edit = new vscode.WorkspaceEdit();
        let removed = false;

        for (let i = knot.startLine; i < knot.endLine && !removed; i++) {
            const line = lines[i];
            // Standalone divert line: "  -> toKnot"
            if (new RegExp(`^\\s*->\\s*${toKnot}\\s*$`).test(line)) {
                edit.delete(doc.uri, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0)));
                removed = true;
            } else {
                // Inline at end of line: "* [choice] -> toKnot"
                const m = line.match(new RegExp(`^(.*?)\\s*->\\s*${toKnot}\\s*$`));
                if (m) {
                    edit.replace(doc.uri, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), m[1].trimEnd());
                    removed = true;
                }
            }
        }

        if (removed) {
            await vscode.workspace.applyEdit(edit);
        } else {
            vscode.window.showWarningMessage(`Could not auto-remove divert to "${toKnot}" — it may be inside a conditional expression.`);
        }
    }

    private static async _removeKnotFromFile(filePath: string, knotName: string): Promise<void> {
        const doc = await vscode.workspace.openTextDocument(filePath);
        const lines = doc.getText().split("\n");
        const knots = parseKnots(lines);
        const knot = knots.find(k => k.name === knotName);
        if (!knot) return;

        const edit = new vscode.WorkspaceEdit();
        edit.delete(doc.uri, new vscode.Range(
            new vscode.Position(knot.startLine, 0),
            new vscode.Position(knot.endLine, 0)
        ));
        await vscode.workspace.applyEdit(edit);
    }

    // ── Public update ─────────────────────────────────────────────────────────

    static update(filePath: string, text: string): void {
        if (!InkGraphWebviewProvider.currentPanel) return;
        InkGraphWebviewProvider.currentFilePath = filePath;

        const lines = text.split("\n");
        const knots = parseKnots(lines);
        const knotNames = new Set(knots.map(k => k.name));

        const nodes = knots.map(knot => ({
            id: knot.name,
            label: knot.name,
            line: knot.startLine,
            isFunction: knot.isFunction
        }));

        const edgeMap = new Map<string, boolean>();
        const edges: { id: string; from: string; to: string; exists: boolean }[] = [];

        for (const knot of knots) {
            for (const target of new Set(extractDiverts(lines, knot))) {
                const key = `${knot.name}→${target}`;
                if (!edgeMap.has(key)) {
                    edgeMap.set(key, true);
                    edges.push({ id: key, from: knot.name, to: target, exists: knotNames.has(target) });
                }
            }
        }

        InkGraphWebviewProvider.currentPanel.webview.postMessage({
            command: "update",
            nodes,
            edges,
            fileName: path.basename(filePath)
        });
    }

    static isOpen(): boolean {
        return !!InkGraphWebviewProvider.currentPanel;
    }

    // ── HTML ──────────────────────────────────────────────────────────────────

    private static _getHtml(): string {
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://unpkg.com 'unsafe-inline'; style-src 'unsafe-inline';">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1e1e1e; overflow:hidden; font-family: Consolas,'Courier New',monospace; color:#d4d4d4; }
#graph { width:100vw; height:100vh; }

/* ── Toolbar ── */
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

/* ── Edit hint bar ── */
#edit-hint {
  position:absolute; bottom:0; left:0; right:0; height:28px;
  background:#0e639c; display:flex; align-items:center; justify-content:center;
  font-size:11px; color:#cce7ff; z-index:20;
  transition: opacity 0.2s;
}
#edit-hint.hidden { opacity:0; pointer-events:none; }

/* ── vis manipulation toolbar override ── */
.vis-manipulation {
  background:#252526 !important; border-bottom:1px solid #3e3e3e !important;
  display:none !important;  /* we drive it programmatically */
}

/* ── Context menu ── */
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

/* ── Delete button (selected state) ── */
#btn-delete { display:none; }
#btn-delete.visible { display:inline-block; background:#6e1414; border-color:#a02020; }
#btn-delete.visible:hover { background:#8a1818; }
</style>
</head>
<body>

<div id="toolbar">
  <span id="file-title">Ink Knot Graph</span>
  <button class="tb-btn" id="btn-fit" title="Fit all nodes in view">⊞ Fit</button>
  <button class="tb-btn" id="btn-add-knot" title="Create a new knot">+ Knot</button>
  <button class="tb-btn" id="btn-delete" title="Delete selected node or edge">✕ Delete</button>
  <button class="tb-btn" id="btn-edit" title="Toggle edit mode to add/remove connections">✎ Edit Mode</button>
</div>

<div id="graph"></div>

<div id="edit-hint" class="hidden">
  Edit mode &mdash; Drag between nodes to add a divert &nbsp;·&nbsp; Select a node or edge then click <strong>✕ Delete</strong>
</div>

<ul id="ctx-menu" class="hidden">
  <li id="ctx-goto">↗ Go to section</li>
  <li id="ctx-add-divert">⟶ Add divert to…</li>
  <li class="sep"></li>
  <li id="ctx-remove-edge" class="danger">✕ Remove this divert</li>
  <li id="ctx-remove-node" class="danger">✕ Delete knot</li>
</ul>

<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<script>
(function() {
  const vscodeApi = acquireVsCodeApi();
  const container = document.getElementById('graph');

  // ── DataSets ───────────────────────────────────────────────────────────────
  const nodesDs = new vis.DataSet([]);
  const edgesDs = new vis.DataSet([]);

  // ── State ──────────────────────────────────────────────────────────────────
  let editMode = false;
  let ctxTarget = null; // { type: 'node'|'edge', id }

  // ── vis options ────────────────────────────────────────────────────────────
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
        callback(null); // don't add visually — file change will refresh
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

  // ── Edit mode toggle ───────────────────────────────────────────────────────
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

  // ── Delete selected ────────────────────────────────────────────────────────
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

  // ── Click to navigate (view mode) ─────────────────────────────────────────
  network.on('click', params => {
    if (!editMode && params.nodes.length > 0) {
      const node = nodesDs.get(params.nodes[0]);
      if (node && typeof node.line === 'number') {
        vscodeApi.postMessage({ command: 'revealKnot', line: node.line });
      }
    }
    hideCtxMenu();
  });

  // ── Fit button ─────────────────────────────────────────────────────────────
  document.getElementById('btn-fit').addEventListener('click', () => {
    network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  });

  // ── Add Knot button ────────────────────────────────────────────────────────
  document.getElementById('btn-add-knot').addEventListener('click', () => {
    vscodeApi.postMessage({ command: 'requestAddKnot' });
  });

  // ── Context menu ──────────────────────────────────────────────────────────
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

  // ── Receive updates from host ──────────────────────────────────────────────
  window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.command !== 'update') return;

    document.getElementById('file-title').textContent =
      msg.fileName ? 'Ink Knot Graph — ' + msg.fileName : 'Ink Knot Graph';

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
</html>`;
    }
}

