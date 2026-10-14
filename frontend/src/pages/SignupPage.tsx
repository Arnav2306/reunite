import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, ArrowRight, Mail, Phone, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobileNumber.trim().replace(/[\s\-()]/g, '');

    if (!trimmedName || !password) {
      setError('Please provide your name and password.');
      return;
    }

    if (signupMethod === 'email') {
      if (!trimmedEmail) {
        setError('Please enter your email address.');
        return;
      }
      // Basic email pattern validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
    } else {
      if (!trimmedMobile) {
        setError('Please enter your mobile phone number.');
        return;
      }
      // Phone format validation (7 to 15 digits, optional +)
      if (!/^\+?[0-9]{7,15}$/.test(trimmedMobile)) {
        setError('Please enter a valid phone number (7 to 15 digits, e.g. 9876543210).');
        return;
      }
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
        personal_email: trimmedEmail || undefined,
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
        <p className="text-xs font-medium text-slate-500 mt-0.5">Campus Lost &amp; Found</p>
        <h2 className="mt-5 text-xl font-semibold text-slate-900">
          Create your account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Register to file reports and track custody of belongings
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-2xl sm:px-10">
          {/* Method Selector Tabs: Continue with Email vs Continue with Phone */}
          <div className="mb-6 grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => { setSignupMethod('email'); setError(null); }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                signupMethod === 'email'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              Continue with Email
            </button>
            <button
              type="button"
              onClick={() => { setSignupMethod('phone'); setError(null); }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                signupMethod === 'phone'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone className="w-4 h-4" />
              Continue with Phone
            </button>
          </div>

          {/* Helper text for chosen method */}
          <div className="mb-5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              {signupMethod === 'email'
                ? 'Personal Gmail is recommended. Other valid email addresses are accepted too.'
                : 'Use your mobile number to create your account.'}
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2 text-red-800 text-sm">
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                />
              </div>
            </div>

            {signupMethod === 'email' ? (
              <>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@gmail.com or student@outlook.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Any valid personal or institutional email address
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="mobileNumber"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Mobile Number <span className="text-slate-400 font-normal lowercase">(optional recovery phone)</span>
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="mobileNumber"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="mobileNumber"
                      name="mobileNumber"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 9876543210 or +1234567890"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Use your active 10-digit mobile number for SMS/handover alerts
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                  >
                    Personal Email <span className="text-slate-400 font-normal lowercase">(optional recovery email)</span>
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@gmail.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="mt-1.5 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-sm shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden focus:text-slate-700 cursor-pointer"
                >
                  {showConfirmPassword ? (
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
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating account...' : 'Create account'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-slate-900 hover:underline">
                Sign in with email or phone
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
