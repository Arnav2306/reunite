import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/auth';
import {
  Users, UserPlus, Shield, ShieldCheck, UserCheck,
  AlertCircle, CheckCircle2, Eye, EyeOff, Loader2,
  Terminal, Mail, Phone, Calendar
} from 'lucide-react';

interface StaffUserItem {
  id: number;
  public_id: string;
  name: string;
  email: string;
  personal_email?: string | null;
  mobile_number?: string | null;
  role: UserRole;
  is_active: boolean;
  date_joined: string;
}

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'custodian' | 'superadmin'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'custodian'>(isSuperAdmin ? 'admin' : 'custodian');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch staff users
  const { data: users = [], isLoading, isError } = useQuery<StaffUserItem[]>({
    queryKey: ['admin-staff-users', roleFilter],
    queryFn: async () => {
      const url = roleFilter === 'all' ? '/api/auth/users/' : `/api/auth/users/?role=${roleFilter}`;
      const res = await api.get<StaffUserItem[] | { results: StaffUserItem[] }>(url);
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post<StaffUserItem>('/api/auth/users/', payload);
    },
    onSuccess: (newUser) => {
      setSuccessMessage(`Account created successfully for ${newUser.name} (${newUser.email}) with role: ${newUser.role.toUpperCase()}`);
      setIsModalOpen(false);
      // Reset form
      setFormName('');
      setFormEmail('');
      setFormMobile('');
      setFormPassword('');
      setFormConfirmPassword('');
      setFormRole(isSuperAdmin ? 'admin' : 'custodian');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-staff-users'] });
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to create user account. Please check the details and try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    const trimmedEmail = formEmail.trim().toLowerCase();
    const trimmedMobile = formMobile.trim();

    if (!trimmedName || !trimmedEmail || !formPassword) {
      setFormError('Name, email, and password are required.');
      return;
    }

    if (formPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (formPassword !== formConfirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (formRole === 'admin' && !isSuperAdmin) {
      setFormError('Only authenticated Super Admins can create Admin accounts.');
      return;
    }

    createUserMutation.mutate({
      name: trimmedName,
      email: trimmedEmail,
      mobile_number: trimmedMobile || undefined,
      password: formPassword,
      password_confirm: formConfirmPassword,
      role: formRole,
    });
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            <Shield className="w-3 h-3 text-purple-600" /> Super Admin
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <ShieldCheck className="w-3 h-3 text-blue-600" /> Admin
          </span>
        );
      case 'custodian':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <UserCheck className="w-3 h-3 text-amber-600" /> Custodian
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            Student
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User &amp; Staff Access Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Admin Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative provision and supervision of campus administrators and custodial staff.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Create Staff Account
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-emerald-900 dark:text-emerald-200 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Super Admin Root Setup Card */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <Terminal className="w-4 h-4 text-blue-600" />
            Root Super Admin Provisioning &amp; CLI Security
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Initial root Super Admin setup is provisioned securely via backend CLI (<code className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">python manage.py createsuperuser</code>). Public registration cannot create Admin or Custodian accounts.
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 border-l border-slate-200 dark:border-slate-700 pl-4">
          <div>Your Current Role:</div>
          <div className="font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
            {currentUser?.role || 'Admin'}
          </div>
        </div>
      </div>

      {/* Staff Users List Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Provisioned Operational Staff</h2>
            <span className="text-xs text-slate-400">({users.length})</span>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs">
            {(['all', 'superadmin', 'admin', 'custodian'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                  roleFilter === r
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r === 'all' ? 'All Staff' : r}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs">Loading operational staff directory...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600 text-xs">
            Failed to load staff accounts. Ensure you have authorized administrative privileges.
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">No staff accounts found.</p>
            <p className="text-slate-400">Create an Admin or Custodian account using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Email / Identifier</th>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {users.map((u) => (
                  <tr key={u.public_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                      {u.name}
                      {u.public_id === currentUser?.public_id && (
                        <span className="ml-1.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-normal">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{getRoleBadge(u.role)}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {u.email}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {u.mobile_number ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {u.mobile_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        {new Date(u.date_joined).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Provision Staff Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Create an authorized staff account. Admin roles can only be granted by Super Administrators.
            </p>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2 text-red-800 dark:text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Staff Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                      formRole === 'custodian'
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="custodian"
                      checked={formRole === 'custodian'}
                      onChange={() => setFormRole('custodian')}
                      className="text-blue-600"
                    />
                    <span>Custodian</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs transition-all ${
                      !isSuperAdmin
                        ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                        : formRole === 'admin'
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold cursor-pointer'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      disabled={!isSuperAdmin}
                      checked={formRole === 'admin'}
                      onChange={() => setFormRole('admin')}
                      className="text-blue-600"
                    />
                    <span>Admin</span>
                  </label>
                </div>
                {!isSuperAdmin && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    * Admin accounts can only be provisioned by a Super Admin.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="staff@campus.edu"
                  className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full text-xs p-2.5 pr-9 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    className="w-full text-xs p-2.5 pr-9 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {createUserMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {createUserMutation.isPending ? 'Creating Account...' : 'Confirm Account Creation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
