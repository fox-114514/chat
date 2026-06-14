import { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  loadingLabel: string;
  altLink: { to: string; text: string };
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  loadingLabel,
  altLink,
  error,
  isLoading,
  onSubmit,
  children,
}: AuthFormProps) {
  return (
    <div className="auth-bg flex min-h-full items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white/80 p-6 shadow-xl shadow-gray-200/50 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-none sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            {children}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loadingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to={altLink.to}
              className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400"
            >
              {altLink.text}
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
          Private & secure messaging
        </p>
      </div>
    </div>
  );
}
