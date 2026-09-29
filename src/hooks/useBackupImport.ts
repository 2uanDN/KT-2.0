import { useState, useRef, useCallback } from 'react';
import {
  backupService,
  type AnalyzeResult,
  type ImportMode,
  type ConflictPolicy,
  type ImportProgress,
  type ImportReport,
} from '../backup';
import { BackupError } from '../backup/errors';

export function useBackupImport() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const analyzeFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setReport(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await backupService.analyze(file, abortController.signal);
      setAnalysis(res);
      return res;
    } catch (err: any) {
      if (err instanceof BackupError) {
        setError(err.userMessage);
      } else {
        setError(err?.message || 'Không thể phân tích tệp sao lưu.');
      }
      return null;
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  }, []);

  const executeImport = useCallback(
    async (mode: ImportMode, conflict: ConflictPolicy) => {
      if (!selectedFile || !analysis) {
        setError('Chưa chọn tệp sao lưu hợp lệ.');
        return null;
      }

      setIsImporting(true);
      setError(null);
      setReport(null);
      setProgress({
        phase: 'staging',
        message: 'Đang bắt đầu khôi phục...',
        percent: 0,
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const rep = await backupService.importBackup(selectedFile, analysis, {
          mode,
          conflict,
          signal: abortController.signal,
          onProgress: setProgress,
        });

        setReport(rep);
        return rep;
      } catch (err: any) {
        if (err instanceof BackupError) {
          setError(err.userMessage);
        } else {
          setError(err?.message || 'Quá trình khôi phục thất bại.');
        }
        return null;
      } finally {
        setIsImporting(false);
        abortControllerRef.current = null;
      }
    },
    [selectedFile, analysis]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsAnalyzing(false);
      setIsImporting(false);
      setProgress(null);
      setError('Đã hủy thao tác.');
    }
  }, []);

  const reset = useCallback(() => {
    setSelectedFile(null);
    setAnalysis(null);
    setReport(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    isAnalyzing,
    isImporting,
    selectedFile,
    analysis,
    progress,
    report,
    error,
    analyzeFile,
    executeImport,
    cancel,
    reset,
    clearError: () => setError(null),
  };
}
