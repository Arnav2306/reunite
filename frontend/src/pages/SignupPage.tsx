import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, ArrowRight } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobileNumber.trim();

    if (!trimmedName || !password) {
      setError('Please provide your name and password.');
      return;
    }

    if (!trimmedEmail && !trimmedMobile) {
      setError('Please provide either an email address or mobile number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({
        name: trimmedName,
        email: trimmedEmail || undefined,
        password,
        password_confirm: confirmPassword,
        mobile_number: trimmedMobile || undefined,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to register. Please check your information and try again.');
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
          Create your campus account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Register to file reports and track custody of belongings
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Email Address <span className="text-slate-400 font-normal lowercase">(any valid email, optional if mobile provided)</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. student@college.edu or alex@gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="mobileNumber"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Mobile Number <span className="text-slate-400 font-normal lowercase">(optional if email provided)</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  autoComplete="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="mt-1.5">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-slate-800 focus:border-slate-800 bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-xs text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating account...' : 'Create account'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-600">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-slate-900 hover:underline">
                Sign in to your account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
