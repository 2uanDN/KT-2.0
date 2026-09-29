import React, { useState } from 'react';
import { Sheet } from '../sheets/Sheet';
import type { ImportReport } from '../../backup';

interface ImportReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  report: ImportReport | null;
}

export const ImportReportSheet: React.FC<ImportReportSheetProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  if (!report) return null;

  const durationSec = (report.durationMs / 1000).toFixed(1);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Kết quả khôi phục">
      <div className="space-y-4">
        {/* Success Banner */}
        <div className="p-3 rounded-lg bg-[#CDE8D6] border border-[#2E6B48] flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[24px] text-[#2E6B48]">
            check_circle
          </span>
          <div>
            <div className="font-mono text-xs font-bold text-[#2E6B48]">
              KHÔI PHỤC HOÀN TẤT ({durationSec}s)
            </div>
            <div className="text-xs text-[#1B1B1B]">
              Đã cập nhật dữ liệu và chỉ mục tìm kiếm vào kho tri thức của bạn.
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded bg-[#FAF9F7] border border-[#3D4A5C] shadow-hard-xs">
            <div className="text-[10px] font-mono uppercase text-[#44474C]">Đã thêm mới</div>
            <div className="font-mono text-lg font-bold text-[#2E6B48]">
              +{report.itemsAdded}
            </div>
            <div className="text-[9px] font-mono text-[#75777D]">mục tri thức</div>
          </div>

          <div className="p-2.5 rounded bg-[#FAF9F7] border border-[#3D4A5C] shadow-hard-xs">
            <div className="text-[10px] font-mono uppercase text-[#44474C]">Đã cập nhật</div>
            <div className="font-mono text-lg font-bold text-[#3D4A5C]">
              {report.itemsUpdated}
            </div>
            <div className="text-[9px] font-mono text-[#75777D]">mục ghi đè/mới hơn</div>
          </div>

          <div className="p-2.5 rounded bg-[#FAF9F7] border border-[#3D4A5C] shadow-hard-xs">
            <div className="text-[10px] font-mono uppercase text-[#44474C]">Đã bỏ qua</div>
            <div className="font-mono text-lg font-bold text-[#75777D]">
              {report.itemsSkipped}
            </div>
            <div className="text-[9px] font-mono text-[#75777D]">mục cũ hơn/trùng</div>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C]/40 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-[#3D4A5C]/15 pb-1.5">
            <span className="text-[#44474C]">Chế độ thực thi:</span>
            <span className="font-mono font-bold text-[#1B1B1B]">
              {report.mode === 'replace' ? 'THAY THẾ TOÀN BỘ' : 'GỘP (MERGE)'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[#3D4A5C]/15 pb-1.5">
            <span className="text-[#44474C]">Thẻ phân loại:</span>
            <span className="font-mono text-[#1B1B1B]">
              Tạo mới {report.tagsCreated} / Gộp {report.tagsMerged}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[#3D4A5C]/15 pb-1.5">
            <span className="text-[#44474C]">Bộ sưu tập:</span>
            <span className="font-mono text-[#1B1B1B]">
              Tạo mới {report.collectionsCreated} / Gộp {report.collectionsMerged}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#44474C]">Tệp đính kèm:</span>
            <span className="font-mono text-[#1B1B1B]">
              Ghi mới {report.blobsStored} / Tái dùng {report.blobsReused}
              {report.blobsRenamed > 0 ? ` / Đổi tên ${report.blobsRenamed}` : ''}
            </span>
          </div>
        </div>

        {/* Warnings Section */}
        {report.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-[#FBE3B3]/40 border border-[#8A5A00]/40 space-y-2">
            <div className="flex items-center justify-between text-[#8A5A00] font-mono text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Thông báo lưu ý ({report.warnings.length})</span>
              </div>
              {report.warnings.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllWarnings(!showAllWarnings)}
                  className="underline hover:text-[#1B1B1B] cursor-pointer"
                >
                  {showAllWarnings ? 'Thu gọn' : 'Xem tất cả'}
                </button>
              )}
            </div>

            <ul className="text-xs text-[#1B1B1B] list-disc list-inside space-y-1">
              {(showAllWarnings ? report.warnings : report.warnings.slice(0, 3)).map(
                (w, idx) => (
                  <li key={idx} className="break-words">
                    {w}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        {/* Close Button */}
        <div className="pt-3 flex justify-end border-t border-[#3D4A5C]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-xs font-mono font-bold bg-[#3D4A5C] text-white hover:bg-[#1B1B1B] transition shadow-hard-xs cursor-pointer press-sm border border-[#1B1B1B]"
          >
            ĐÓNG VÀ HOÀN TẤT
          </button>
        </div>
      </div>
    </Sheet>
  );
};
