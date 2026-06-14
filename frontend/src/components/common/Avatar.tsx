interface AvatarProps {
  username: string;
  avatarColor?: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const onlineBadgeSizes = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

export default function Avatar({
  username,
  avatarColor = '#3b82f6',
  size = 'md',
  isOnline,
}: AvatarProps) {
  const initial = username.charAt(0).toUpperCase() || '?';
  return (
    <div className="relative inline-flex flex-shrink-0">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full font-medium text-white ${sizeClasses[size]}`}
        style={{ backgroundColor: avatarColor }}
        title={username}
      >
        {initial}
      </div>
      {isOnline !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-gray-900 ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          } ${onlineBadgeSizes[size]}`}
        />
      )}
    </div>
  );
}
