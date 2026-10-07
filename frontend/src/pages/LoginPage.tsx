import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If redirected from a protected route, preserve destination
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Please enter your college email or mobile number and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ identifier: trimmedIdentifier, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to log in. Please verify your credentials and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-wider text-slate-900">REUNITE</h1>
        <p className="text-xs font-medium text-slate-500 mt-0.5">Campus Lost & Found</p>
        <h2 className="mt-6 text-xl font-semibold text-slate-900">
          Sign in to your campus account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Use your registered college email address or mobile number
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-lg sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-md bg-red-50 border border-red-200 flex items-start space-x-2 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                College Email or Mobile Number
              </label>
              <div className="mt-1.5">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="student@college.edu or 9876543210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-xs text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-600">
              New to Reunite?{' '}
              <Link to="/signup" className="font-semibold text-slate-900 hover:underline">
                Create a campus account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
