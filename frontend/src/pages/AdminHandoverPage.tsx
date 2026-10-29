import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { Handover } from '../types/recovery';
import {
  ShieldCheck,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Package,
  QrCode,
  Search,
  ExternalLink,
} from 'lucide-react';
import { QrScannerModal } from '../components/QrScannerModal';
import { CustodianHandoverModal } from '../components/CustodianHandoverModal';

export const AdminHandoverPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string | null>>({});

  // QR Scanner & Handover modal state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [handoverModalFoundId, setHandoverModalFoundId] = useState<string | null>(null);
  const [manualFoundId, setManualFoundId] = useState('');

  const queryClient = useQueryClient();

  const { data: handovers = [], isLoading, isError } = useQuery<Handover[]>({
    queryKey: ['admin-handovers', statusFilter],
    queryFn: async () => {
      const url = `/api/handovers/admin/?status=${statusFilter}`;
      const res = await api.get<Handover[] | { results: Handover[] }>(url);
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async ({ handoverId, otp }: { handoverId: string; otp: string }) => {
      return api.post(`/api/handovers/admin/${handoverId}/verify-otp/`, { otp });
    },
    onSuccess: (_, vars) => {
      setActionError((prev) => ({ ...prev, [vars.handoverId]: null }));
      setOtpInputs((prev) => ({ ...prev, [vars.handoverId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: ApiError, vars) => {
      setActionError((prev) => ({
        ...prev,
        [vars.handoverId]: err.message || 'OTP verification failed.',
      }));
    },
  });

  // Regenerate OTP mutation
  const regenerateOtpMutation = useMutation({
    mutationFn: async (handoverId: string) => {
      return api.post(`/api/handovers/admin/${handoverId}/regenerate-otp/`);
    },
    onSuccess: (_, handoverId) => {
      setActionError((prev) => ({ ...prev, [handoverId]: null }));
      setOtpInputs((prev) => ({ ...prev, [handoverId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin-handovers'] });
    },
    onError: (err: ApiError, handoverId) => {
      setActionError((prev) => ({
        ...prev,
        [handoverId]: err.message || 'Failed to regenerate OTP.',
      }));
    },
  });

  // Confirm collection mutation (for general items)
  const confirmCollectionMutation = useMutation({
    mutationFn: async (handoverId: string) => {
      return api.post(`/api/handovers/admin/${handoverId}/confirm-collection/`);
    },
    onSuccess: (_, handoverId) => {
      setActionError((prev) => ({ ...prev, [handoverId]: null }));
      queryClient.invalidateQueries({ queryKey: ['admin-handovers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err: ApiError, handoverId) => {
      setActionError((prev) => ({
        ...prev,
        [handoverId]: err.message || 'Failed to confirm collection.',
      }));
    },
  });

  const handleOtpInputChange = (handoverId: string, val: string) => {
    setOtpInputs((prev) => ({ ...prev, [handoverId]: val }));
  };

  // Handle QR scan result — extract found ID and open handover modal
  const handleQrScan = (foundId: string) => {
    setScannerOpen(false);
    setHandoverModalFoundId(foundId.trim().toUpperCase());
  };

  // Handle manual Found ID search
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualFoundId.trim().toUpperCase();
    if (trimmed) {
      setHandoverModalFoundId(trimmed);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Handover &amp; OTP Center</h1>
            <p className="text-sm text-slate-600 mt-1">
              Perform physical handover verification for approved items. Scan a Found Item QR code or enter the Found ID manually to inspect and process handover.
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white shrink-0"
          >
            <option value="all">All Handovers</option>
            <option value="READY">Ready for Collection</option>
            <option value="PENDING_OTP">Pending OTP Verification</option>
            <option value="COMPLETED">Completed Handovers</option>
            <option value="FAILED">Failed / Locked</option>
          </select>
        </div>

        {/* QR Scan + Manual Search Row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
          {/* Scan QR Button */}
          <button
            id="btn-scan-item-qr"
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <QrCode className="w-4 h-4" />
            Scan Item QR
          </button>

          {/* Manual Found ID Search */}
          <form
            id="form-manual-found-id-search"
            onSubmit={handleManualSearch}
            className="flex flex-1 gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="input-manual-found-id"
                type="text"
                placeholder="Enter Found ID manually — e.g. RNT-F-8M2Q6W"
                value={manualFoundId}
                onChange={(e) => setManualFoundId(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-slate-300 rounded-lg bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
            <button
              id="btn-manual-found-id-lookup"
              type="submit"
              disabled={!manualFoundId.trim()}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors shrink-0"
            >
              Lookup
            </button>
          </form>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Loading handovers queue...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
          Failed to load handovers list. Please verify staff permissions.
        </div>
      ) : handovers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No handovers pending</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no active handovers matching status <span className="font-semibold">{statusFilter}</span>.
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Use the <span className="font-semibold">Scan Item QR</span> button or enter a Found ID above to look up any item directly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {handovers.map((handover) => {
            const item = handover.found_item;
            const student = handover.student;
            const err = actionError[handover.public_id];
            const otpVal = otpInputs[handover.public_id] || '';

            return (
              <div
                key={handover.public_id}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{item?.title || 'Item'}</h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        handover.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : handover.status === 'FAILED'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {handover.status}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700">
                    <div className="flex items-center space-x-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Claimant:</span>
                      <span className="font-bold text-slate-900">{student?.name || 'Student'}</span> ({student?.email})
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                      <span>Category / Risk:</span>
                      <span className="font-semibold">{item?.category}</span> ({handover.is_valuable ? 'Valuable Item' : 'General Item'})
                    </div>
                    {item?.public_id && (
                      <div className="flex items-center space-x-1.5">
                        <QrCode className="w-3.5 h-3.5 text-slate-500" />
                        <span>Found ID:</span>
                        <span className="font-mono font-semibold text-blue-700">{item.public_id}</span>
                      </div>
                    )}
                  </div>

                  {err && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start space-x-1.5">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  )}
                </div>

                {/* Handover Action Footer */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {/* Inspect & Handover quick-access button (opens modal by found_item public_id) */}
                  {item?.public_id && handover.status !== 'COMPLETED' && (
                    <button
                      id={`btn-inspect-handover-${handover.public_id}`}
                      type="button"
                      onClick={() => setHandoverModalFoundId(item.public_id)}
                      className="w-full py-2 px-4 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Inspect &amp; Process Handover
                    </button>
                  )}

                  {handover.status === 'COMPLETED' ? (
                    <div className="text-xs font-semibold text-emerald-700 flex items-center justify-center py-2 bg-emerald-50 border border-emerald-200 rounded-md">
                      <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                      Physical Collection Completed &amp; Resolved
                    </div>
                  ) : handover.status === 'FAILED' ? (
                    <div className="text-xs font-semibold text-red-700 flex items-center justify-center py-2 bg-red-50 border border-red-200 rounded-md">
                      <AlertCircle className="w-4 h-4 mr-1.5 text-red-600" />
                      Handover Locked (Max OTP Attempts Exceeded)
                    </div>
                  ) : handover.is_valuable ? (
                    /* Valuable Item OTP Verification */
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Enter Student 6-Digit OTP Code:
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="e.g. 849201"
                          value={otpVal}
                          onChange={(e) => handleOtpInputChange(handover.public_id, e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm font-mono tracking-widest text-center border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            verifyOtpMutation.mutate({
                              handoverId: handover.public_id,
                              otp: otpVal,
                            })
                          }
                          disabled={verifyOtpMutation.isPending || otpVal.length !== 6}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md shadow-xs flex items-center shrink-0"
                        >
                          {verifyOtpMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                          )}
                          Verify OTP
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500">
                          Failed attempts: <strong>{handover.failed_otp_attempts}</strong> / 5
                          {handover.otp_expires_at && ` · Expires: ${new Date(handover.otp_expires_at).toLocaleTimeString()}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => regenerateOtpMutation.mutate(handover.public_id)}
                          disabled={regenerateOtpMutation.isPending}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                        >
                          {regenerateOtpMutation.isPending ? 'Regenerating...' : 'Regenerate OTP'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* General Item Physical Collection Confirmation */
                    <button
                      type="button"
                      onClick={() => confirmCollectionMutation.mutate(handover.public_id)}
                      disabled={confirmCollectionMutation.isPending}
                      className="w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-md shadow-xs transition-colors flex items-center justify-center"
                    >
                      {confirmCollectionMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Confirm Physical Collection
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQrScan}
      />

      {/* Custodian Case Inspection & Handover Modal */}
      <CustodianHandoverModal
        foundId={handoverModalFoundId}
        isOpen={!!handoverModalFoundId}
        onClose={() => setHandoverModalFoundId(null)}
        onHandoverSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-handovers'] });
          queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        }}
      />
    </div>
  );
};
