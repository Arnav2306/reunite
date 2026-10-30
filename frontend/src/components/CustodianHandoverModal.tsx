import { FoundItemSticker } from './FoundItemSticker';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, getMediaUrl } from '../services/api';
import type { Handover } from '../types/recovery';
import {
  X,
  ShieldCheck,
  KeyRound,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  User,
  Package,
  MapPin,
  Calendar,
  Lock,
  Building,
  RefreshCw,
  FileText
} from 'lucide-react';

interface CustodianHandoverModalProps {
  foundId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onHandoverSuccess?: () => void;
}

interface CaseDetailsResponse {
  item: {
    id: number;
    public_id: string;
    title: string;
    category: string;
    status: string;
    risk_tier: number;
    description: string;
    found_location?: string;
    date_found?: string;
    storage_station?: string;
    collection_point?: {
      id: number;
      name: string;
      station_code: string;
      building: string;
    } | null;
    images?: Array<{
      id: number;
      image?: string;
      image_url?: string;
    }>;
  };
  claims: Array<{
    public_id: string;
    student_name: string;
    student_email: string;
    status: string;
    admin_notes?: string;
    created_at: string;
    verification?: {
      question?: string;
      student_answer?: string;
      submission_timestamp?: string;
    } | null;
    handover?: {
      public_id?: string;
      status?: string;
      is_valuable?: boolean;
      failed_attempts?: number;
      confirmed_at?: string;
    } | null;
  }>;
  audit_logs: Array<{
    action: string;
    actor_email: string;
    timestamp: string;
    details?: any;
  }>;
}

export const CustodianHandoverModal: React.FC<CustodianHandoverModalProps> = ({
  foundId,
  isOpen,
  onClose,
  onHandoverSuccess,
}) => {
  const [otpInput, setOtpInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // 1. Fetch Case Details by Found ID
  const {
    data: caseData,
    isLoading: isCaseLoading,
    isError: isCaseError,
    error: caseError,
    refetch: refetchCase,
  } = useQuery<CaseDetailsResponse>({
    queryKey: ['custodian-case-details', foundId],
    queryFn: async () => {
      if (!foundId) throw new Error('No Found ID specified');
      return api.get<CaseDetailsResponse>(`/api/items/found-items/${encodeURIComponent(foundId.trim())}/case-details/`);
    },
    enabled: isOpen && !!foundId,
  });

  // 2. Also fetch handover record for this item if available
  const { data: handovers = [], refetch: refetchHandovers } = useQuery<Handover[]>({
    queryKey: ['custodian-handover-item', foundId],
    queryFn: async () => {
      if (!foundId) return [];
      const res = await api.get<Handover[] | { results: Handover[] }>(
        `/api/handovers/admin/?found_id=${encodeURIComponent(foundId.trim())}`
      );
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: isOpen && !!foundId,
  });

  // Find the relevant active or approved claim
  const item = caseData?.item;
  const approvedClaim = caseData?.claims?.find((c) => c.status === 'APPROVED') || caseData?.claims?.[0];
  const directHandover = handovers.find((h) => h.found_item?.public_id === foundId) || handovers[0];

  // Resolve handover identifier: either from direct handover query, or case-details claim handover
  const handoverId = directHandover?.public_id || approvedClaim?.handover?.public_id || foundId;
  const isValuable = directHandover ? directHandover.is_valuable : (approvedClaim?.handover?.is_valuable ?? (item?.risk_tier === 1));
  const handoverStatus = directHandover?.status || approvedClaim?.handover?.status || (item?.status === 'RESOLVED' ? 'COMPLETED' : 'READY');

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async ({ id, otp }: { id: string; otp: string }) => {
      return api.post(`/api/handovers/admin/${id}/verify-otp/`, { otp });
    },
    onSuccess: () => {
      setActionError(null);
      setSuccessMessage('Physical handover verified via OTP! Item successfully released and audit log recorded.');
      setOtpInput('');
      queryClient.invalidateQueries({ queryKey: ['admin-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-case-details', foundId] });
      queryClient.invalidateQueries({ queryKey: ['custodian-handover-item', foundId] });
      queryClient.invalidateQueries({ queryKey: ['admin-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      if (onHandoverSuccess) onHandoverSuccess();
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'OTP verification failed. Please check the code.');
    },
  });

  // Regenerate OTP mutation
  const regenerateOtpMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/handovers/admin/${id}/regenerate-otp/`);
    },
    onSuccess: () => {
      setActionError(null);
      setSuccessMessage('A fresh OTP has been generated and dispatched to the claimant.');
      refetchHandovers();
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'Failed to regenerate OTP.');
    },
  });

  // Confirm Collection mutation (general items)
  const confirmCollectionMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/handovers/admin/${id}/confirm-collection/`);
    },
    onSuccess: () => {
      setActionError(null);
      setSuccessMessage('Physical handover confirmed! Item marked as resolved and custody audit recorded.');
      queryClient.invalidateQueries({ queryKey: ['admin-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['custodian-case-details', foundId] });
      queryClient.invalidateQueries({ queryKey: ['custodian-handover-item', foundId] });
      queryClient.invalidateQueries({ queryKey: ['admin-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      if (onHandoverSuccess) onHandoverSuccess();
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'Failed to confirm physical collection.');
    },
  });

  // Confirm Deposit mutation (for DEPOSIT_PENDING items)
  const confirmDepositMutation = useMutation({
    mutationFn: async (publicId: string) => {
      return api.post(`/api/items/found-items/${publicId}/confirm-deposit/`);
    },
    onSuccess: () => {
      setActionError(null);
      setSuccessMessage('Physical receipt confirmed! Item is now in institutional custody.');
      queryClient.invalidateQueries({ queryKey: ['custodian-case-details', foundId] });
      queryClient.invalidateQueries({ queryKey: ['admin-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      refetchCase();
    },
    onError: (err: ApiError) => {
      setActionError(err.message || 'Failed to confirm physical deposit.');
    },
  });

  if (!isOpen) return null;

  const isCompleted = handoverStatus === 'COMPLETED' || item?.status === 'RESOLVED';
  const isFailed = handoverStatus === 'FAILED';
  const hasApprovedClaim = approvedClaim?.status === 'APPROVED';
  const hasVerificationAnswer = Boolean(approvedClaim?.verification?.student_answer?.trim());

  const primaryImage = item?.images && item.images.length > 0
    ? getMediaUrl(item.images[0].image_url || item.images[0].image)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden flex flex-col">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Matched Found Record</span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {foundId}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">Custodian Item & Handover Verification</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {isCaseLoading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Retrieving found-item record <span className="font-mono">{foundId}</span>...
              </p>
            </div>
          ) : isCaseError || !item ? (
            <div className="p-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-red-700 dark:text-red-400 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Found Item Record Not Found</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-300">
                {(caseError as any)?.message || `No record matching ID "${foundId}" was found or you lack custodian authorization.`}
              </p>
              <button
                type="button"
                onClick={() => refetchCase()}
                className="mt-2 text-xs font-semibold text-red-700 underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Try Again
              </button>
            </div>
          ) : (
            <>
              {/* 1. Essential Physical Item Information Banner */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={item.title}
                      className="w-24 h-24 object-cover rounded-lg border border-slate-300 dark:border-slate-600 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-slate-200 dark:bg-slate-700 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <Package className="w-8 h-8" />
                      <span className="text-[10px] mt-1">No Image</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.status === 'DEPOSITED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                            : item.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : item.status === 'REPORTED'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                            : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Custody: {item.status}
                      </span>
                      {isValuable && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Lock className="w-3 h-3 mr-1" /> Valuable (OTP Required)
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {item.description || 'No additional physical description provided.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Category: <strong>{item.category}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Station: <strong>{item.collection_point?.station_code || item.storage_station || 'Unassigned'}</strong>
                        </span>
                      </div>
                      {item.found_location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Location: {item.found_location}</span>
                        </div>
                      )}
                      {item.date_found && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Found Date: {new Date(item.date_found).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Claimant & Ownership Verification Requirements */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Claimant &amp; Ownership Verification</h4>
                  </div>
                  {approvedClaim && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        approvedClaim.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      Claim Status: {approvedClaim.status}
                    </span>
                  )}
                </div>

                {!approvedClaim ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">No Student Claims Filed</p>
                      <p className="mt-0.5">
                        This item currently has no associated student claims. A claim must be submitted and approved before handover can take place.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-slate-500 block text-[11px]">Claimant Student:</span>
                        <strong className="text-slate-900 dark:text-white text-xs">{approvedClaim.student_name}</strong>
                        <span className="text-slate-500 block text-[11px]">{approvedClaim.student_email}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-slate-500 block text-[11px]">Claim Reference:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{approvedClaim.public_id}</span>
                        <span className="text-slate-500 block text-[11px]">
                          Filed {new Date(approvedClaim.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Ownership Verification Q&A */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-lg space-y-1.5">
                      <div className="flex items-center space-x-1.5 text-blue-900 dark:text-blue-300 font-semibold text-xs">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ownership Verification Answer:</span>
                      </div>
                      {approvedClaim.verification?.question && (
                        <p className="text-[11px] text-blue-800 dark:text-blue-300 italic">
                          Q: {approvedClaim.verification.question}
                        </p>
                      )}
                      {approvedClaim.verification?.student_answer ? (
                        <div className="p-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded text-xs text-slate-800 dark:text-slate-200 font-medium">
                          &ldquo;{approvedClaim.verification.student_answer}&rdquo;
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                          ⚠️ No ownership verification answer submitted by student.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback messages */}
              {actionError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Deposit Pending Section */}
              {item?.status === 'DEPOSIT_PENDING' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-amber-900 dark:text-amber-200 text-xs uppercase tracking-wide">
                        Physical Custody Receipt Pending
                      </h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        This item was reported by student but not yet deposited at station. Attach printed sticker and confirm deposit.
                      </p>
                    </div>
                    <button
                      id="btn-confirm-custody-deposit"
                      type="button"
                      onClick={() => { if (item) confirmDepositMutation.mutate(item.public_id); }}
                      disabled={confirmDepositMutation.isPending}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {confirmDepositMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Package className="w-3.5 h-3.5" />
                      )}
                      Confirm Physical Deposit
                    </button>
                  </div>
                  <FoundItemSticker foundId={item.public_id} category={item.category} />
                </div>
              )}

              {/* 3. Handover Execution Controls & Verification Safeguards */}
              <div className="pt-2">
                {isCompleted ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-center space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span>Physical Handover Completed &amp; Resolved</span>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      This item was already physically handed over to the authorized student. Duplicate handover is strictly prevented.
                    </p>
                  </div>
                ) : isFailed ? (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-center space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-red-800 dark:text-red-300 font-bold text-sm">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span>Handover Locked (Maximum Failed OTPs)</span>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Exceeded 5 incorrect attempts. Please verify student identity documents and regenerate OTP.
                    </p>
                    {directHandover && (
                      <button
                        type="button"
                        onClick={() => regenerateOtpMutation.mutate(directHandover.public_id)}
                        disabled={regenerateOtpMutation.isPending}
                        className="mt-2 px-3 py-1 text-xs font-semibold text-blue-600 underline"
                      >
                        {regenerateOtpMutation.isPending ? 'Regenerating...' : 'Regenerate OTP for Student'}
                      </button>
                    )}
                  </div>
                ) : !hasApprovedClaim ? (
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center space-y-1">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Handover Not Permitted: Claim Not Approved
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      QR scanning or ID lookup alone does not authorize pickup. An administrator must approve the student&apos;s claim before physical release.
                    </p>
                  </div>
                ) : !hasVerificationAnswer ? (
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center space-y-1">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Handover Not Permitted: Incomplete Ownership Verification
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      The claimant has not provided the necessary ownership verification answers.
                    </p>
                  </div>
                ) : isValuable ? (
                  /* Valuable Item OTP Handover */
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-purple-600" />
                          Student 6-Digit OTP Verification
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Valuable item handover requires the one-time pickup code provided to the claimant.
                        </p>
                      </div>
                      {directHandover && (
                        <button
                          type="button"
                          onClick={() => regenerateOtpMutation.mutate(directHandover.public_id)}
                          disabled={regenerateOtpMutation.isPending}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                        >
                          {regenerateOtpMutation.isPending ? 'Regenerating...' : 'Regenerate OTP'}
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 849201"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm font-mono tracking-widest text-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (handoverId)
                            verifyOtpMutation.mutate({
                              id: handoverId,
                              otp: otpInput.trim(),
                            });
                        }}
                        disabled={verifyOtpMutation.isPending || otpInput.trim().length !== 6}
                        className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center shrink-0"
                      >
                        {verifyOtpMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 mr-1.5" />
                        )}
                        Verify OTP &amp; Release
                      </button>
                    </div>

                    {directHandover && (
                      <p className="text-[11px] text-slate-500 text-right">
                        Failed attempts: <strong>{directHandover.failed_otp_attempts || 0}</strong> / 5
                      </p>
                    )}
                  </div>
                ) : (
                  /* General Item Handover */
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Before releasing this general item, verify that the physical item matches the description and the student ID card matches claimant <strong>{approvedClaim.student_name}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => { if (handoverId) confirmCollectionMutation.mutate(handoverId); }}
                      disabled={confirmCollectionMutation.isPending}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                    >
                      {confirmCollectionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Complete Handover to {approvedClaim.student_name}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Campus Custody Protocol · Handover Phase 2</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
