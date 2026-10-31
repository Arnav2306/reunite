import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle, ArrowRight, GraduationCap, ShieldCheck, Info, Eye, EyeOff, ShieldAlert, KeyRound } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminPath = location.pathname === '/admin/login' || location.search.includes('portal=staff') || location.search.includes('portal=admin');
  const [portalMode, setPortalMode] = useState<'student' | 'admin'>(isAdminPath ? 'admin' : 'student');

  useEffect(() => {
    if (location.pathname === '/admin/login') {
      setPortalMode('admin');
    } else if (location.pathname === '/login' && !location.search.includes('portal=staff') && !location.search.includes('portal=admin')) {
      setPortalMode('student');
    }
  }, [location.pathname, location.search]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If redirected from a protected route, preserve destination
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const switchPortal = (mode: 'student' | 'admin') => {
    setPortalMode(mode);
    setError(null);
    if (mode === 'admin') {
      navigate('/admin/login', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError(portalMode === 'admin'
        ? 'Please enter your Admin ID or staff email and password.'
        : 'Please enter your email or mobile number and password.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        identifier: trimmedIdentifier,
        password,
        portal: portalMode === 'admin' ? 'admin' : 'student',
      });
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
            src={isDark ? '/reunite-logo-transparent.png' : '/reunite-logo-light.png'}
            alt="Reunite — Campus Lost & Found"
            className="h-20 w-auto object-contain"
            style={{ maxWidth: '180px' }}
          />
        </div>
        
        {/* Entry Choice Tabs: Student vs Admin Portal */}
        <div className="mt-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center max-w-xs mx-auto border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => switchPortal('student')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              portalMode === 'student'
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Student Portal
          </button>
          <button
            type="button"
            onClick={() => switchPortal('admin')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
              portalMode === 'admin'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Portal
          </button>
        </div>

        <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
          {portalMode === 'student' ? 'Student Sign In' : 'Admin & Staff Desk Sign In'}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {portalMode === 'student'
            ? 'Access your lost reports, active claims, and candidate matches'
            : 'Operational desk for collection points, verifications, custody, handovers, and disputes'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-800 py-8 px-6 shadow-xs border border-slate-200 dark:border-slate-700 rounded-2xl sm:px-10 space-y-5">
          {portalMode === 'admin' ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="font-semibold">Authoritative Role Guard:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                This portal is strictly for Admin, Super Admin, and Custodian accounts. Student accounts are rejected here.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                Students sign in with their registered personal/college email or mobile phone number.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start space-x-2 text-red-800 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                {portalMode === 'admin' ? 'Admin ID or Email' : 'Email Address or Phone Number'}
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
                  placeholder={portalMode === 'admin' ? 'RNT-SUPER-001 or admin@campus.edu' : 'alex@gmail.com or 9876543210'}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {portalMode === 'student'
                  ? 'Sign in with your student account credentials.'
                  : 'Enter your Admin ID (e.g. RNT-SUPER-001) or authorized personnel email.'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
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
                  className="w-full pl-3 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
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
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700'
                }`}
              >
                {isSubmitting
                  ? 'Signing in...'
                  : portalMode === 'student'
                  ? 'Sign in as Student'
                  : 'Sign in to Admin / Staff Desk'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </button>
            </div>
          </form>

          {/* Portal Switcher & Account Creation Workflows */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3 text-center">
            {portalMode === 'student' ? (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  New student to Reunite?{' '}
                  <Link to="/signup" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Create Student Account
                  </Link>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Campus administrator or custodian?{' '}
                  <button
                    type="button"
                    onClick={() => switchPortal('admin')}
                    className="font-medium text-slate-800 dark:text-slate-200 hover:underline"
                  >
                    Go to Admin Portal →
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-left bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <KeyRound className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  Admin Account Creation Workflow
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Admin accounts can <strong>ONLY</strong> be created by an authenticated Super Admin inside the Admin Portal. Custodian accounts are assigned by authorized Admins or Super Admins.
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Root setup via CLI:</span>
                  <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-800 dark:text-slate-200">
                    createsuperuser
                  </code>
                </div>
                <div className="pt-2 text-center border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => switchPortal('student')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ← Switch to Student Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
