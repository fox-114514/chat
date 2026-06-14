import type { Message } from '../../types/models';
import Avatar from '../common/Avatar';
import { formatTime } from '../../utils/format';
import { Download, FileText } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isMe: boolean;
}

export default function MessageItem({ message, isMe }: MessageItemProps) {
  const { sender, content, type, file, createdAt } = message;

  return (
    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      <Avatar username={sender.username} avatarColor={sender.avatarColor} size="sm" />
      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {sender.username}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatTime(createdAt)}</span>
        </div>

        <div
          className={`rounded-2xl px-4 py-2 ${
            isMe
              ? 'rounded-br-none bg-blue-600 text-white'
              : 'rounded-bl-none border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
          }`}
        >
          {type === 'text' && <p className="whitespace-pre-wrap text-sm">{content}</p>}

          {type === 'image' && file && (
            <div className="space-y-1">
              <img
                src={file.url}
                alt={file.originalName}
                className="max-h-60 max-w-full rounded-md object-contain"
                loading="lazy"
              />
              {content && content !== file.originalName && (
                <p className="text-xs opacity-90">{content}</p>
              )}
            </div>
          )}

          {type === 'file' && file && (
            <a
              href={file.url}
              download={file.originalName}
              className={`flex items-center gap-3 rounded-md p-2 ${
                isMe ? 'bg-blue-700 hover:bg-blue-800' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <FileText className="h-8 w-8 flex-shrink-0 opacity-80" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.originalName}</p>
                <p className="text-xs opacity-80">{formatFileSize(file.sizeBytes)}</p>
              </div>
              <Download className="h-4 w-4 flex-shrink-0 opacity-80" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
