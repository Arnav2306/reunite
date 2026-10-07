import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, Phone, Shield, Calendar, Hash } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

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
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Header banner */}
        <div className="px-6 py-6 border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Campus Profile</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Official registration and credentials stored in the campus system
              </p>
            </div>
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

            {/* College Email */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                College Email
              </dt>
              <dd className="text-sm font-mono text-slate-900 sm:col-span-2">
                {user?.college_email || user?.email || '—'}
              </dd>
            </div>

            {/* Personal Email (if present) */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                Personal Email
              </dt>
              <dd className="text-sm text-slate-700 sm:col-span-2">
                {user?.personal_email ? (
                  <span className="font-mono text-slate-900">{user.personal_email}</span>
                ) : (
                  <span className="text-slate-400 italic">Not provided</span>
                )}
              </dd>
            </div>

            {/* Mobile Number (if present) */}
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
    </div>
  );
};
