import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/shell/TopBar';
import { BackupSection } from '../components/backup/BackupSection';
import { ProgressBar } from '../components/backup/ProgressBar';
import { ImportPreviewSheet } from '../components/backup/ImportPreviewSheet';
import { ImportReportSheet } from '../components/backup/ImportReportSheet';
import { InlineError } from '../components/feedback/InlineError';
import { useStorageEstimate } from '../hooks/useStorageEstimate';
import { useBackupExport } from '../hooks/useBackupExport';
import { useBackupImport } from '../hooks/useBackupImport';
import { formatFileSize } from '../services/FileService';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storage = useStorageEstimate();
  const exporter = useBackupExport();
  const importer = useBackupImport();

  const [includeFiles, setIncludeFiles] = useState(true);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [persistRequested, setPersistRequested] = useState(false);

  const hasNativeSavePicker =
    typeof window !== 'undefined' && 'showSaveFilePicker' in window;

  const isLargeEstimatedSize = storage.approxBytes > 500 * 1024 * 1024; // 500 MB threshold

  const handleStartExport = async () => {
    const res = await exporter.startExport(includeFiles);
    if (res) {
      storage.refresh();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file works
    e.target.value = '';

    const analysisRes = await importer.analyzeFile(file);
    if (analysisRes) {
      setShowPreviewSheet(true);
    }
  };

  const handleExecuteImport = async (mode: any, conflict: any) => {
    const reportRes = await importer.executeImport(mode, conflict);
    if (reportRes) {
      setShowReportSheet(true);
      storage.refresh();
    }
  };

  const handleRequestPersistence = async () => {
    setPersistRequested(true);
    await storage.requestPersistence();
    setPersistRequested(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]">
      {/* TopBar */}
      <TopBar
        variant="detail"
        backLabel="Thư viện"
        title="Cài đặt & Sao lưu"
        onBack={() => navigate('/')}
      />

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* CARD 1: KHO DỮ LIỆU */}
        <BackupSection title="Kho dữ liệu cục bộ" icon="database">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded bg-[#FAF9F7] border border-[#3D4A5C]/40 shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Mục tri thức</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {storage.itemCount}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#FAF9F7] border border-[#3D4A5C]/40 shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Thẻ phân loại</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {storage.tagCount}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#FAF9F7] border border-[#3D4A5C]/40 shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Bộ sưu tập</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {storage.collectionCount}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C]/30 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#44474C]">Dung lượng sử dụng:</span>
              <span className="font-mono font-bold text-[#1B1B1B]">
                {formatFileSize(storage.usageBytes)}
                {storage.quotaBytes > 0 && ` / ${formatFileSize(storage.quotaBytes)}`}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[#3D4A5C]/15 pt-2">
              <span className="text-[#44474C]">Chế độ lưu trữ:</span>
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  storage.isPersisted
                    ? 'bg-[#CDE8D6] text-[#2E6B48]'
                    : 'bg-[#FBE3B3] text-[#8A5A00]'
                }`}
              >
                {storage.isPersisted ? 'BỀN VỮNG (PERSISTED)' : 'TỰ ĐỘNG DỌN DẸP'}
              </span>
            </div>
          </div>

          {!storage.isPersisted && (
            <button
              type="button"
              disabled={persistRequested}
              onClick={handleRequestPersistence}
              className="w-full py-2 px-3 rounded-lg text-xs font-mono font-bold border border-[#3D4A5C] bg-[#FAF9F7] hover:bg-white text-[#3D4A5C] hover:text-[#1B1B1B] transition shadow-hard-xs cursor-pointer press-xs flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span>YÊU CẦU LƯU TRỮ BỀN VỮNG (TRÁNH BỊ TRÌNH DUYỆT XÓA)</span>
            </button>
          )}
        </BackupSection>

        {/* CARD 2: XUẤT BẢN SAO LƯU */}
        <BackupSection title="Xuất bản sao lưu" icon="archive">
          <p className="type-body-sm text-[#44474C]">
            Đóng gói toàn bộ ghi chú, thẻ, bộ sưu tập và tệp đính kèm vào một tệp ZIP chuẩn duy nhất.
          </p>

          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C]/30 cursor-pointer">
            <input
              type="checkbox"
              checked={includeFiles}
              onChange={(e) => setIncludeFiles(e.target.checked)}
              className="mt-0.5 accent-[#3D4A5C] w-4 h-4"
            />
            <div className="text-xs">
              <span className="font-bold text-[#1B1B1B] block">
                Kèm tệp đính kèm (Ảnh, PDF, Tài liệu)
              </span>
              <span className="text-[#44474C] block mt-0.5">
                Ước tính: {storage.fileCount} tệp (~{formatFileSize(storage.approxBytes)})
              </span>
            </div>
          </label>

          {isLargeEstimatedSize && !hasNativeSavePicker && includeFiles && (
            <div className="p-2.5 rounded bg-[#FBE3B3]/40 border border-[#8A5A00]/40 text-xs text-[#8A5A00] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
              <span>
                Dung lượng tệp lớn (&gt;500MB). Nếu thiết bị báo bộ nhớ đầy, bạn có thể bỏ tùy chọn "Kèm tệp" để sao lưu metadata nhẹ hơn.
              </span>
            </div>
          )}

          {/* Active Export Progress */}
          {exporter.isExporting && exporter.progress && (
            <ProgressBar
              phase={
                exporter.progress.phase === 'snapshot'
                  ? 'Đang chuẩn bị...'
                  : exporter.progress.phase === 'pack'
                  ? 'Đang đóng gói...'
                  : 'Đang hoàn tất...'
              }
              message={exporter.progress.message}
              doneCount={exporter.progress.doneBlobs}
              totalCount={exporter.progress.totalBlobs}
              onCancel={exporter.cancelExport}
              canCancel={exporter.progress.phase !== 'finalize'}
            />
          )}

          {/* Error Message */}
          {exporter.error && (
            <InlineError
              message={exporter.error}
              onRetry={handleStartExport}
            />
          )}

          {/* Completed Result Actions */}
          {exporter.result && (
            <div className="p-3 rounded-lg bg-[#CDE8D6] border border-[#2E6B48] space-y-2.5">
              <div className="flex items-center gap-2 text-[#2E6B48] font-mono text-xs font-bold">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>ĐÃ TẠO BẢN SAO LƯU ({formatFileSize(exporter.result.sizeBytes)})</span>
              </div>
              <div className="text-xs text-[#1B1B1B] font-mono truncate">
                {exporter.result.fileName}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {exporter.result.delivery === 'saved-to-disk' ? (
                  <span className="text-xs font-mono text-[#2E6B48] font-semibold">
                    ✓ Đã lưu thẳng vào ổ đĩa thiết bị
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => exporter.downloadFile(exporter.result!)}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#2E6B48] text-white hover:bg-[#1f4a31] transition shadow-hard-xs cursor-pointer press-xs flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>LƯU TỆP ZIP</span>
                    </button>

                    {exporter.canShare && (
                      <button
                        type="button"
                        onClick={() => exporter.shareFile(exporter.result!)}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-white text-[#2E6B48] border border-[#2E6B48] hover:bg-[#FAF9F7] transition shadow-hard-xs cursor-pointer press-xs flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">share</span>
                        <span>CHIA SẺ</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!exporter.isExporting && (
            <button
              type="button"
              onClick={handleStartExport}
              className="w-full py-2.5 px-4 rounded-lg text-xs font-mono font-bold bg-[#3D4A5C] text-white hover:bg-[#1B1B1B] transition shadow-hard-sm cursor-pointer press-sm flex items-center justify-center gap-2 border border-[#1B1B1B]"
            >
              <span className="material-symbols-outlined text-[18px]">file_download</span>
              <span>XUẤT BẢN SAO LƯU (.ZIP)</span>
            </button>
          )}
        </BackupSection>

        {/* CARD 3: KHÔI PHỤC DỮ LIỆU */}
        <BackupSection title="Khôi phục dữ liệu" icon="unarchive">
          <p className="type-body-sm text-[#44474C]">
            Chọn tệp sao lưu .zip để xem trước các mục, giải quyết trùng lặp và khôi phục vào kho tri thức.
          </p>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Analyzing Progress */}
          {importer.isAnalyzing && (
            <ProgressBar
              phase="Đang phân tích"
              message="Đang đọc tệp sao lưu và kiểm tra tính hợp lệ..."
              canCancel={false}
            />
          )}

          {/* Importing Execution Progress */}
          {importer.isImporting && importer.progress && (
            <ProgressBar
              phase={
                importer.progress.phase === 'staging'
                  ? 'Đang lưu tệp'
                  : importer.progress.phase === 'verify'
                  ? 'Đang xác minh'
                  : importer.progress.phase === 'commit'
                  ? 'Đang lưu DB'
                  : 'Đang hoàn tất'
              }
              message={importer.progress.message}
              percent={importer.progress.percent}
              doneCount={importer.progress.doneBlobs}
              totalCount={importer.progress.totalBlobs}
              canCancel={false}
            />
          )}

          {/* Error Message */}
          {importer.error && (
            <InlineError
              message={importer.error}
              onRetry={() => fileInputRef.current?.click()}
            />
          )}

          {!importer.isAnalyzing && !importer.isImporting && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 rounded-lg text-xs font-mono font-bold bg-[#FAF9F7] text-[#1B1B1B] hover:bg-white border-2 border-[#3D4A5C] transition shadow-hard-sm cursor-pointer press-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>CHỌN TỆP SAO LƯU ĐỂ KHÔI PHỤC</span>
            </button>
          )}
        </BackupSection>

        {/* CARD 4: TRẠNG THÁI SAO LƯU */}
        <BackupSection title="Trạng thái sao lưu" icon="history">
          <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C]/30 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#44474C]">Lần sao lưu gần nhất:</span>
              <span className="font-mono font-bold text-[#1B1B1B]">
                {storage.lastExportAt
                  ? new Date(storage.lastExportAt).toLocaleString('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Chưa từng sao lưu'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[#3D4A5C]/15 pt-2">
              <span className="text-[#44474C]">Lần khôi phục gần nhất:</span>
              <span className="font-mono text-[#1B1B1B]">
                {storage.lastImportAt
                  ? new Date(storage.lastImportAt).toLocaleString('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Chưa có'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[#3D4A5C]/15 pt-2">
              <span className="text-[#44474C]">Thay đổi chưa sao lưu:</span>
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  storage.unbackedChangesCount > 0
                    ? 'bg-[#FFDAD6] text-[#93000A]'
                    : 'bg-[#CDE8D6] text-[#2E6B48]'
                }`}
              >
                {storage.unbackedChangesCount} mục
              </span>
            </div>
          </div>

          {storage.unbackedChangesCount > 0 && (
            <div className="p-3 rounded-lg bg-[#FFDAD6]/40 border border-[#BA1A1A]/40 text-xs text-[#93000A] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0 text-[#BA1A1A]">
                notifications_active
              </span>
              <span>
                Có {storage.unbackedChangesCount} mục tri thức chưa được đưa vào bản sao lưu. Hãy xuất bản sao lưu định kỳ để tránh rủi ro mất dữ liệu khi xóa trình duyệt.
              </span>
            </div>
          )}
        </BackupSection>
      </div>

      {/* Import Preview Sheet */}
      <ImportPreviewSheet
        isOpen={showPreviewSheet}
        onClose={() => setShowPreviewSheet(false)}
        analysis={importer.analysis}
        currentItemsCount={storage.itemCount}
        onConfirm={handleExecuteImport}
      />

      {/* Import Report Sheet */}
      <ImportReportSheet
        isOpen={showReportSheet}
        onClose={() => {
          setShowReportSheet(false);
          importer.reset();
        }}
        report={importer.report}
      />
    </div>
  );
};
