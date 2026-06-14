import type { Message } from '../../types/models';
import Avatar from '../common/Avatar';
import SecureImage from '../common/SecureImage';
import { formatTime } from '../../utils/format';
import { Download, FileText, ImageOff } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isMe: boolean;
  showAvatar?: boolean;
}

export default function MessageItem({ message, isMe, showAvatar = true }: MessageItemProps) {
  const { sender, content, type, file, createdAt } = message;

  return (
    <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 flex-shrink-0">
        {showAvatar && (
          <Avatar username={sender.username} avatarColor={sender.avatarColor} size="sm" />
        )}
      </div>

      <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="mb-0.5 flex items-center gap-2 px-1">
          {!isMe && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {sender.username}
            </span>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {formatTime(createdAt)}
          </span>
        </div>

        <div
          className={`relative overflow-hidden shadow-sm ${
            isMe
              ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-blue-500 to-blue-600 text-white'
              : 'rounded-2xl rounded-bl-md border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
          }`}
        >
          {type === 'text' && (
            <p className="whitespace-pre-wrap px-3.5 py-2 text-[15px] leading-relaxed">{content}</p>
          )}

          {type === 'image' && file && (
            <div className="p-1">
              <SecureImage
                fileId={file.id}
                alt={file.originalName}
                className="max-h-64 min-h-[120px] w-auto min-w-[120px] rounded-xl"
              />
              {content && content !== file.originalName && (
                <p className={`px-3 py-1.5 text-xs ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>
                  {content}
                </p>
              )}
            </div>
          )}

          {type === 'file' && file && (
            <a
              href={`/api/files/${file.id}`}
              download={file.originalName}
              className={`m-1 flex items-center gap-3 rounded-xl p-2.5 transition-colors ${
                isMe
                  ? 'bg-blue-700/50 hover:bg-blue-700/70'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
                <FileText className="h-5 w-5 flex-shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.originalName}</p>
                <p className={`text-xs ${isMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {formatFileSize(file.sizeBytes)}
                </p>
              </div>
              <Download className="h-4 w-4 flex-shrink-0 opacity-80" />
            </a>
          )}

          {type === 'image' && !file && (
            <div className="flex items-center gap-2 px-3.5 py-2 text-sm opacity-80">
              <ImageOff className="h-4 w-4" />
              <span>Image unavailable</span>
            </div>
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
