'use strict';

import { FoldingRange, FoldingRangeKind, FoldingRangeProvider, ProviderResult, TextDocument } from "vscode";
import { NodeMap } from "../models/NodeMap";

// Returns the nesting depth of a choice/sticky-choice line (counts * or + chars), or 0 if not a choice
function choiceDepth(lineText: string): number {
    const m = /^\s*([*+][*+\s]*)/.exec(lineText);
    if (!m) return 0;
    return (m[1].match(/[*+]/g) || []).length;
}

// Returns the nesting depth of a gather line (counts - chars), or 0 if not a gather
function gatherDepth(lineText: string): number {
    const trimmed = lineText.trimStart();
    if (!trimmed.startsWith('-') || trimmed.startsWith('->')) return 0;
    const m = /^\s*([-][\-\s]*)/.exec(lineText);
    return m ? (m[1].match(/-/g) || []).length : 0;
}

const SECTION_HEADER_REGEX = /^\s*={1,3}\s*\w/;

export class InkFoldingProvider implements FoldingRangeProvider {
    provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
        const nodeMap = NodeMap.nodeMapFromDocument(document);
        const ranges: FoldingRange[] = [];

        for (const knot of nodeMap.knots) {
            // Knot range: from its header line to the line before the next knot starts
            if (knot.endLine - 1 > knot.startLine) {
                ranges.push(new FoldingRange(knot.startLine, knot.endLine - 1, FoldingRangeKind.Region));
            }

            // Each stitch inside this knot gets its own foldable range
            for (const stitch of knot.stitches) {
                if (stitch.endLine - 1 > stitch.startLine) {
                    ranges.push(new FoldingRange(stitch.startLine, stitch.endLine - 1, FoldingRangeKind.Region));
                }

                // Each label: fold from its line to the line before the next label (or end of stitch)
                for (let i = 0; i < stitch.labels.length; i++) {
                    const labelStart = stitch.labels[i].line;
                    const labelEnd = i + 1 < stitch.labels.length
                        ? stitch.labels[i + 1].line - 1
                        : stitch.endLine - 1;
                    if (labelEnd > labelStart) {
                        ranges.push(new FoldingRange(labelStart, labelEnd, FoldingRangeKind.Region));
                    }
                }
            }
        }

        // Choice-level folds: scan all lines for * / + choices
        for (let i = 0; i < document.lineCount; i++) {
            const depth = choiceDepth(document.lineAt(i).text);
            if (depth === 0) continue;

            // Scan forward for the next structure at the same or shallower level
            let end = document.lineCount - 1;
            for (let j = i + 1; j < document.lineCount; j++) {
                const jText = document.lineAt(j).text;
                const jChoice = choiceDepth(jText);
                if (jChoice > 0 && jChoice <= depth) { end = j - 1; break; }
                const jGather = gatherDepth(jText);
                if (jGather > 0 && jGather <= depth) { end = j - 1; break; }
                if (SECTION_HEADER_REGEX.test(jText)) { end = j - 1; break; }
            }

            if (end > i) {
                ranges.push(new FoldingRange(i, end));
            }
        }

        return ranges;
    }
}
