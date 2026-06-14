import { useEffect, useState } from 'react';
import { getAccessToken } from '../../api/client';
import { Loader2, ImageOff } from 'lucide-react';

interface SecureImageProps {
  fileId: string;
  alt: string;
  className?: string;
}

export default function SecureImage({ fileId, alt, className = '' }: SecureImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    async function load() {
      try {
        const token = getAccessToken();
        const response = await fetch(`/api/files/${fileId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        if (!cancelled) {
          setObjectUrl(url);
          setStatus('loading'); // keep loading until image onLoad
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [fileId]);

  if (status === 'error') {
    return (
      <div
        className={`flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400 ${className}`}
      >
        <ImageOff className="h-4 w-4" />
        <span className="truncate">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {objectUrl ? (
        <img
          src={objectUrl}
          alt={alt}
          className="h-full w-full object-contain"
          onLoad={() => setStatus('loading')}
          onError={() => setStatus('error')}
          loading="lazy"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}
