import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { Claim } from '../types/recovery';
import { ShieldCheck, User, AlertCircle, CheckCircle, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export const AdminVerificationPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showPrivateInfo, setShowPrivateInfo] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: claims = [], isLoading, isError } = useQuery<Claim[]>({
    queryKey: ['admin-claims', statusFilter],
    queryFn: async () => {
      const url = `/api/pickup/claims/admin/admin-list/?status=${statusFilter}`;
      const res = await api.get<Claim[] | { results: Claim[] }>(url);
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (claimId: string) => {
      return api.post(`/api/pickup/claims/admin/${claimId}/approve/`);
    },
    onSuccess: () => {
      setActionError(null);
      setSelectedClaim(null);
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'Failed to approve claim.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ claimId, notes }: { claimId: string; notes: string }) => {
      return api.post(`/api/pickup/claims/admin/${claimId}/reject/`, { admin_notes: notes });
    },
    onSuccess: () => {
      setActionError(null);
      setSelectedClaim(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-claims'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'Failed to reject claim.');
    },
  });

  const togglePrivateInfo = (claimId: string) => {
    setShowPrivateInfo((prev) => ({ ...prev, [claimId]: !prev[claimId] }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Claim Verification Center</h1>
          <p className="text-sm text-slate-600 mt-1">
            Review student claims and verify submitted ownership details against private item serials and attributes.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
        >
          <option value="pending">Pending Review Only</option>
          <option value="approved">Approved Claims</option>
          <option value="rejected">Rejected Claims</option>
          <option value="all">All Claims</option>
        </select>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Loading pending claims list...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
          Failed to load claims queue. Please check staff authorization.
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No claims requiring action</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no student claims in state <span className="font-semibold">{statusFilter}</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {claims.map((claim) => {
            const item = claim.found_item;
            const student = claim.student;
            const verification = claim.verification;
            const showPrivate = !!showPrivateInfo[claim.public_id];

            return (
              <div
                key={claim.public_id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
              >
                {/* Header bar */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-slate-500" />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        Claimant: {student?.name || 'Student'} ({student?.email})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Claimed on {new Date(claim.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`self-start sm:self-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      claim.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : claim.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {claim.status}
                  </span>
                </div>

                {/* Content columns */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Column 1: Public Item Info */}
                  <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <h4 className="font-bold text-slate-900 border-b pb-2 mb-2 text-xs uppercase tracking-wider">
                      Public Item Info
                    </h4>
                    <div>
                      <span className="font-semibold text-slate-700">Title:</span> {item?.title}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Category:</span> {item?.category}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Found Location:</span>{' '}
                      {item?.found_location || 'Campus Premises'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Risk Tier:</span>{' '}
                      {item?.risk_tier === 1 ? 'Valuable (Tier 1)' : 'General (Tier 0)'}
                    </div>
                  </div>

                  {/* Column 2: Private Custodial Details */}
                  <div className="space-y-2 p-4 bg-amber-50/60 rounded-lg border border-amber-200 text-xs relative">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2 mb-2">
                      <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                        Private Item Details (Staff Only)
                      </h4>
                      <button
                        type="button"
                        onClick={() => togglePrivateInfo(claim.public_id)}
                        className="text-amber-800 hover:text-amber-950 flex items-center text-[11px] font-semibold"
                      >
                        {showPrivate ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Reveal
                          </>
                        )}
                      </button>
                    </div>

                    {showPrivate ? (
                      <div className="space-y-1.5 text-slate-800 animate-in fade-in duration-150">
                        {item?.serial_number && (
                          <div>
                            <span className="font-semibold">Serial Number:</span> {item.serial_number}
                          </div>
                        )}
                        {item?.imei && (
                          <div>
                            <span className="font-semibold">IMEI:</span> {item.imei}
                          </div>
                        )}
                        {item?.identifying_marks && (
                          <div>
                            <span className="font-semibold">Identifying Marks:</span> {item.identifying_marks}
                          </div>
                        )}
                        {item?.secret_verification_info && (
                          <div>
                            <span className="font-semibold text-amber-950">Secret Verification Info:</span>{' '}
                            {item.secret_verification_info}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-amber-800 pt-2">
                        Private serials, IMEIs, and secret verification notes hidden. Click reveal to inspect.
                      </p>
                    )}
                  </div>

                  {/* Column 3: Student Verification Response */}
                  <div className="space-y-2 p-4 bg-blue-50/60 rounded-lg border border-blue-200 text-xs">
                    <h4 className="font-bold text-blue-900 border-b border-blue-200 pb-2 mb-2 text-xs uppercase tracking-wider">
                      Student Verification Response
                    </h4>
                    {verification ? (
                      <div className="space-y-2">
                        <p className="font-medium text-slate-700 italic">"{verification.question}"</p>
                        <div className="p-2.5 bg-white border border-blue-200 rounded-md font-mono text-[11px] text-slate-900 whitespace-pre-wrap">
                          {verification.student_answer}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-slate-500">No verification details recorded.</p>
                    )}
                  </div>
                </div>

                {/* Footer Action Bar */}
                {claim.status === 'PENDING' && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setSelectedClaim(claim)}
                      disabled={rejectMutation.isPending}
                      className="px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-300 rounded-md transition-colors flex items-center"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject Claim
                    </button>

                    <button
                      type="button"
                      onClick={() => approveMutation.mutate(claim.public_id)}
                      disabled={approveMutation.isPending}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 rounded-md shadow-xs transition-colors flex items-center"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      )}
                      Approve Claim
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reject Student Claim</h3>
            <p className="text-xs text-slate-600">
              Provide a clear reason for rejecting the claim submitted by{' '}
              <span className="font-semibold text-slate-800">{selectedClaim.student?.email}</span>.
            </p>

            <textarea
              rows={3}
              placeholder="Reason for rejection (e.g. Serial number mismatch, insufficient description)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  rejectMutation.mutate({
                    claimId: selectedClaim.public_id,
                    notes: rejectReason.trim() || 'Verification details did not match records.',
                  })
                }
                disabled={rejectMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs flex items-center"
              >
                {rejectMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
