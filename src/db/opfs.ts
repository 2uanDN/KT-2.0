import { db } from './database';

class FileStorageManager {
  private hasOPFSSupport(): boolean {
    return typeof navigator !== 'undefined' &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === 'function';
  }

  async storeFile(file: Blob, preferredName?: string): Promise<string> {
    const filename = preferredName || `${crypto.randomUUID()}-${(file as File).name || 'file.bin'}`;

    if (this.hasOPFSSupport()) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        return filename;
      } catch (err) {
        console.warn('OPFS write encountered an error, falling back to IndexedDB blob storage:', err);
      }
    }

    // Fallback or mirror in IndexedDB
    await db.blobs.put({
      id: filename,
      blob: file,
      mimeType: file.type || 'application/octet-stream',
      createdAt: Date.now(),
    });

    return filename;
  }

  async readFile(opfsPath: string): Promise<File | Blob | null> {
    if (!opfsPath) return null;

    if (this.hasOPFSSupport()) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        const handle = await opfsRoot.getFileHandle(opfsPath);
        return await handle.getFile();
      } catch {
        // Fall back to IDB blob check
      }
    }

    const entry = await db.blobs.get(opfsPath);
    if (entry) {
      return entry.blob;
    }

    return null;
  }

  async exists(opfsPath: string): Promise<boolean> {
    if (!opfsPath) return false;

    if (this.hasOPFSSupport()) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        await opfsRoot.getFileHandle(opfsPath);
        return true;
      } catch {
        // Fall back to IDB
      }
    }

    const count = await db.blobs.where('id').equals(opfsPath).count();
    return count > 0;
  }

  async getSize(opfsPath: string): Promise<number | null> {
    if (!opfsPath) return null;

    if (this.hasOPFSSupport()) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        const handle = await opfsRoot.getFileHandle(opfsPath);
        const file = await handle.getFile();
        return file.size;
      } catch {
        // Fall back to IDB
      }
    }

    const entry = await db.blobs.get(opfsPath);
    if (entry && entry.blob) {
      return entry.blob.size;
    }

    return null;
  }

  async deleteFile(opfsPath: string): Promise<void> {
    if (!opfsPath) return;

    if (this.hasOPFSSupport()) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        await opfsRoot.removeEntry(opfsPath);
      } catch {
        // continue to delete from IDB fallback
      }
    }

    await db.blobs.delete(opfsPath);
  }

  async createBlobUrl(opfsPath: string): Promise<string | null> {
    const file = await this.readFile(opfsPath);
    if (!file) return null;
    return URL.createObjectURL(file);
  }
}

export const fileStorage = new FileStorageManager();
