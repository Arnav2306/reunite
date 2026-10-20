import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, ArrowRight, GraduationCap, ShieldCheck, Info, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [portalMode, setPortalMode] = useState<'student' | 'staff'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portal') === 'staff' ? 'staff' : 'student';
  });

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If redirected from a protected route, preserve destination
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Please enter your email or mobile number and password.');
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
        <div className="flex justify-center mb-2">
          <img
            src="/reunite-logo-transparent.png"
            alt="Reunite — Campus Lost & Found"
            className="h-20 w-auto object-contain"
            style={{ maxWidth: '180px' }}
          />
        </div>
        
        {/* Entry Choice Tabs: Student vs Admin / Staff */}
        <div className="mt-6 p-1 bg-slate-100 rounded-xl flex items-center justify-center max-w-xs mx-auto border border-slate-200">
          <button
            type="button"
            onClick={() => setPortalMode('student')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              portalMode === 'student'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Student
          </button>
          <button
            type="button"
            onClick={() => setPortalMode('staff')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              portalMode === 'staff'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin / Staff
          </button>
        </div>

        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          {portalMode === 'student' ? 'Student Sign In' : 'Custodial & Staff Portal'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {portalMode === 'student'
            ? 'Access your lost reports, active claims, and candidate matches'
            : 'Operational desk for collection points, verifications, and handovers'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-2xl sm:px-10 space-y-5">
          {portalMode === 'staff' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Staff authorization is verified server-side. Selecting Staff Portal does not grant privileges to unassigned accounts.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Email Address or Phone Number
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
                  placeholder={portalMode === 'student' ? 'alex@gmail.com or 9876543210' : 'staff@campus.edu or mobile'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Sign in with your registered email or phone number. College email is not required.
              </p>
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
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden focus:text-slate-700 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  portalMode === 'student'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {isSubmitting
                  ? 'Signing in...'
                  : portalMode === 'student'
                  ? 'Sign in as Student'
                  : 'Sign in to Staff Desk'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-200 text-center">
            {portalMode === 'student' ? (
              <p className="text-xs text-slate-600">
                New student to Reunite?{' '}
                <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
                  Create a campus account
                </Link>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Need administrative access? Privileged roles are provisioned by campus IT.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
