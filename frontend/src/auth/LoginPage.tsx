import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AuthForm from './AuthForm';
import { getApiErrorMessage } from '../api/client';

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/chat', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to continue messaging"
      submitLabel="Sign in"
      loadingLabel="Signing in..."
      altLink={{ to: '/register', text: "Don't have an account? Sign up" }}
      error={error}
      isLoading={isSubmitting}
      onSubmit={handleSubmit}
    >
      <div>
        <label
          htmlFor="username"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:bg-gray-800"
          placeholder="Enter your username"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:bg-gray-800"
          placeholder="Enter your password"
        />
      </div>
    </AuthForm>
  );
}
