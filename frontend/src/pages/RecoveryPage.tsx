import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { Claim } from '../types/recovery';
import { Clock, CheckCircle2, XCircle, KeyRound, MapPin, Loader2, PackageCheck } from 'lucide-react';

export const RecoveryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [disputeClaim, setDisputeClaim] = useState<Claim | null>(null);
  const [disputeReason, setDisputeReason] = useState('Incorrect item information');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  const { data: claims = [], isLoading, isError } = useQuery<Claim[]>({
    queryKey: ['my-claims'],
    queryFn: async () => {
      const res = await api.get<Claim[] | { results: Claim[] }>('/api/pickup/claims/my-claims/');
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async (payload: { claim_public_id: string; reason: string; description: string }) => {
      return api.post('/api/pickup/disputes/', payload);
    },
    onSuccess: () => {
      setDisputeSuccess(true);
      setDisputeError(null);
      queryClient.invalidateQueries({ queryKey: ['my-claims'] });
      setTimeout(() => {
        setDisputeClaim(null);
        setDisputeSuccess(false);
        setDisputeDescription('');
      }, 1800);
    },
    onError: (err: ApiError) => {
      setDisputeError(err.message || 'Failed to file dispute.');
    },
  });

  const [otpMessage, setOtpMessage] = useState<Record<string, string | null>>({});

  const regenerateOtpMutation = useMutation({
    mutationFn: async (claimPublicId: string) => {
      return api.post(`/api/pickup/claims/${claimPublicId}/regenerate-otp/`);
    },
    onSuccess: (res: any, claimPublicId) => {
      setOtpMessage((prev) => ({
        ...prev,
        [claimPublicId]: res.detail || 'New secure OTP generated and sent to your notifications!',
      }));
      queryClient.invalidateQueries({ queryKey: ['my-claims'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: ApiError, claimPublicId) => {
      setOtpMessage((prev) => ({
        ...prev,
        [claimPublicId]: err.message || 'Failed to request new OTP.',
      }));
    },
  });

  const STEPS = ['Claim Submitted', 'Under Review', 'Approved / Ready for Pickup', 'Handover', 'Resolved'];

  const getStepStatus = (claim: Claim, stepIndex: number) => {
    const isHandoverComplete = claim.handover?.status === 'COMPLETED';
    const isHandoverFailed = claim.handover?.status === 'FAILED';

    if (claim.status === 'REJECTED') {
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'rejected';
      return 'pending';
    }

    if (claim.status === 'PENDING') {
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'current';
      return 'pending';
    }

    if (claim.status === 'APPROVED') {
      if (stepIndex <= 2) return 'completed';
      if (stepIndex === 3) {
        if (isHandoverComplete) return 'completed';
        if (isHandoverFailed) return 'rejected';
        return 'current';
      }
      if (stepIndex === 4) {
        return isHandoverComplete ? 'completed' : 'pending';
      }
    }

    return 'pending';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900">My Recovery Trackers</h1>
        <p className="text-sm text-slate-600 mt-1">
          Track the live physical and custodial recovery status of your submitted claims.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Loading recovery records...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
          Failed to load your recovery history.
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No active recovery cases</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You do not have any pending or past item claims. Browse the Available Items catalog to file a claim.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {claims.map((claim) => {
            const item = claim.found_item;
            const handover = claim.handover;

            return (
              <div
                key={claim.public_id}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6"
              >
                {/* Item header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{item.title || item.category}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Claimed on {new Date(claim.created_at).toLocaleDateString()} • Case ID: {claim.public_id.substring(0, 8)}
                    </p>
                  </div>
                  <span
                    className={`self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      claim.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : claim.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {claim.status === 'APPROVED'
                      ? 'Claim Approved'
                      : claim.status === 'REJECTED'
                      ? 'Claim Rejected'
                      : 'Under Review'}
                  </span>
                </div>

                {/* Progress Steps Timeline */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  {STEPS.map((stepLabel, idx) => {
                    const st = getStepStatus(claim, idx);
                    return (
                      <div
                        key={stepLabel}
                        className={`p-3 rounded-lg border text-center flex flex-col items-center justify-center space-y-1.5 transition-all ${
                          st === 'completed'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : st === 'current'
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold ring-1 ring-blue-400'
                            : st === 'rejected'
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        {st === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : st === 'rejected' ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : st === 'current' ? (
                          <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300" />
                        )}
                        <span className="font-medium text-[11px]">{stepLabel}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Instructions / Location & OTP Box */}
                {claim.status === 'APPROVED' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-900">Collection Desk Location:</span>{' '}
                        {item.collection_location ? (
                          <span>
                            {item.collection_location.station_code} ({item.collection_location.building}, Floor {item.collection_location.floor})
                            {item.collection_location.zone && ` — Zone: ${item.collection_location.zone}`}
                          </span>
                        ) : (
                          <span>Main Custodial Office Collection Desk</span>
                        )}
                      </div>
                    </div>

                    {handover?.status === 'COMPLETED' ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl shrink-0">
                          🎉
                        </div>
                        <div>
                          <h3 className="font-bold text-emerald-900 text-sm">Reunited 🎉</h3>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Physical handover has been completed and custody is resolved. Item successfully returned!
                          </p>
                        </div>
                      </div>
                    ) : handover?.is_valuable ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 space-y-2">
                        <div className="flex items-start space-x-2">
                          <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div className="flex-1 text-xs">
                            <strong>Valuable Item OTP Verification Required:</strong> Your 6-digit OTP code has been delivered to your in-app notifications. Present your OTP along with your student ID at the collection desk to complete physical handover.
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-[11px]">
                          <span>
                            {handover.otp_expires_at ? `Code expires at ${new Date(handover.otp_expires_at).toLocaleTimeString()}` : 'Secure short expiry active'}
                          </span>
                          <button
                            type="button"
                            onClick={() => regenerateOtpMutation.mutate(claim.public_id)}
                            disabled={regenerateOtpMutation.isPending}
                            className="font-bold text-amber-800 hover:text-amber-950 underline disabled:opacity-50"
                          >
                            {regenerateOtpMutation.isPending ? 'Requesting...' : 'Request New OTP'}
                          </button>
                        </div>
                        {otpMessage[claim.public_id] && (
                          <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 p-2 rounded">
                            {otpMessage[claim.public_id]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-900 flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Ready for Handover:</strong> Please visit the collection desk during operating hours and present your student ID to retrieve your item.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {claim.status === 'REJECTED' && claim.admin_notes && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                    <strong>Staff Review Note:</strong> {claim.admin_notes}
                  </div>
                )}

                {/* Dispute / Issue reporting link */}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDisputeClaim(claim);
                      setDisputeReason('Incorrect item information');
                      setDisputeDescription('');
                      setDisputeError(null);
                      setDisputeSuccess(false);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Report an issue / File dispute
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispute Modal */}
      {disputeClaim && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 relative">
            <h3 className="text-base font-bold text-slate-900">Report an Issue / Dispute</h3>
            <p className="text-xs text-slate-500">
              Filing a dispute initiates an administrative custodial investigation for case {disputeClaim.public_id.substring(0, 8)}.
            </p>

            {disputeSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-emerald-900">Dispute Filed Successfully</p>
                <p className="text-xs text-emerald-700">Campus staff will review the dispute and notify you.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!disputeDescription.trim()) {
                    setDisputeError('Please describe the issue.');
                    return;
                  }
                  disputeMutation.mutate({
                    claim_public_id: disputeClaim.public_id,
                    reason: disputeReason,
                    description: disputeDescription.trim(),
                  });
                }}
                className="space-y-3"
              >
                {disputeError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{disputeError}</p>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
                  <select
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Incorrect ownership">Incorrect ownership</option>
                    <option value="Incorrect item information">Incorrect item information</option>
                    <option value="Damaged item">Damaged item</option>
                    <option value="Multiple claimants">Multiple claimants</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder="Explain the problem in detail..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisputeClaim(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={disputeMutation.isPending}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    {disputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
