export type BackupErrorCode =
  | 'NOT_A_BACKUP'
  | 'UNSUPPORTED_FORMAT_VERSION'
  | 'ARCHIVE_INCOMPLETE'
  | 'ARCHIVE_CORRUPT'
  | 'ENTRY_ORDER_INVALID'
  | 'BLOB_SIZE_MISMATCH'
  | 'METADATA_TOO_LARGE'
  | 'QUOTA_EXCEEDED'
  | 'LOCK_UNAVAILABLE'
  | 'DB_WRITE_FAILED'
  | 'ABORTED';

export const BACKUP_ERROR_MESSAGES: Record<BackupErrorCode, string> = {
  NOT_A_BACKUP: 'Tệp này không phải bản sao lưu của Kho Tri Thức.',
  UNSUPPORTED_FORMAT_VERSION: 'Bản sao lưu dùng định dạng mới hơn. Hãy cập nhật ứng dụng.',
  ARCHIVE_INCOMPLETE: 'Tệp sao lưu bị cắt hoặc ghi dở (thiếu phần kết thúc).',
  ARCHIVE_CORRUPT: 'Không thể đọc tệp sao lưu; tệp có thể bị hỏng.',
  ENTRY_ORDER_INVALID: 'Cấu trúc tệp sao lưu không đúng thứ tự dự kiến.',
  BLOB_SIZE_MISMATCH: 'Một tệp đính kèm bị lệch kích thước; đã hủy, dữ liệu hiện có không bị thay đổi.',
  METADATA_TOO_LARGE: 'Dữ liệu ghi chú quá lớn để xử lý một lần trên thiết bị này.',
  QUOTA_EXCEEDED: 'Không đủ dung lượng lưu trữ trên thiết bị.',
  LOCK_UNAVAILABLE: 'Một tác vụ khác đang chạy (có thể ở tab khác). Hãy thử lại sau giây lát.',
  DB_WRITE_FAILED: 'Không thể ghi vào cơ sở dữ liệu.',
  ABORTED: 'Đã hủy. Dữ liệu hiện có không bị thay đổi.',
};

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  readonly userMessage: string;
  readonly details?: unknown;

  constructor(code: BackupErrorCode, details?: unknown) {
    const userMessage = BACKUP_ERROR_MESSAGES[code] || 'Đã xảy ra lỗi không xác định trong quá trình sao lưu.';
    super(userMessage);
    this.name = 'BackupError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
    Object.setPrototypeOf(this, BackupError.prototype);
  }
}
