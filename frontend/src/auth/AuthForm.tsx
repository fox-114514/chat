import { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AuthFormProps {
  title: string;
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
  submitLabel,
  loadingLabel,
  altLink,
  error,
  isLoading,
  onSubmit,
  children,
}: AuthFormProps) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {children}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
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

        <Link
          to={altLink.to}
          className="mt-4 block text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {altLink.text}
        </Link>
      </div>
    </div>
  );
}
