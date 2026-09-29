import { fileStorage } from '../db/opfs';
import type { FileType } from '../types/item';

export interface ValidationResult {
  ok: boolean;
  error?: string;
  detectedType?: FileType;
  isImage?: boolean;
}

export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.svg',
  '.bmp',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
];

export function isImageFilename(filename: string, mimeType?: string): boolean {
  const lowerName = filename.toLowerCase();
  if (IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true;
  }
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }
  return false;
}

class FileService {
  private readonly MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB per file

  isImage(filename: string, mimeType?: string): boolean {
    return isImageFilename(filename, mimeType);
  }

  validateFile(file: File): ValidationResult {
    if (file.size > this.MAX_FILE_BYTES) {
      return { ok: false, error: `Tệp "${file.name}" vượt quá kích thước cho phép (tối đa 50MB).` };
    }

    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    // 1. PDF
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return { ok: true, detectedType: 'pdf', isImage: false };
    }

    // 2. Images (JPG, JPEG, PNG, WEBP, SVG, BMP, TIFF, TIF, HEIC, HEIF)
    if (this.isImage(name, type)) {
      return { ok: true, detectedType: 'image', isImage: true };
    }

    // 3. Markdown
    if (
      type === 'text/markdown' ||
      type === 'text/x-markdown' ||
      name.endsWith('.md') ||
      name.endsWith('.markdown')
    ) {
      return { ok: true, detectedType: 'markdown', isImage: false };
    }

    // 4. Other text or documents fallback to markdown/viewable
    if (type === 'text/plain' || name.endsWith('.txt')) {
      return { ok: true, detectedType: 'markdown', isImage: false };
    }

    // Also support common office documents or general files as fallback if needed, but per spec:
    return {
      ok: true,
      detectedType: 'pdf', // default document preview fallback
      isImage: false,
    };
  }

  async storeFile(file: File | Blob, originalFilename?: string): Promise<string> {
    const rawName = (file instanceof File ? file.name : originalFilename) || 'file.bin';
    const ext = rawName.includes('.') ? rawName.substring(rawName.lastIndexOf('.')) : '';
    const cleanBase = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = `${crypto.randomUUID()}-${cleanBase}${ext || '.bin'}`;
    return fileStorage.storeFile(file, safeName);
  }

  async readFile(opfsPath: string): Promise<Blob | File | null> {
    return fileStorage.readFile(opfsPath);
  }

  async deleteFile(opfsPath: string): Promise<void> {
    if (!opfsPath) return;
    try {
      await fileStorage.deleteFile(opfsPath);
    } catch (err) {
      console.warn('Failed to delete file from storage:', opfsPath, err);
    }
  }

  async readText(opfsPath: string): Promise<string | null> {
    const file = await this.readFile(opfsPath);
    if (!file) return null;
    return file.text();
  }
}

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = (bytes / 1024).toFixed(1).replace(/\.0$/, '');
    return `${kb} KB`;
  }
  const mb = (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
  return `${mb} MB`;
};

export const getTotalFileSize = (item: {
  fileSizeBytes?: number;
  files?: { fileSizeBytes?: number }[];
}): number => {
  if (item.files && item.files.length > 0) {
    return item.files.reduce((acc, f) => acc + (f.fileSizeBytes || 0), 0);
  }
  return item.fileSizeBytes || 0;
};

export const getFileCategoryTag = (item: {
  fileType?: FileType;
  files?: { fileType?: FileType }[];
}): string => {
  if (item.files && item.files.length > 0) {
    const types = new Set(item.files.map((f) => f.fileType).filter(Boolean));
    if (types.size === 1) {
      const single = item.files[0].fileType;
      return single === 'markdown' ? 'MARKDOWN' : (single ? single.toUpperCase() : 'TỆP');
    }
    const hasImage = item.files.some((f) => f.fileType === 'image');
    const hasPdf = item.files.some((f) => f.fileType === 'pdf');
    if (hasImage && !hasPdf) return 'IMAGE';
    if (hasPdf && !hasImage) return 'PDF';
  }
  const ft = item.fileType;
  if (!ft) return 'TỆP';
  return ft === 'markdown' ? 'MARKDOWN' : ft.toUpperCase();
};

export const fileService = new FileService();

