import { Link } from 'react-router-dom';

export default function RegisterPage() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
          Register
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Phase 7 will implement the registration form.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Already have an account? Login →
        </Link>
      </div>
    </div>
  );
}
