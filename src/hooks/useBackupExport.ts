import { useState, useRef, useCallback } from 'react';
import { backupService, type ExportProgress, type ExportResult } from '../backup';
import { BackupError } from '../backup/errors';

export function useBackupExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startExport = useCallback(async (includeFiles: boolean) => {
    setIsExporting(true);
    setError(null);
    setResult(null);
    setProgress({
      phase: 'snapshot',
      message: 'Đang chuẩn bị xuất dữ liệu...',
      doneBytes: 0,
      totalBytes: 0,
      doneBlobs: 0,
      totalBlobs: 0,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let writableStream: FileSystemWritableFileStream | null = null;

    // Direct user activation check for native File System Access API
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const d = new Date();
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
        const suggestedName = `KhoTriThuc-${dateStr}_${timeStr}.zip`;

        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: 'Kho Tri Thức Backup (.zip)',
              accept: { 'application/zip': ['.zip'] },
            },
          ],
        });
        writableStream = await handle.createWritable();
      } catch (pickerErr: any) {
        if (pickerErr?.name === 'AbortError') {
          // User cancelled native file picker
          setIsExporting(false);
          setProgress(null);
          return null;
        }
        // Fall back to memory Blob download
        console.warn('Native file picker failed, falling back to Blob download:', pickerErr);
      }
    }

    try {
      const exportRes = await backupService.exportBackup({
        includeFiles,
        signal: abortController.signal,
        writableStream,
        onProgress: setProgress,
      });

      setResult(exportRes);
      return exportRes;
    } catch (err: any) {
      if (err instanceof BackupError) {
        setError(err.userMessage);
      } else {
        setError(err?.message || 'Quá trình xuất bản sao lưu thất bại.');
      }
      return null;
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExporting(false);
      setProgress(null);
      setError('Đã hủy quá trình xuất bản sao lưu.');
    }
  }, []);

  const downloadFile = useCallback((res: ExportResult) => {
    if (!res.blob) return;
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  const shareFile = useCallback(async (res: ExportResult) => {
    if (!res.blob || !canShare) return;
    try {
      const file = new File([res.blob], res.fileName, { type: 'application/zip' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: res.fileName,
          text: 'Bản sao lưu Kho Tri Thức',
        });
      }
    } catch (err) {
      console.warn('Web Share API error:', err);
    }
  }, [canShare]);

  return {
    isExporting,
    progress,
    result,
    error,
    startExport,
    cancelExport,
    downloadFile,
    shareFile,
    canShare,
    clearError: () => setError(null),
    reset: () => {
      setResult(null);
      setError(null);
      setProgress(null);
    },
  };
}
