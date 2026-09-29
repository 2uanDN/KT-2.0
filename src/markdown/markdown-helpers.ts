/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unicode Private Use Area (PUA) codepoints used as temporary sentinels for escaped characters.
 * These characters never appear in legitimate user input and prevent escaped characters from
 * triggering markdown syntax rules (bold, italic, links, lists, tables, etc.).
 */
export const ESCAPE_MAP: Record<string, string> = {
  '\\': '\uE000',
  '*': '\uE001',
  '_': '\uE002',
  '`': '\uE003',
  '[': '\uE004',
  ']': '\uE005',
  '(': '\uE006',
  ')': '\uE007',
  '|': '\uE008',
  '#': '\uE009',
  '-': '\uE00A',
  '+': '\uE00B',
  '~': '\uE00C',
  '!': '\uE00D',
  '>': '\uE00E',
};

export const REVERSE_ESCAPE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ESCAPE_MAP).map(([char, token]) => [token, char])
);

/**
 * Replaces backslash-escaped characters (e.g. \* \_ \[ \] \| \` \\) with internal sentinels.
 */
export function escapeMarkdownChars(text: string): string {
  if (!text) return '';
  return text.replace(/\\([\\*_\`\[\]()|#\-+~!>])/g, (_, char: string) => {
    return ESCAPE_MAP[char] || char;
  });
}

/**
 * Restores sentinel characters back to their literal unescaped characters.
 */
export function restoreEscapedChars(text: string): string {
  if (!text) return '';
  return text.replace(/[\uE000-\uE00E]/g, (token) => {
    return REVERSE_ESCAPE_MAP[token] || token;
  });
}

/* ==========================================================================
   LIST PARSING & TREE STRUCTURES
   ========================================================================== */

export type ListItemType = 'bullet' | 'ordered' | 'task';

export interface RawListItem {
  indent: number;
  type: ListItemType;
  orderNum?: number;
  checked?: boolean;
  content: string;
}

export interface ParsedListItem extends RawListItem {
  children: ParsedListItem[];
}

// Regex definitions for list lines
const TASK_REGEX = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;
const ORDERED_REGEX = /^(\s*)(\d+)[.)]\s+(.*)$/;
const BULLET_REGEX = /^(\s*)([-*+])\s+(.*)$/;

/**
 * Parses a single line to check if it represents a list item (bullet, ordered, or task item).
 */
export function parseListLine(line: string): RawListItem | null {
  // 1. Task item: e.g. "  - [ ] task" or "  1. [x] task"
  const taskMatch = line.match(TASK_REGEX);
  if (taskMatch) {
    const indent = taskMatch[1].replace(/\t/g, '  ').length;
    const checked = taskMatch[2].toLowerCase() === 'x';
    return {
      indent,
      type: 'task',
      checked,
      content: taskMatch[3],
    };
  }

  // 2. Ordered item: e.g. "  1. item" or "  2) item"
  const orderedMatch = line.match(ORDERED_REGEX);
  if (orderedMatch) {
    const indent = orderedMatch[1].replace(/\t/g, '  ').length;
    const orderNum = parseInt(orderedMatch[2], 10);
    return {
      indent,
      type: 'ordered',
      orderNum,
      content: orderedMatch[3],
    };
  }

  // 3. Bullet item: e.g. "  - item" or "  * item" or "  + item"
  const bulletMatch = line.match(BULLET_REGEX);
  if (bulletMatch) {
    const indent = bulletMatch[1].replace(/\t/g, '  ').length;
    return {
      indent,
      type: 'bullet',
      content: bulletMatch[3],
    };
  }

  return null;
}

/**
 * Builds a hierarchical list tree from flat consecutive list items according to indentation depth.
 */
export function buildListTree(rawItems: RawListItem[]): ParsedListItem[] {
  const root: ParsedListItem[] = [];
  const stack: { node: ParsedListItem; indent: number }[] = [];

  for (const item of rawItems) {
    const node: ParsedListItem = {
      ...item,
      children: [],
    };

    // Pop items from stack that have greater or equal indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level item
      root.push(node);
    } else {
      // Child of the current deepest item on stack
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, indent: item.indent });
  }

  return root;
}

/* ==========================================================================
   TABLE PARSING
   ========================================================================== */

export type TableAlignment = 'left' | 'center' | 'right';

export interface ParsedTable {
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
}

/**
 * Splits a table row string into individual cell strings.
 * Respects inline code spans (`...`) and escaped pipes (\\| or \uE008 sentinels)
 * without splitting cells erroneously.
 */
export function splitTableRow(rowStr: string): string[] {
  let s = rowStr.trim();
  if (!s) return [];

  // Strip outer table border pipes if present
  if (s.startsWith('|')) {
    s = s.slice(1);
  }
  if (s.endsWith('|') && !s.endsWith('\\|')) {
    s = s.slice(0, -1);
  }

  const cells: string[] = [];
  let currentCell = '';
  let inCode = false;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    const prevChar = i > 0 ? s[i - 1] : '';
    const nextChar = i + 1 < s.length ? s[i + 1] : '';

    // Handle escaped pipe: e.g. \|
    if (char === '\\' && nextChar === '|') {
      currentCell += '\\|';
      i++;
      continue;
    }

    // Toggle inline code span `...`
    if (char === '`' && prevChar !== '\\') {
      inCode = !inCode;
      currentCell += char;
      continue;
    }

    // Table cell separator pipe: only outside code
    if (char === '|' && !inCode) {
      cells.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  cells.push(currentCell.trim());
  return cells;
}

/**
 * Generates a clean URL-friendly and DOM-friendly slug from heading text.
 * Handles Vietnamese diacritics, markdown punctuation, and collapses hyphens.
 */
export function slugifyHeading(text: string): string {
  if (!text) return '';
  // Strip markdown formatting characters (e.g. `code`, **bold**, *italic*, [link], etc.)
  const clean = text
    .replace(/[`*_~#\[\]]/g, '')
    .trim()
    .toLowerCase();

  return clean
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Keep unicode letters, numbers, whitespace, hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Checks if a row is a valid markdown table delimiter line (e.g. | :--- | :---: | ---: |).
 */
export function isTableDelimiterRow(rowStr: string): boolean {
  if (!rowStr.includes('-')) return false;
  const cells = splitTableRow(rowStr);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{1,}:?$/.test(c));
}

/**
 * Extracts column alignments ('left' | 'center' | 'right') from a delimiter row.
 */
export function parseTableAlignments(delimiterRow: string): TableAlignment[] {
  const cells = splitTableRow(delimiterRow);
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const startsWithColon = trimmed.startsWith(':');
    const endsWithColon = trimmed.endsWith(':');
    if (startsWithColon && endsWithColon) return 'center';
    if (endsWithColon) return 'right';
    return 'left';
  });
}
