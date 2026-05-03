'use strict';

import { CompletionItem, CompletionItemKind, CompletionItemProvider, Position, Range, SnippetString, TextDocument } from "vscode";

interface StructureEntry {
    label: string;
    detail: string;
    snippet: string;
}

const STRUCTURES: StructureEntry[] = [
    { label: "knot",    detail: "=== knot_name ===",                snippet: "=== ${1:knot_name} ===\n$0\n-" },
    { label: "stitch",  detail: "= stitch_name",                    snippet: "= ${1:stitch_name}\n$0" },
    { label: "func",    detail: "=== function name(params) ===",    snippet: "=== function ${1:name}(${2:params}) ===\n\t~ return $0" },
    { label: "VAR",     detail: "VAR name = value",                 snippet: "VAR ${1:name} = ${2:value}" },
    { label: "CONST",   detail: "CONST name = value",               snippet: "CONST ${1:name} = ${2:value}" },
    { label: "LIST",    detail: "LIST name = item1, item2",         snippet: "LIST ${1:name} = ${2:item1}, ${3:item2}" },
    { label: "INCLUDE", detail: "INCLUDE file.ink",                 snippet: "INCLUDE ${1:file}.ink" },
    { label: "choice",  detail: "* [text]",                         snippet: "* [${1:text}]$0" },
    { label: "nchoice", detail: "* (label) [text]",                 snippet: "* (${1:label}) [${2:text}]$0" },
    { label: "schoice", detail: "+ [text]  (sticky)",               snippet: "+ [${1:text}]$0" },
    { label: "cond",    detail: "{condition: true | false}",        snippet: "{${1:condition}: ${2:if true}|${3:if false}}" },
    { label: "if",      detail: "{ condition: ... - else: ... }",   snippet: "{ ${1:condition}:\n\t${2:// if true}\n- else:\n\t${3:// if false}\n}" },
    { label: "ifelseif",detail: "{ condition: ... - else if ... }", snippet: "{ ${1:condition}:\n\t${2:// if true}\n- else if ${3:other}:\n\t${4:// else if}\n- else:\n\t${5:// else}\n}" },
    { label: "->",      detail: "-> divert target",                 snippet: "-> ${1:target}" },
    { label: "->->",    detail: "-> tunnel ->",                     snippet: "-> ${1:target} ->" },
    { label: "<-",      detail: "<- thread",                        snippet: "<- ${1:target}" },
    { label: "~ ",      detail: "~ variable = value",               snippet: "~ ${1:variable} = ${2:value}" },
    { label: "temp",    detail: "~ temp name = value",              snippet: "~ temp ${1:name} = ${2:value}" },
    { label: "tag",     detail: "# tag",                            snippet: "# ${1:tag}" },
    { label: "glabel",  detail: "- (label_name)  (gather with label)", snippet: "- (${1:label_name})$0" },
    { label: "TODO",    detail: "TODO: description",                snippet: "TODO: ${1:description}" },
];

export class InkStructureCompletionProvider implements CompletionItemProvider {
    provideCompletionItems(
        document: TextDocument,
        position: Position
    ): CompletionItem[] | undefined {
        // Only activate when a "/" is typed at the start of a line (after optional whitespace)
        const lineText = document.getText(new Range(position.with(undefined, 0), position));
        const match = /^(\s*)\/(\S*)$/.exec(lineText);
        if (!match) return;

        // Replace everything from the "/" to the current cursor position
        const slashStart = match[1].length;
        const replaceRange = new Range(position.line, slashStart, position.line, position.character);

        return STRUCTURES.map((entry, index) => {
            const item = new CompletionItem(entry.label, CompletionItemKind.Snippet);
            item.detail = entry.detail;
            item.insertText = new SnippetString(entry.snippet);
            item.filterText = "/" + entry.label;
            item.range = replaceRange;
            item.sortText = String(index).padStart(4, "0");
            return item;
        });
    }
}
