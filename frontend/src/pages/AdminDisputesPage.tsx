import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import {
  CheckCircle2, ShieldAlert,
  Loader2, Clock, CheckCircle, User, Package
} from 'lucide-react';

interface DisputeItem {
  public_id: string;
  claim?: {
    public_id: string;
    found_item_title?: string;
  } | null;
  found_item?: {
    public_id: string;
    title: string;
    category: string;
  } | null;
  reporter: {
    id: number;
    name: string;
    email: string;
  };
  reason: string;
  description: string;
  status: string;
  admin_response?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export const AdminDisputesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: disputes = [], isLoading, isError } = useQuery<DisputeItem[]>({
    queryKey: ['admin-disputes-list', statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all'
        ? '/api/pickup/disputes/admin/'
        : `/api/pickup/disputes/admin/?status=${statusFilter}`;
      const res = await api.get<DisputeItem[] | { results: DisputeItem[] }>(url);
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ disputeId, notes }: { disputeId: string; notes: string }) => {
      return api.post(`/api/pickup/disputes/admin/${disputeId}/resolve/`, { admin_response: notes });
    },
    onSuccess: () => {
      setSelectedDispute(null);
      setAdminResponseText('');
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-disputes-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'Failed to resolve dispute.');
    },
  });

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;
    resolveMutation.mutate({
      disputeId: selectedDispute.public_id,
      notes: adminResponseText.trim() || 'Reviewed and resolved by campus lost-and-found administration.',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Clock className="w-3 h-3 text-amber-600" /> Open
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <ShieldAlert className="w-3 h-3 text-blue-600" /> Under Review
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
            {status}
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dispute Resolution Queue</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Admin Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review contested claims, investigate conflicting reports, and enter binding administrative resolutions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs">
          {(['all', 'OPEN', 'UNDER_REVIEW', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                statusFilter === s
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {s === 'all' ? 'All Disputes' : s.replace('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs">Loading campus dispute records...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600 text-xs">
            Unable to load dispute queue. Ensure you are logged in with administrative privileges.
          </div>
        ) : disputes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No active disputes in this view.</p>
            <p className="text-xs text-slate-400">All claims are currently uncontested or already resolved.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {disputes.map((d) => (
              <div key={d.public_id} className="p-5 hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(d.status)}
                    <span className="font-mono text-xs text-slate-400">ID: {d.public_id.substring(0, 8)}</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Reason: <strong className="text-slate-900 dark:text-white">{d.reason}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    "{d.description}"
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Reported by: <strong>{d.reporter?.name}</strong> ({d.reporter?.email})
                    </span>
                    {d.found_item && (
                      <span className="flex items-center gap-1 font-mono">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        Item: {d.found_item.title || d.found_item.category} ({d.found_item.public_id})
                      </span>
                    )}
                    <span>Filed: {new Date(d.created_at).toLocaleDateString()}</span>
                  </div>

                  {d.admin_response && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200">
                      <strong>Admin Resolution Note:</strong> {d.admin_response}
                    </div>
                  )}
                </div>

                {d.status !== 'RESOLVED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDispute(d);
                      setAdminResponseText('');
                      setActionError(null);
                    }}
                    className="shrink-0 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 shadow-2xs transition-colors self-start"
                  >
                    Resolve Dispute
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Resolve Dispute Case</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDispute(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div><strong>Dispute Reason:</strong> {selectedDispute.reason}</div>
              <div className="text-slate-500"><strong>Claimant:</strong> {selectedDispute.reporter.name} ({selectedDispute.reporter.email})</div>
              <div className="text-slate-600 dark:text-slate-300 italic">"{selectedDispute.description}"</div>
            </div>

            {actionError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Administrative Resolution Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={adminResponseText}
                  onChange={(e) => setAdminResponseText(e.target.value)}
                  placeholder="Explain findings, outcome, or instructions for the student claimant..."
                  className="w-full text-xs p-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {resolveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
