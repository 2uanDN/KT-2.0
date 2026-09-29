import type { Item, FileItem } from '../../../types/item';

export type CardVariant = 'library' | 'inbox';

export interface TypeTheme {
  label: string;
  icon: string;
  accentColor: string;
  accentBgClass: string;
  borderTopColor: string;
  textAccent: string;
}

export const getTypeTheme = (item: Item): TypeTheme => {
  if (!item || !item.type) {
    return {
      label: 'Mục',
      icon: 'draft',
      accentColor: '#B9B08A',
      accentBgClass: 'bg-[#B9B08A]',
      borderTopColor: 'border-t-[#B9B08A]',
      textAccent: 'text-[#3D4A5C]',
    };
  }

  switch (item.type) {
    case 'note':
      return {
        label: 'Ghi chú',
        icon: 'description',
        accentColor: '#E8D4B8',
        accentBgClass: 'bg-[#E8D4B8]',
        borderTopColor: 'border-t-[#E8D4B8]',
        textAccent: 'text-[#8A5A00]',
      };
    case 'file': {
      const fi = item as FileItem;
      const isMedia = fi.fileType === 'image';
      const isPdf = fi.fileType === 'pdf';
      const isCode = fi.fileType === 'markdown';

      const color = isMedia ? '#A8C5B8' : isCode ? '#B9B08A' : '#D4A5A5';
      const bgClass = isMedia ? 'bg-[#A8C5B8]' : isCode ? 'bg-[#B9B08A]' : 'bg-[#D4A5A5]';
      const textClass = isMedia ? 'text-[#2E6B48]' : isCode ? 'text-[#634040]' : 'text-[#BA1A1A]';

      return {
        label: 'Tệp tài liệu',
        icon: isMedia ? 'image' : isPdf ? 'picture_as_pdf' : 'draft',
        accentColor: color,
        accentBgClass: bgClass,
        borderTopColor: `border-t-[${color}]`,
        textAccent: textClass,
      };
    }
    case 'link':
      return {
        label: 'Liên kết',
        icon: 'link',
        accentColor: '#B9B08A',
        accentBgClass: 'bg-[#B9B08A]',
        borderTopColor: 'border-t-[#B9B08A]',
        textAccent: 'text-[#3D4A5C]',
      };
    default:
      return {
        label: 'Mục',
        icon: 'draft',
        accentColor: '#B9B08A',
        accentBgClass: 'bg-[#B9B08A]',
        borderTopColor: 'border-t-[#B9B08A]',
        textAccent: 'text-[#3D4A5C]',
      };
  }
};

export const formatDate = (timestamp: number | null | undefined): string => {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};
