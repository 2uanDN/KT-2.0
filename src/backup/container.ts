import {
  Zip,
  ZipDeflate,
  ZipPassThrough,
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  strToU8,
  strFromU8,
  type UnzipFile,
} from 'fflate';
import { ENTRY_NAMES, MAX_METADATA_BYTES } from './constants';
import { BackupError } from './errors';
import type { BackupManifest, BackupTrailer } from './types';

export interface WriterOutput {
  sizeBytes: number;
  blob?: Blob;
}

/**
 * Handles streaming writing of Kho Tri Thuc backup ZIP archives.
 * Can write directly to a FileSystemWritableFileStream or accumulate to a Blob.
 */
export class BackupContainerWriter {
  private zip: Zip;
  private writableStream?: FileSystemWritableFileStream | null;
  private chunks: Uint8Array[] = [];
  private totalWrittenBytes = 0;
  private writePromiseChain: Promise<void> = Promise.resolve();
  private isClosed = false;

  constructor(writableStream?: FileSystemWritableFileStream | null) {
    this.writableStream = writableStream;
    this.zip = new Zip((err, chunk, final) => {
      if (err) {
        throw new BackupError('ARCHIVE_CORRUPT', err);
      }
      if (chunk && chunk.length > 0) {
        this.totalWrittenBytes += chunk.length;
        if (this.writableStream) {
          this.writePromiseChain = this.writePromiseChain.then(async () => {
            if (this.writableStream) {
              await this.writableStream.write(chunk);
            }
          });
        } else {
          this.chunks.push(chunk);
        }
      }
      if (final && this.writableStream) {
        // Stream completed
      }
    });
  }

  /**
   * Adds a DEFLATE compressed text or binary entry.
   */
  async addDeflateEntry(filename: string, content: string | Uint8Array): Promise<void> {
    const data = typeof content === 'string' ? strToU8(content) : content;
    const entry = new ZipDeflate(filename, { level: 6 });
    this.zip.add(entry);
    entry.push(data, true);
    await this.writePromiseChain;
    // Yield event loop
    await new Promise((r) => setTimeout(r, 0));
  }

  /**
   * Adds an uncompressed STORE entry (for binary files/thumbnails).
   * Streams the Blob in chunks to minimize memory pressure.
   */
  async addStoredBlob(
    entryPath: string,
    blob: Blob,
    signal?: AbortSignal,
    onChunk?: (bytesAdded: number) => void
  ): Promise<number> {
    if (signal?.aborted) {
      throw new BackupError('ABORTED');
    }

    const entry = new ZipPassThrough(entryPath);
    this.zip.add(entry);

    const stream = blob.stream();
    const reader = stream.getReader();
    let blobBytes = 0;

    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel().catch(() => {});
          throw new BackupError('ABORTED');
        }

        const { done, value } = await reader.read();
        if (done) {
          entry.push(new Uint8Array(0), true);
          break;
        }

        if (value && value.length > 0) {
          blobBytes += value.length;
          entry.push(value, false);
          onChunk?.(value.length);
          await this.writePromiseChain;
        }

        // Backpressure yield
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      reader.releaseLock();
    }

    await this.writePromiseChain;
    return blobBytes;
  }

  /**
   * Finalizes the ZIP archive and closes the writable stream if present.
   */
  async close(): Promise<WriterOutput> {
    if (this.isClosed) {
      return { sizeBytes: this.totalWrittenBytes };
    }
    this.isClosed = true;

    this.zip.end();
    await this.writePromiseChain;

    if (this.writableStream) {
      await this.writableStream.close();
      return {
        sizeBytes: this.totalWrittenBytes,
      };
    }

    const blob = new Blob(this.chunks as unknown as BlobPart[], { type: 'application/zip' });
    this.chunks = []; // Release chunk memory
    return {
      sizeBytes: this.totalWrittenBytes,
      blob,
    };
  }

  abort(): void {
    try {
      this.zip.terminate();
    } catch {
      // Non-fatal
    }
    this.chunks = [];
  }
}

export interface ReadEntryData {
  name: string;
  data: Uint8Array;
}

export interface ContainerAnalyzeHeader {
  manifestRaw: string;
  tagsRaw: string;
  collectionsRaw: string;
  itemsNdjsonRaw: string;
  entryOrder: string[];
}

/**
 * Reads a backup ZIP container streamingly.
 */
export class BackupContainerReader {
  /**
   * Reads only the metadata entries (up to and including items.ndjson) from a File.
   * Stops reading the stream immediately after items.ndjson is collected.
   */
  static async readMetadataEntries(
    file: File,
    signal?: AbortSignal
  ): Promise<ContainerAnalyzeHeader> {
    let manifestRaw = '';
    let tagsRaw = '';
    let collectionsRaw = '';
    let itemsNdjsonRaw = '';
    const entryOrder: string[] = [];

    let totalMetadataBytes = 0;
    let completedItems = false;
    let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        const unzipper = new Unzip();
        unzipper.register(UnzipInflate);
        unzipper.register(UnzipPassThrough);

        unzipper.onfile = (entry: UnzipFile) => {
          entryOrder.push(entry.name);
          const chunks: Uint8Array[] = [];

          entry.ondata = (err, chunk, final) => {
            if (err) {
              reject(new BackupError('ARCHIVE_CORRUPT', err));
              return;
            }

            if (chunk) {
              totalMetadataBytes += chunk.length;
              if (totalMetadataBytes > MAX_METADATA_BYTES) {
                reject(new BackupError('METADATA_TOO_LARGE'));
                return;
              }
              chunks.push(chunk);
            }

            if (final) {
              const fullBuffer = mergeChunks(chunks);
              const text = strFromU8(fullBuffer);

              if (entry.name === ENTRY_NAMES.MANIFEST) {
                manifestRaw = text;
              } else if (entry.name === ENTRY_NAMES.TAGS) {
                tagsRaw = text;
              } else if (entry.name === ENTRY_NAMES.COLLECTIONS) {
                collectionsRaw = text;
              } else if (entry.name === ENTRY_NAMES.ITEMS) {
                itemsNdjsonRaw = text;
                completedItems = true;
                resolve();
              }
            }
          };

          entry.start();
        };

        const stream = file.stream();
        streamReader = stream.getReader();

        (async () => {
          try {
            while (!completedItems) {
              if (signal?.aborted) {
                reject(new BackupError('ABORTED'));
                return;
              }

              const { done, value } = await streamReader!.read();
              if (done) {
                if (!completedItems) {
                  // Reached end of file before items.ndjson
                  if (!manifestRaw) {
                    reject(new BackupError('NOT_A_BACKUP'));
                  } else {
                    reject(new BackupError('ARCHIVE_INCOMPLETE'));
                  }
                }
                break;
              }

              if (value) {
                unzipper.push(value, false);
              }
            }
          } catch (readErr) {
            reject(new BackupError('ARCHIVE_CORRUPT', readErr));
          }
        })();
      });
    } finally {
      if (streamReader) {
        try {
          await (streamReader as ReadableStreamDefaultReader<Uint8Array>).cancel();
        } catch {
          // Non-fatal
        }
      }
    }

    return {
      manifestRaw,
      tagsRaw,
      collectionsRaw,
      itemsNdjsonRaw,
      entryOrder,
    };
  }

  /**
   * Performs full streaming read for execution:
   * Emits metadata, each blob entry sequentially, and the final trailer.
   */
  static async readFullArchive(
    file: File,
    callbacks: {
      onMetadata: (header: ContainerAnalyzeHeader) => Promise<void>;
      onBlob: (path: string, blob: Blob) => Promise<void>;
      onTrailer: (trailer: BackupTrailer) => Promise<void>;
    },
    signal?: AbortSignal
  ): Promise<void> {
    let manifestRaw = '';
    let tagsRaw = '';
    let collectionsRaw = '';
    let itemsNdjsonRaw = '';
    const entryOrder: string[] = [];
    let trailerRaw = '';

    let metadataDispatched = false;
    let currentBlobPath: string | null = null;
    let currentBlobChunks: Uint8Array[] = [];

    const unzipper = new Unzip();
    unzipper.register(UnzipInflate);
    unzipper.register(UnzipPassThrough);

    await new Promise<void>((resolve, reject) => {
      unzipper.onfile = (entry: UnzipFile) => {
        entryOrder.push(entry.name);

        if (entry.name.startsWith(ENTRY_NAMES.BLOBS_PREFIX)) {
          // If we haven't dispatched metadata yet, dispatch now
          if (!metadataDispatched) {
            metadataDispatched = true;
            callbacks
              .onMetadata({
                manifestRaw,
                tagsRaw,
                collectionsRaw,
                itemsNdjsonRaw,
                entryOrder,
              })
              .catch(reject);
          }

          const rawPath = entry.name.slice(ENTRY_NAMES.BLOBS_PREFIX.length);
          currentBlobPath = decodeURIComponent(rawPath);
          currentBlobChunks = [];

          entry.ondata = async (err, chunk, final) => {
            if (err) {
              reject(new BackupError('ARCHIVE_CORRUPT', err));
              return;
            }
            if (chunk) {
              currentBlobChunks.push(chunk);
            }
            if (final) {
              const fullBlob = new Blob(currentBlobChunks as unknown as BlobPart[]);
              currentBlobChunks = [];
              const targetPath = currentBlobPath!;
              currentBlobPath = null;
              try {
                await callbacks.onBlob(targetPath, fullBlob);
              } catch (blobErr) {
                reject(blobErr);
              }
            }
          };
          entry.start();
          return;
        }

        // Regular JSON/NDJSON file
        const chunks: Uint8Array[] = [];
        entry.ondata = async (err, chunk, final) => {
          if (err) {
            reject(new BackupError('ARCHIVE_CORRUPT', err));
            return;
          }
          if (chunk) {
            chunks.push(chunk);
          }
          if (final) {
            const text = strFromU8(mergeChunks(chunks));
            if (entry.name === ENTRY_NAMES.MANIFEST) {
              manifestRaw = text;
            } else if (entry.name === ENTRY_NAMES.TAGS) {
              tagsRaw = text;
            } else if (entry.name === ENTRY_NAMES.COLLECTIONS) {
              collectionsRaw = text;
            } else if (entry.name === ENTRY_NAMES.ITEMS) {
              itemsNdjsonRaw = text;
            } else if (entry.name === ENTRY_NAMES.TRAILER) {
              trailerRaw = text;
              try {
                const trailer: BackupTrailer = JSON.parse(trailerRaw);
                await callbacks.onTrailer(trailer);
                resolve();
              } catch (tErr) {
                reject(new BackupError('ARCHIVE_CORRUPT', tErr));
              }
            }
          }
        };
        entry.start();
      };

      const stream = file.stream();
      const reader = stream.getReader();

      (async () => {
        try {
          while (true) {
            if (signal?.aborted) {
              await reader.cancel();
              reject(new BackupError('ABORTED'));
              return;
            }
            const { done, value } = await reader.read();
            if (done) {
              unzipper.push(new Uint8Array(0), true);
              if (!trailerRaw) {
                reject(new BackupError('ARCHIVE_INCOMPLETE'));
              }
              break;
            }
            if (value) {
              unzipper.push(value, false);
            }
          }
        } catch (readErr) {
          reject(new BackupError('ARCHIVE_CORRUPT', readErr));
        } finally {
          reader.releaseLock();
        }
      })();
    });
  }
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  let totalLength = 0;
  for (const c of chunks) totalLength += c.length;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}
