import { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { uploadFile } from '../../api/files';
import { getApiErrorMessage } from '../../api/client';
import { getSocket } from '../../socket/socket';

interface MessageInputProps {
  roomId: string;
  onSendText: (content: string) => void;
  onSendFile: (fileMeta: { id: string; originalName: string }, type: 'file' | 'image') => void;
  disabled?: boolean;
}

const TYPING_STOP_DELAY = 1000;

export default function MessageInput({
  roomId,
  onSendText,
  onSendFile,
  disabled,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTypedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
    };
  }, []);

  const emitTypingStop = useCallback(() => {
    if (!hasTypedRef.current) return;
    try {
      getSocket().emit('typing:stop', { roomId });
    } catch {
      // ignore
    }
    hasTypedRef.current = false;
  }, [roomId]);

  const handleTyping = useCallback(() => {
    if (!hasTypedRef.current) {
      try {
        getSocket().emit('typing:start', { roomId });
      } catch {
        // ignore
      }
      hasTypedRef.current = true;
    }
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = setTimeout(() => {
      emitTypingStop();
    }, TYPING_STOP_DELAY);
  }, [roomId, emitTypingStop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    emitTypingStop();
    onSendText(trimmed);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    handleTyping();
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const uploaded = await uploadFile(file);
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
        const type: 'file' | 'image' =
          file.type.startsWith('image/') || imageExts.has(ext) ? 'image' : 'file';
        onSendFile(
          {
            id: uploaded.id,
            originalName: uploaded.originalName,
          },
          type,
        );
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onSendFile],
  );

  return (
    <div className="border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading || disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading file...' : 'Type a message...'}
          disabled={disabled || uploading}
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />

        <button
          type="submit"
          disabled={!content.trim() || disabled || uploading}
          className="rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
