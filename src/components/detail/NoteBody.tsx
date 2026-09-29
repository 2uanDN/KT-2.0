import React, { useMemo } from 'react';
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer';
import type { NoteItem } from '../../types/item';

interface NoteBodyProps {
  item: NoteItem;
}

export const NoteBody: React.FC<NoteBodyProps> = ({ item }) => {
  // Strip duplicate leading H1 from markdown body if it matches the note's explicit title
  const renderedBody = useMemo(() => {
    if (!item.body) return '';
    const trimmedTitle = item.title?.trim().toLowerCase() || '';

    // Handle optional YAML frontmatter
    let prefix = '';
    let rest = item.body;
    if (item.body.startsWith('---')) {
      const endMatch = item.body.indexOf('\n---', 3);
      if (endMatch !== -1) {
        prefix = item.body.slice(0, endMatch + 4) + '\n';
        rest = item.body.slice(endMatch + 4);
      }
    }

    const lines = rest.split('\n');
    let firstContentLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 0) {
        firstContentLineIdx = i;
        break;
      }
    }

    if (firstContentLineIdx === -1) {
      return item.body;
    }

    const firstLine = lines[firstContentLineIdx];
    const h1Match = firstLine.match(/^#\s+(.+)$/);
    if (h1Match) {
      const headingText = h1Match[1].replace(/[`*_~#\[\]]/g, '').trim().toLowerCase();
      // If heading matches the item title or title starts with/equals heading text
      if (
        headingText === trimmedTitle ||
        trimmedTitle === headingText.slice(0, 80) ||
        headingText.startsWith(trimmedTitle) ||
        trimmedTitle.startsWith(headingText)
      ) {
        const remainingLines = [
          ...lines.slice(0, firstContentLineIdx),
          ...lines.slice(firstContentLineIdx + 1),
        ];
        // If the line directly following the removed heading is blank, trim it to preserve natural spacing
        if (remainingLines[firstContentLineIdx]?.trim() === '') {
          remainingLines.splice(firstContentLineIdx, 1);
        }
        return prefix + remainingLines.join('\n');
      }
    }

    return item.body;
  }, [item.body, item.title]);

  return (
    <div className="bg-[#FFFFFF] rounded-lg border border-[#3D4A5C] p-4 shadow-hard-md min-w-0">
      {item.title && (
        <h1 className="type-headline-md text-[#1B1B1B] pb-3 border-b border-[#3D4A5C]/20 mb-3 break-words [overflow-wrap:anywhere] leading-snug font-bold">
          {item.title}
        </h1>
      )}
      <MarkdownRenderer content={renderedBody} />
    </div>
  );
};
