import { fileStorage } from '../db/opfs';

class ThumbnailService {
  async generateImageThumbnail(file: Blob, maxDim = 1200): Promise<string | null> {
    try {
      // 1. Try createImageBitmap (works in modern browsers for PNG, JPEG, WEBP, BMP, etc.)
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        // createImageBitmap might fail on SVG or specific formats
        bitmap = null;
      }

      if (bitmap) {
        try {
          const { width, height } = bitmap;
          let targetW = width;
          let targetH = height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              targetH = Math.round((height * maxDim) / width);
              targetW = maxDim;
            } else {
              targetW = Math.round((width * maxDim) / height);
              targetH = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, targetW);
          canvas.height = Math.max(1, targetH);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

            const isPng = file.type === 'image/png';
            const mimeType = isPng ? 'image/png' : 'image/jpeg';
            const quality = 0.92;

            const blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), mimeType, quality);
            });

            // Clean up canvas buffer
            canvas.width = 0;
            canvas.height = 0;

            if (blob) {
              const ext = isPng ? 'png' : 'jpg';
              const thumbPath = `thumb-${crypto.randomUUID()}.${ext}`;
              await fileStorage.storeFile(blob, thumbPath);
              return thumbPath;
            }
          }
        } finally {
          bitmap.close();
        }
      }

      // 2. If canvas/createImageBitmap failed or not applicable (e.g. SVG or HEIC), store original file as thumbnail directly
      const ext = file.type.includes('svg') ? 'svg' : 'bin';
      const fallbackThumbPath = `thumb-${crypto.randomUUID()}.${ext}`;
      await fileStorage.storeFile(file, fallbackThumbPath);
      return fallbackThumbPath;
    } catch (err) {
      console.warn('Thumbnail generation skipped or failed:', err);
      return null;
    }
  }
}

export const thumbnailService = new ThumbnailService();

