import React, { useMemo } from 'react';
import type { Item, NoteItem, FileItem, LinkItem } from '../../types/item';
import type { Tag } from '../../types/tag';
import { NoteCard } from './cards/NoteCard';
import { FileCard } from './cards/FileCard';
import { LinkCard } from './cards/LinkCard';
import { ItemErrorBoundary } from './cards/ItemErrorBoundary';

export { getTypeTheme, formatDate } from './cards/cardUtils';
export type { CardVariant, TypeTheme } from './cards/cardUtils';
export { BaseCard } from './cards/BaseCard';
export type { BaseCardProps } from './cards/BaseCard';
export { NoteCard } from './cards/NoteCard';
export type { NoteCardProps } from './cards/NoteCard';
export { FileCard } from './cards/FileCard';
export type { FileCardProps } from './cards/FileCard';
export { LinkCard } from './cards/LinkCard';
export type { LinkCardProps } from './cards/LinkCard';
export { ItemErrorBoundary } from './cards/ItemErrorBoundary';
export type { ItemErrorBoundaryProps } from './cards/ItemErrorBoundary';

export interface ItemCardProps {
  item: Item;
  variant?: 'library' | 'inbox';
  onOpen: (id: string) => void;
  tags?: Tag[];
  tagMap?: Map<string, Tag>;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  variant = 'library',
  onOpen,
  tags,
  tagMap,
}) => {
  const resolvedTags = useMemo(() => {
    if (tags) return tags;
    if (tagMap && item?.tags && item.tags.length > 0) {
      return item.tags
        .map((id) => tagMap.get(id))
        .filter((t): t is Tag => Boolean(t));
    }
    return undefined;
  }, [tags, tagMap, item?.tags]);

  return (
    <ItemErrorBoundary item={item} onOpen={onOpen}>
      {(() => {
        if (!item || !item.type) {
          return null;
        }

        switch (item.type) {
          case 'note':
            return <NoteCard item={item as NoteItem} variant={variant} onOpen={onOpen} tags={resolvedTags} />;
          case 'file':
            return <FileCard item={item as FileItem} variant={variant} onOpen={onOpen} tags={resolvedTags} />;
          case 'link':
            return <LinkCard item={item as LinkItem} variant={variant} onOpen={onOpen} tags={resolvedTags} />;
          default:
            return null;
        }
      })()}
    </ItemErrorBoundary>
  );
};

export default ItemCard;
