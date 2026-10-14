import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import {
  User, Mail, Phone, Shield, Calendar, Hash,
  Edit3, CheckCircle2, AlertCircle, X, Loader2
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobile_number || '');
  const [personalEmail, setPersonalEmail] = useState(user?.personal_email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleOpenEdit = () => {
    setName(user?.name || '');
    setMobileNumber(user?.mobile_number || '');
    setPersonalEmail(user?.personal_email || '');
    setError(null);
    setSuccessMsg(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch('/api/auth/me/', {
        name: trimmedName,
        mobile_number: mobileNumber.trim() || null,
        personal_email: personalEmail.trim() || null,
      });
      await refreshUser();
      setSuccessMsg('Profile updated successfully.');
      setTimeout(() => {
        setIsEditing(false);
        setSuccessMsg(null);
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'student':
        return 'Student';
      case 'custodian':
        return 'Custodian';
      case 'admin':
        return 'Admin';
      case 'superadmin':
        return 'Super Admin';
      default:
        return role || '—';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Header banner */}
        <div className="px-6 py-6 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Campus Profile</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Official registration and contact identifiers stored in the campus system
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              Edit Profile
            </button>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>
              {user?.is_active ? 'Active Account' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* Profile Details List */}
        <div className="p-6">
          <dl className="divide-y divide-slate-100">
            {/* Full Name */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <User className="w-4 h-4 mr-2 text-slate-400" />
                Full Name
              </dt>
              <dd className="text-sm font-medium text-slate-900 sm:col-span-2">
                {user?.name || '—'}
              </dd>
            </div>

            {/* Primary Email */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                Primary Account Email
              </dt>
              <dd className="text-sm font-mono text-slate-900 sm:col-span-2">
                {user?.college_email || user?.email || '—'}
              </dd>
            </div>

            {/* Personal Email */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                Personal / Secondary Email
              </dt>
              <dd className="text-sm text-slate-700 sm:col-span-2">
                {user?.personal_email ? (
                  <span className="font-mono text-slate-900">{user.personal_email}</span>
                ) : (
                  <span className="text-slate-400 italic">Not provided</span>
                )}
              </dd>
            </div>

            {/* Mobile Number */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Phone className="w-4 h-4 mr-2 text-slate-400" />
                Mobile Number
              </dt>
              <dd className="text-sm text-slate-700 sm:col-span-2">
                {user?.mobile_number ? (
                  <span className="font-mono text-slate-900">{user.mobile_number}</span>
                ) : (
                  <span className="text-slate-400 italic">Not provided</span>
                )}
              </dd>
            </div>

            {/* Role */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Shield className="w-4 h-4 mr-2 text-slate-400" />
                Campus Role
              </dt>
              <dd className="text-sm text-slate-900 sm:col-span-2 font-medium">
                {getRoleBadge(user?.role)}
              </dd>
            </div>

            {/* Date Joined */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                Account Created
              </dt>
              <dd className="text-sm text-slate-700 sm:col-span-2">
                {formatDate(user?.date_joined)}
              </dd>
            </div>

            {/* Public UUID */}
            {user?.public_id && (
              <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                  <Hash className="w-4 h-4 mr-2 text-slate-400" />
                  Account Identifier
                </dt>
                <dd className="text-xs font-mono text-slate-500 sm:col-span-2">
                  {user.public_id}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Profile Details</h3>
                <p className="text-xs text-slate-500">Update your personal contact information</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
                <p className="text-[11px] text-slate-400 mt-1">Must be unique across accounts</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Personal / Secondary Email
                </label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="e.g. alex@gmail.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
