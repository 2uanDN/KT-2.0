/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import {
  escapeMarkdownChars,
  restoreEscapedChars,
  parseListLine,
  buildListTree,
  isTableDelimiterRow,
  parseTableAlignments,
  splitTableRow,
  slugifyHeading,
  type ParsedListItem,
  type RawListItem,
  type TableAlignment,
} from './markdown-helpers';
import { removeVietnameseAccents } from '../utils/vietnamese';

export interface MarkdownRendererProps {
  content: string;
}

/**
 * Sanitizes markdown link URLs to prevent XSS (e.g. javascript:, data:text/html)
 * while safely supporting web URLs, anchors, mailto, tel, and relative paths.
 */
function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '#';
  if (/^(?:https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  // Auto-prefix domains without protocol e.g. "example.com/path"
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return '#';
}

/**
 * Transforms inline formatting (links, bold, italic, strikethrough, inline code, and escape sequences).
 */
function renderInline(rawText: string, depth = 0): React.ReactNode {
  if (!rawText) return null;

  // Step 1: Protect inline code blocks first, so `*not italic*` or `[not link](url)` inside code is untouched
  const codeSpans: string[] = [];
  const withProtectedCode = rawText.replace(/(`[^`]+`)/g, (_, code) => {
    const idx = codeSpans.length;
    codeSpans.push(code);
    return `\uE010${idx}\uE011`;
  });

  // Step 2: Escape markdown punctuation outside code spans
  const escapedText = escapeMarkdownChars(withProtectedCode);

  // Step 3: Restore protected code spans
  const preprocessedText = escapedText.replace(/\uE010(\d+)\uE011/g, (_, idxStr) => {
    return codeSpans[parseInt(idxStr, 10)] || '';
  });

  // Step 4: Tokenize into links, code spans, bold, strikethrough, and italic
  const inlineRegex =
    /(\[[^\n\]]+\]\([^\n\)]*\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  const tokens = preprocessedText.split(inlineRegex);

  return tokens.map((token, i) => {
    if (!token) return null;

    // 1. Hyperlinks: [text](url) or [text](url "title")
    if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkMatch = token.match(/^\[([^\n\]]+)\]\(([^\n\)]*)\)$/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const rawTarget = linkMatch[2].trim();

        let href = rawTarget;
        let titleAttr: string | undefined;
        const titleMatch = rawTarget.match(/^(\S+)\s+["'](.*?)["']$/);
        if (titleMatch) {
          href = titleMatch[1];
          titleAttr = titleMatch[2];
        }

        const safeHref = sanitizeUrl(href);
        const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');

        return (
          <a
            key={`a-${depth}-${i}`}
            href={safeHref}
            title={titleAttr ? restoreEscapedChars(titleAttr) : undefined}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-[#3D4A5C] font-semibold underline underline-offset-2 decoration-[#3D4A5C]/40 hover:decoration-[#3D4A5C] hover:text-[#1B1B1B] transition-colors inline-flex items-baseline gap-0.5 break-words [overflow-wrap:anywhere]"
          >
            <span>{depth < 2 ? renderInline(linkText, depth + 1) : restoreEscapedChars(linkText)}</span>
            {isExternal && (
              <span className="material-symbols-outlined text-[13px] opacity-70 inline-block align-middle select-none translate-y-0.5">
                open_in_new
              </span>
            )}
          </a>
        );
      }
    }

    // 2. Inline code: `code`
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={`c-${depth}-${i}`}
          className="bg-[#FAF9F7] px-1.5 py-0.5 rounded-xs font-mono text-[12px] text-[#1B1B1B] border border-[#3D4A5C]/30 shadow-hard-xs"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // 3. Bold: **text** or __text__
    if (
      (token.startsWith('**') && token.endsWith('**') && token.length >= 4) ||
      (token.startsWith('__') && token.endsWith('__') && token.length >= 4)
    ) {
      const inner = token.slice(2, -2);
      return (
        <strong key={`b-${depth}-${i}`} className="font-bold text-[#1B1B1B]">
          {depth < 2 ? renderInline(inner, depth + 1) : restoreEscapedChars(inner)}
        </strong>
      );
    }

    // 4. Strikethrough: ~~text~~
    if (token.startsWith('~~') && token.endsWith('~~') && token.length >= 4) {
      const inner = token.slice(2, -2);
      return (
        <del key={`del-${depth}-${i}`} className="line-through text-[#75777D]">
          {depth < 2 ? renderInline(inner, depth + 1) : restoreEscapedChars(inner)}
        </del>
      );
    }

    // 5. Italic: *text* or _text_
    if (
      (token.startsWith('*') && token.endsWith('*') && token.length >= 2) ||
      (token.startsWith('_') && token.endsWith('_') && token.length >= 2)
    ) {
      const inner = token.slice(1, -1);
      return (
        <em key={`em-${depth}-${i}`} className="italic text-[#1B1B1B]">
          {depth < 2 ? renderInline(inner, depth + 1) : restoreEscapedChars(inner)}
        </em>
      );
    }

    // 6. Regular text (unescape any sentinels)
    return <React.Fragment key={`t-${depth}-${i}`}>{restoreEscapedChars(token)}</React.Fragment>;
  });
}

/**
 * Recursively renders a nested list tree (handles ordered, bullet, and task items).
 */
function renderListTree(items: ParsedListItem[], level = 0): React.ReactNode {
  if (items.length === 0) return null;

  // Group consecutive sibling items with the same list type
  const groups: ParsedListItem[][] = [];
  let currentGroup: ParsedListItem[] = [];

  items.forEach((item) => {
    if (currentGroup.length === 0) {
      currentGroup.push(item);
    } else {
      const prevType = currentGroup[0].type;
      if (item.type === prevType) {
        currentGroup.push(item);
      } else {
        groups.push(currentGroup);
        currentGroup = [item];
      }
    }
  });
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups.map((group, gIdx) => {
    const groupType = group[0].type;

    // Ordered list container
    if (groupType === 'ordered') {
      const startNum = group[0].orderNum || 1;
      return (
        <ol
          key={`ol-${level}-${gIdx}`}
          start={startNum}
          className="list-decimal pl-5 my-1 space-y-1 text-[#1B1B1B]"
        >
          {group.map((item, itemIdx) => (
            <li
              key={`oli-${level}-${itemIdx}`}
              className="text-[14px] leading-relaxed marker:text-[#3D4A5C] marker:font-mono marker:font-semibold"
            >
              <span>{renderInline(item.content)}</span>
              {item.children.length > 0 && renderListTree(item.children, level + 1)}
            </li>
          ))}
        </ol>
      );
    }

    // Checkbox / Task list container
    if (groupType === 'task') {
      return (
        <ul
          key={`taskul-${level}-${gIdx}`}
          className="list-none pl-0.5 my-1 space-y-1.5 text-[#1B1B1B]"
        >
          {group.map((item, itemIdx) => (
            <li key={`taski-${level}-${itemIdx}`} className="flex items-start gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                className="mt-1 h-3.5 w-3.5 rounded-xs text-[#3D4A5C] border-[#3D4A5C] focus:ring-0 cursor-default"
              />
              <div className="flex-1 min-w-0">
                <span
                  className={
                    item.checked ? 'line-through text-[#75777D]' : 'text-[#1B1B1B]'
                  }
                >
                  {renderInline(item.content)}
                </span>
                {item.children.length > 0 && renderListTree(item.children, level + 1)}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    // Bullet list container
    return (
      <ul
        key={`ul-${level}-${gIdx}`}
        className="list-disc pl-5 my-1 space-y-1 text-[#1B1B1B]"
      >
        {group.map((item, itemIdx) => (
          <li
            key={`uli-${level}-${itemIdx}`}
            className="text-[14px] leading-relaxed marker:text-[#3D4A5C]"
          >
            <span>{renderInline(item.content)}</span>
            {item.children.length > 0 && renderListTree(item.children, level + 1)}
          </li>
        ))}
      </ul>
    );
  });
}

/**
 * Renders a Markdown table with column alignments and horizontal scroll container.
 */
function renderTable(
  key: string,
  headers: string[],
  alignments: TableAlignment[],
  rows: string[][]
): React.ReactNode {
  return (
    <div
      key={key}
      className="my-3 w-full overflow-x-auto rounded-lg border border-[#3D4A5C] shadow-hard-xs bg-white"
    >
      <table className="w-full text-left border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#FAF9F7] border-b border-[#3D4A5C]">
            {headers.map((h, colIdx) => {
              const align = alignments[colIdx] || 'left';
              return (
                <th
                  key={`th-${colIdx}`}
                  className={`px-3 py-2 font-mono font-bold text-[#3D4A5C] tracking-wide border-r border-[#3D4A5C]/20 last:border-r-0 ${
                    align === 'center'
                      ? 'text-center'
                      : align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  }`}
                >
                  {renderInline(h)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3D4A5C]/15">
          {rows.map((row, rowIdx) => (
            <tr key={`tr-${rowIdx}`} className="hover:bg-[#FAF9F7]/60 transition-colors">
              {headers.map((_, colIdx) => {
                const cell = row[colIdx] || '';
                const align = alignments[colIdx] || 'left';
                return (
                  <td
                    key={`td-${rowIdx}-${colIdx}`}
                    className={`px-3 py-2 text-[#1B1B1B] border-r border-[#3D4A5C]/15 last:border-r-0 ${
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                        ? 'text-right'
                        : 'text-left'
                    }`}
                  >
                    {renderInline(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MarkdownRendererInternal: React.FC<MarkdownRendererProps> = React.memo(({ content }) => {
  // Parse YAML Frontmatter if present
  const { frontmatter, body } = useMemo(() => {
    if (!content.startsWith('---')) {
      return { frontmatter: null, body: content };
    }
    const endMatch = content.indexOf('\n---', 3);
    if (endMatch === -1) {
      return { frontmatter: null, body: content };
    }
    const rawFm = content.slice(3, endMatch).trim();
    const rest = content.slice(endMatch + 4).trim();
    const fmPairs: Record<string, string> = {};
    rawFm.split('\n').forEach((line) => {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) fmPairs[k] = v;
      }
    });
    return { frontmatter: fmPairs, body: rest };
  }, [content]);

  // Structured block-level parsing using a scanner loop
  const blocks = useMemo(() => {
    const lines = body.split('\n');
    const result: React.ReactNode[] = [];
    const headingCounts = new Map<string, number>();
    let i = 0;

    while (i < lines.length) {
      const currentLine = lines[i];

      // 1. Code blocks: ```
      if (currentLine.startsWith('```')) {
        const codeLanguage = currentLine.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          i++; // Consume closing ```
        }
        result.push(
          <div
            key={`cb-${i}`}
            className="my-3 rounded-lg overflow-hidden border border-[#3D4A5C] bg-[#1B1B1B] text-white shadow-hard-xs"
          >
            {codeLanguage && (
              <div className="bg-[#303030] px-3 py-1 type-nano-code text-[#C5C6CD] border-b border-[#44474C]">
                {codeLanguage}
              </div>
            )}
            <pre className="p-3 text-[13px] font-mono overflow-x-auto leading-relaxed text-[#F1F1F1]">
              {codeLines.join('\n')}
            </pre>
          </div>
        );
        continue;
      }

      // 2. Table parsing: checks if currentLine and nextLine form header and delimiter
      if (
        i + 1 < lines.length &&
        currentLine.includes('|') &&
        isTableDelimiterRow(lines[i + 1])
      ) {
        const headers = splitTableRow(currentLine);
        const alignments = parseTableAlignments(lines[i + 1]);
        const rows: string[][] = [];

        i += 2; // Advance past header and delimiter
        while (i < lines.length) {
          const rowLine = lines[i];
          if (!rowLine.trim() || !rowLine.includes('|')) break;
          if (rowLine.startsWith('```') || rowLine.startsWith('#')) break;
          rows.push(splitTableRow(rowLine));
          i++;
        }

        result.push(renderTable(`tbl-${i}`, headers, alignments, rows));
        continue;
      }

      // 3. List parsing: handles consecutive bullet, ordered, and task items (including nested items)
      if (parseListLine(currentLine)) {
        const listItems: RawListItem[] = [];
        while (i < lines.length) {
          const parsed = parseListLine(lines[i]);
          if (parsed) {
            listItems.push(parsed);
            i++;
          } else {
            break;
          }
        }
        const tree = buildListTree(listItems);
        result.push(
          <div key={`list-block-${i}`} className="my-1.5">
            {renderListTree(tree)}
          </div>
        );
        continue;
      }

      // 4. Headings: # to ######
      const headingMatch = currentLine.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const headingKey = `h-${level}-${i}`;
        const cleanHeadingText = text.replace(/[`*_~#\[\]]/g, '').trim();
        const baseSlug = slugifyHeading(cleanHeadingText) || `section-${i}`;
        const count = headingCounts.get(baseSlug) || 0;
        headingCounts.set(baseSlug, count + 1);
        const headingId = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        const asciiSlug = slugifyHeading(removeVietnameseAccents(cleanHeadingText));

        if (level === 1) {
          result.push(
            <h1
              key={headingKey}
              id={headingId}
              data-heading={cleanHeadingText.toLowerCase()}
              data-heading-slug={headingId}
              data-heading-ascii={asciiSlug}
              className="scroll-mt-16 type-headline-lg font-bold mt-5 mb-2 text-[#1B1B1B] pb-1 border-b border-[#3D4A5C]/20"
            >
              {renderInline(text)}
            </h1>
          );
        } else if (level === 2) {
          result.push(
            <h2
              key={headingKey}
              id={headingId}
              data-heading={cleanHeadingText.toLowerCase()}
              data-heading-slug={headingId}
              data-heading-ascii={asciiSlug}
              className="scroll-mt-16 type-headline-md font-bold mt-4 mb-2 text-[#1B1B1B]"
            >
              {renderInline(text)}
            </h2>
          );
        } else if (level === 3) {
          result.push(
            <h3
              key={headingKey}
              id={headingId}
              data-heading={cleanHeadingText.toLowerCase()}
              data-heading-slug={headingId}
              data-heading-ascii={asciiSlug}
              className="scroll-mt-16 type-headline-sm font-bold mt-3 mb-1.5 text-[#3D4A5C]"
            >
              {renderInline(text)}
            </h3>
          );
        } else if (level === 4) {
          result.push(
            <h4
              key={headingKey}
              id={headingId}
              data-heading={cleanHeadingText.toLowerCase()}
              data-heading-slug={headingId}
              data-heading-ascii={asciiSlug}
              className="scroll-mt-16 text-[15px] font-bold mt-2.5 mb-1 text-[#1B1B1B]"
            >
              {renderInline(text)}
            </h4>
          );
        } else if (level === 5) {
          result.push(
            <h5
              key={headingKey}
              id={headingId}
              data-heading={cleanHeadingText.toLowerCase()}
              data-heading-slug={headingId}
              data-heading-ascii={asciiSlug}
              className="scroll-mt-16 text-[14px] font-bold mt-2 mb-1 text-[#3D4A5C]"
            >
              {renderInline(text)}
            </h5>
          );
        } else {
          result.push(
            <h6
              key={headingKey}
              id={headingId}
              data-heading={cleanHeadingText.toLowerCase()}
              data-heading-slug={headingId}
              data-heading-ascii={asciiSlug}
              className="scroll-mt-16 text-[13px] font-semibold mt-2 mb-1 text-[#44474C] uppercase tracking-wider"
            >
              {renderInline(text)}
            </h6>
          );
        }
        i++;
        continue;
      }

      // 5. Blockquotes: > (handles consecutive quote lines in one blockquote)
      if (currentLine.startsWith('> ') || currentLine === '>') {
        const quoteLines: string[] = [];
        while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
          quoteLines.push(lines[i].startsWith('> ') ? lines[i].slice(2) : '');
          i++;
        }
        result.push(
          <blockquote
            key={`bq-${i}`}
            className="border-l-4 border-[#3D4A5C] bg-[#FAF9F7] pl-3 py-2 my-2.5 text-[14px] text-[#44474C] italic rounded-r border-y border-r border-[#3D4A5C]/15 space-y-1"
          >
            {quoteLines.map((qLine, qIdx) => (
              <p key={`bqp-${qIdx}`} className="leading-relaxed">
                {renderInline(qLine)}
              </p>
            ))}
          </blockquote>
        );
        continue;
      }

      // 6. Horizontal rule: --- or *** or ___
      if (
        currentLine.trim() === '---' ||
        currentLine.trim() === '***' ||
        currentLine.trim() === '___'
      ) {
        result.push(<hr key={`hr-${i}`} className="my-4 border-[#3D4A5C]/20" />);
        i++;
        continue;
      }

      // 7. Empty line spacing
      if (!currentLine.trim()) {
        result.push(<div key={`sp-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // 8. Standard paragraph
      result.push(
        <p key={`p-${i}`} className="type-body-md text-[#1B1B1B] leading-relaxed my-1">
          {renderInline(currentLine)}
        </p>
      );
      i++;
    }

    return result;
  }, [body]);

  return (
    <div className="markdown-body space-y-1 select-text">
      {/* YAML Frontmatter card if present */}
      {frontmatter && Object.keys(frontmatter).length > 0 && (
        <div className="mb-4 p-3 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg text-xs font-mono shadow-hard-xs">
          <div className="type-nano-code font-bold text-[#3D4A5C] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">data_object</span>
            <span>METADATA</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[#44474C]">
            {Object.entries(frontmatter).map(([k, v]) => (
              <div key={k} className="flex gap-1.5 truncate">
                <span className="text-[#1B1B1B] font-bold">{k}:</span>
                <span className="truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main markdown content */}
      <div className="text-[14px] leading-relaxed">{blocks}</div>
    </div>
  );
});
MarkdownRendererInternal.displayName = 'MarkdownRendererInternal';

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = (props) => {
  return (
    <ErrorBoundary
      resetKeys={[props.content]}
      fallback={(error, reset) => (
        <div className="p-3 bg-[#FAF9F7] border border-[#BA1A1A] rounded-lg text-left my-2 shadow-hard-xs">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#BA1A1A]/20">
            <div className="flex items-center gap-1.5 text-[#BA1A1A] font-mono text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>LỖI ĐỊNH DẠNG MARKDOWN</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="px-2 py-0.5 bg-[#BA1A1A] text-white rounded text-[11px] font-mono font-bold hover:bg-[#93000A] transition cursor-pointer"
            >
              THỬ LẠI
            </button>
          </div>
          <p className="text-xs text-[#75777D] mb-2 font-mono">
            Hiển thị nội dung ở chế độ văn bản thô do gặp lỗi định dạng ({error.message}).
          </p>
          <pre className="p-2.5 bg-[#FFFFFF] border border-[#3D4A5C]/20 rounded font-mono text-xs text-[#1B1B1B] whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-96 overflow-y-auto">
            {props.content}
          </pre>
        </div>
      )}
    >
      <MarkdownRendererInternal {...props} />
    </ErrorBoundary>
  );
};
