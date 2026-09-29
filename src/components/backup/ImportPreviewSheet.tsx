import React, { useState } from 'react';
import { Sheet } from '../sheets/Sheet';
import { ConfirmSheet } from '../sheets/ConfirmSheet';
import { formatFileSize } from '../../services/FileService';
import type { AnalyzeResult, ImportMode, ConflictPolicy } from '../../backup';

interface ImportPreviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalyzeResult | null;
  onConfirm: (mode: ImportMode, conflict: ConflictPolicy) => void;
  onQuickExportCurrent?: () => void;
  currentItemsCount: number;
}

export const ImportPreviewSheet: React.FC<ImportPreviewSheetProps> = ({
  isOpen,
  onClose,
  analysis,
  onConfirm,
  onQuickExportCurrent,
  currentItemsCount,
}) => {
  const [mode, setMode] = useState<ImportMode>('merge');
  const [conflict, setConflict] = useState<ConflictPolicy>('newer');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  if (!analysis) return null;

  const { manifest } = analysis;
  const createdDateStr = new Date(manifest.createdAt).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleStartImport = () => {
    if (mode === 'replace') {
      setShowReplaceConfirm(true);
    } else {
      onConfirm(mode, conflict);
      onClose();
    }
  };

  const handleConfirmReplace = () => {
    setShowReplaceConfirm(false);
    onConfirm('replace', conflict);
    onClose();
  };

  return (
    <>
      <Sheet isOpen={isOpen} onClose={onClose} title="Xem trước bản sao lưu">
        <div className="space-y-4">
          {/* Metadata Card */}
          <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C] space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-[#3D4A5C]/20 pb-1.5">
              <span className="text-[#44474C] font-medium">Thời gian sao lưu:</span>
              <span className="font-mono font-bold text-[#1B1B1B]">{createdDateStr}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-[#3D4A5C]/20 pb-1.5">
              <span className="text-[#44474C] font-medium">Phiên bản sao lưu:</span>
              <span className="font-mono text-[#3D4A5C] font-semibold">
                v{manifest.formatVersion} (KT {manifest.app.build})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#44474C] font-medium">Kèm tệp đính kèm:</span>
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  manifest.options.includeFiles
                    ? 'bg-[#CDE8D6] text-[#2E6B48]'
                    : 'bg-[#FBE3B3] text-[#8A5A00]'
                }`}
              >
                {manifest.options.includeFiles ? 'CÓ KÈM TỆP' : 'KHÔNG KÈM TỆP'}
              </span>
            </div>
          </div>

          {/* Counts Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#3D4A5C] shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Mục tri thức</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {analysis.parsedItemsCount}
              </div>
              <div className="text-[9px] font-mono text-[#75777D]">
                {analysis.newItemsCount} mới / {analysis.existingSameIdCount} trùng
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#3D4A5C] shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Thẻ phân loại</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {analysis.parsedTagsCount}
              </div>
              <div className="text-[9px] font-mono text-[#75777D]">
                {analysis.tagsToRemapCount > 0 ? `Gộp ${analysis.tagsToRemapCount}` : 'Chuẩn'}
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#3D4A5C] shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Bộ sưu tập</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {analysis.parsedCollectionsCount}
              </div>
              <div className="text-[9px] font-mono text-[#75777D]">
                {analysis.collectionsToRemapCount > 0 ? `Gộp ${analysis.collectionsToRemapCount}` : 'Chuẩn'}
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#FFFFFF] border border-[#3D4A5C] shadow-hard-xs">
              <div className="text-[10px] font-mono uppercase text-[#44474C]">Tệp nhị phân</div>
              <div className="font-mono text-base font-bold text-[#1B1B1B]">
                {analysis.parsedBlobsCount}
              </div>
              <div className="text-[9px] font-mono text-[#75777D]">
                {formatFileSize(manifest.sizes.declaredBlobBytes)}
              </div>
            </div>
          </div>

          {/* Warnings List if any */}
          {analysis.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-[#FBE3B3]/40 border border-[#8A5A00]/40 space-y-1">
              <div className="flex items-center gap-1.5 text-[#8A5A00] font-mono text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>Lưu ý khi phân tích:</span>
              </div>
              <ul className="text-xs text-[#1B1B1B] list-disc list-inside space-y-0.5">
                {analysis.warnings.slice(0, 3).map((w, idx) => (
                  <li key={idx} className="break-words">
                    {w}
                  </li>
                ))}
                {analysis.warnings.length > 3 && (
                  <li className="text-[#44474C] italic">
                    ...và {analysis.warnings.length - 3} lưu ý khác.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Import Mode Selection */}
          <div className="space-y-2 pt-1">
            <label className="font-mono text-xs font-bold uppercase tracking-wider text-[#1B1B1B] block">
              Chế độ khôi phục
            </label>

            {/* Option 1: Merge */}
            <div
              onClick={() => setMode('merge')}
              className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                mode === 'merge'
                  ? 'border-[#3D4A5C] bg-[#FAF9F7] shadow-hard-xs'
                  : 'border-[#3D4A5C]/20 hover:border-[#3D4A5C]/50 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                    className="accent-[#3D4A5C]"
                  />
                  <span className="font-mono text-xs font-bold text-[#1B1B1B]">
                    GỘP VÀO KHO HIỆN TẠI (Merge)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#CDE8D6] text-[#2E6B48] rounded font-bold">
                  Khuyên dùng
                </span>
              </div>
              <p className="text-xs text-[#44474C] mt-1.5 pl-5">
                Thêm các mục mới và cập nhật các mục có sẵn. Không làm mất dữ liệu độc nhất đang có trong máy.
              </p>

              {/* Conflict Policy Sub-selection */}
              {mode === 'merge' && (
                <div className="mt-3 pt-2.5 border-t border-[#3D4A5C]/20 pl-5 space-y-2">
                  <span className="font-mono text-[11px] font-bold text-[#3D4A5C] block">
                    Chính sách khi trùng mục (cùng ID):
                  </span>
                  <div className="space-y-1.5">
                    {[
                      {
                        value: 'newer',
                        label: 'Mục mới hơn thắng (So sánh thời gian sửa)',
                        desc: 'Tự động chọn phiên bản cập nhật gần nhất.',
                      },
                      {
                        value: 'skip',
                        label: 'Bỏ qua (Giữ nguyên mục trong kho)',
                        desc: 'Ưu tiên dữ liệu trên thiết bị hiện tại.',
                      },
                      {
                        value: 'overwrite',
                        label: 'Ghi đè bằng mục từ bản sao lưu',
                        desc: 'Dữ liệu trong tệp sao lưu luôn ghi đè.',
                      },
                    ].map((p) => (
                      <label
                        key={p.value}
                        className="flex items-start gap-2 cursor-pointer text-xs"
                      >
                        <input
                          type="radio"
                          name="conflictPolicy"
                          value={p.value}
                          checked={conflict === p.value}
                          onChange={() => setConflict(p.value as ConflictPolicy)}
                          className="mt-0.5 accent-[#3D4A5C]"
                        />
                        <div>
                          <span className="font-medium text-[#1B1B1B]">{p.label}</span>
                          <span className="block text-[11px] text-[#75777D]">{p.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Option 2: Replace */}
            <div
              onClick={() => {
                if (analysis.canReplace) setMode('replace');
              }}
              className={`p-3 rounded-lg border-2 transition ${
                !analysis.canReplace
                  ? 'opacity-50 cursor-not-allowed border-dashed border-[#75777D]/40 bg-[#E2E2E2]/30'
                  : mode === 'replace'
                  ? 'border-[#BA1A1A] bg-[#FFDAD6]/20 shadow-hard-xs cursor-pointer'
                  : 'border-[#3D4A5C]/20 hover:border-[#BA1A1A]/50 bg-white cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    disabled={!analysis.canReplace}
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                    className="accent-[#BA1A1A]"
                  />
                  <span
                    className={`font-mono text-xs font-bold ${
                      mode === 'replace' ? 'text-[#BA1A1A]' : 'text-[#1B1B1B]'
                    }`}
                  >
                    THAY THẾ TOÀN BỘ (Replace)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#FFDAD6] text-[#93000A] rounded font-bold">
                  Xóa kho cũ
                </span>
              </div>
              <p className="text-xs text-[#44474C] mt-1.5 pl-5">
                Xóa toàn bộ {currentItemsCount} mục hiện có trên thiết bị và thay thế chính xác bằng nội dung bản sao lưu.
              </p>
              {!analysis.canReplace && (
                <p className="text-[11px] font-mono text-[#BA1A1A] mt-1 pl-5">
                  * Không thể thay thế vì bản sao lưu này không chứa tệp đính kèm.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#3D4A5C]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer press-xs"
            >
              HỦY
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold text-white transition shadow-hard-xs cursor-pointer press-sm border ${
                mode === 'replace'
                  ? 'bg-[#BA1A1A] hover:bg-[#93000A] border-[#93000A]'
                  : 'bg-[#3D4A5C] hover:bg-[#1B1B1B] border-[#1B1B1B]'
              }`}
            >
              BẮT ĐẦU KHÔI PHỤC
            </button>
          </div>
        </div>
      </Sheet>

      {/* Confirmation Sheet for Replace Mode */}
      <ConfirmSheet
        isOpen={showReplaceConfirm}
        onClose={() => setShowReplaceConfirm(false)}
        title="Xác nhận thay thế toàn bộ"
        customMessage={`Chế độ này sẽ xóa vĩnh viễn toàn bộ ${currentItemsCount} mục tri thức hiện có trong kho trên thiết bị này và thay thế bằng bản sao lưu. Bạn nên xuất bản sao lưu kho hiện tại trước khi tiếp tục.`}
        confirmLabel="Đồng ý thay thế toàn bộ"
        isDestructive
        onConfirm={handleConfirmReplace}
      />
    </>
  );
};
