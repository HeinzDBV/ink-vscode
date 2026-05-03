const DIVERT_REGEX = /->\s*([\w.]+)/g;
const SKIP_TARGETS = new Set(["END", "DONE", "->"]);
const KNOT_HEADER_REGEX = /^\s*===(\s*function)?\s*(\w+)/;

export interface ParsedKnot {
    name: string;
    startLine: number;
    endLine: number;
    isFunction: boolean;
}

export function parseKnots(lines: string[]): ParsedKnot[] {
    const knots: ParsedKnot[] = [];
    let current: { name: string; startLine: number; isFunction: boolean } | null = null;

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

export function extractDiverts(lines: string[], knot: ParsedKnot): string[] {
    const targets: string[] = [];
    const end = Math.min(knot.endLine, lines.length);

    for (let i = knot.startLine; i < end; i++) {
        const line = lines[i];
        if (/^\s*\/\//.test(line)) continue;

        DIVERT_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = DIVERT_REGEX.exec(line)) !== null) {
            const baseName = match[1].split(".")[0];
            if (baseName && !SKIP_TARGETS.has(baseName)) {
                targets.push(baseName);
            }
        }
    }
    return targets;
}
