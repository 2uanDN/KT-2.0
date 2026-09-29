import { useState, useEffect } from 'react';
import { fileStorage } from '../db/opfs';

export function useOPFSUrl(opfsPath?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opfsPath) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setLoading(true);
    setError(null);

    fileStorage
      .readFile(opfsPath)
      .then((file) => {
        if (!active) return;
        if (file) {
          objectUrl = URL.createObjectURL(file);
          setUrl(objectUrl);
        } else {
          setError('Không tìm thấy tệp trong bộ nhớ');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Lỗi khi tải tệp');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [opfsPath]);

  return { url, loading, error };
}
