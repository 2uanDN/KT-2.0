export type ItemType = 'note' | 'file' | 'link';
export type ItemStatus = 'inbox' | 'saved';

export interface BaseItem {
  id: string;                     // crypto.randomUUID()
  type: ItemType;
  status: ItemStatus;
  title: string;                  // Bắt buộc sau khi save; note tự sinh từ body[0]
  normalizedTitle?: string;       // Tiêu đề chuẩn hóa (lowercase, bỏ dấu, chuẩn hóa khoảng trắng)
  isPinned: boolean;
  tags: string[];                 // mảng tag id
  collections: string[];          // mảng collection id
  createdAt: number;              // Date.now() khi tạo form
  savedAt: number | null;         // null khi status=inbox; set khi Giữ lâu dài
  lastOpenedAt: number | null;    // set khi mở màn chi tiết
  updatedAt?: number;             // set khi sửa/cập nhật item (Schema v2)
}

export interface NoteItem extends BaseItem {
  type: 'note';
  body: string;                   // plain text hoặc Markdown
}

export type FileType = 'pdf' | 'image' | 'markdown';

export type LinkFetchStatus = 'idle' | 'pending' | 'success' | 'failed';

export interface StoredFile {
  id: string;
  originalFilename: string;
  displayName?: string;
  fileSizeBytes: number;
  opfsPath: string;
  mimeType: string;
  fileType: FileType;
  isThumbnail?: boolean;
}

export interface FileItem extends BaseItem {
  type: 'file';
  fileType: FileType;
  originalFilename: string;
  displayName: string;            // sửa được
  caption: string;
  fileSizeBytes: number;
  opfsPath: string;               // path trong OPFS (tệp chính / tệp đầu tiên)
  mimeType: string;
  thumbnailBlobUrl?: string;      // path trong OPFS của thumbnail preview
  thumbnailFileId?: string;       // id của file được chọn làm thumbnail
  files?: StoredFile[];           // danh sách toàn bộ các tệp đính kèm
}

export interface LinkItem extends BaseItem {
  type: 'link';
  url: string;
  domain: string;                 // tự parse từ URL
  reason: string;                 // "vì sao giữ"
  fetchedTitle: string | null;    // null nếu chưa fetch hoặc fetch thất bại
  previewImageUrl: string | null;
  fetchStatus: LinkFetchStatus;
}

export type Item = NoteItem | FileItem | LinkItem;

export interface QueuedFileDraft {
  id: string;
  file?: File;
  storedFile?: StoredFile;
  originalFilename: string;
  fileSizeBytes: number;
  fileType: FileType;
  mimeType: string;
  isImage: boolean;
  isThumbnail?: boolean;
  objectUrl?: string;
}

export interface CreateItemDraft {
  type: ItemType;
  title?: string;
  tags?: string[];
  collections?: string[];
  isPinned?: boolean;
  // Note specific
  body?: string;
  // File specific
  file?: File;
  files?: File[];
  fileQueue?: QueuedFileDraft[];
  selectedThumbnailId?: string | null;
  fileType?: FileType;
  displayName?: string;
  caption?: string;
  // Link specific
  url?: string;
  reason?: string;
  fetchedTitle?: string | null;
  previewImageUrl?: string | null;
  fetchStatus?: LinkFetchStatus;
}
