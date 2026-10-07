import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { AdminStats, Claim, LostItem, MatchItem, AdminFoundItem } from '../types/recovery';
import {
  Search, Camera, ArrowRight, Clock,
  PlusCircle, CheckCircle2, Package,
  Sparkles, MapPin, Eye, X,
  ShieldAlert, RefreshCw
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const isStaff = user?.role && ['custodian', 'admin', 'superadmin'].includes(user.role);

  // --- Real Admin Dashboard Queries ---
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => api.get<AdminStats>('/api/items/admin-stats/'),
    enabled: !!isStaff,
  });

  const { data: recoveryQueue = [], isLoading: isQueueLoading } = useQuery<AdminFoundItem[]>({
    queryKey: ['admin-recovery-queue'],
    queryFn: async () => {
      const res = await api.get<AdminFoundItem[] | { results: AdminFoundItem[] }>('/api/items/found-items/');
      return Array.isArray(res) ? res : (res as { results: AdminFoundItem[] }).results || [];
    },
    enabled: !!isStaff,
  });

  // Admin Case Detail inspection modal state
  const [inspectingCaseId, setInspectingCaseId] = useState<string | null>(null);

  const { data: caseDetail, isLoading: isCaseDetailLoading } = useQuery<{
    item: AdminFoundItem;
    matches: Array<{
      public_id: string;
      score: number;
      score_breakdown: any;
      status: string;
      lost_item: {
        public_id: string;
        category: string;
        description: string;
        user_name: string;
        user_email: string;
      };
    }>;
    claims: Array<{
      public_id: string;
      student_name: string;
      student_email: string;
      status: string;
      admin_notes?: string;
      created_at: string;
      verification?: {
        question: string;
        student_answer: string;
        submission_timestamp: string;
      };
      handover?: {
        public_id?: string;
        status?: string;
        is_valuable: boolean;
        failed_attempts: number;
        confirmed_at?: string;
      };
    }>;
    audit_logs: Array<{
      action: string;
      actor_email: string;
      timestamp: string;
      details: any;
    }>;
  }>({
    queryKey: ['case-detail', inspectingCaseId],
    queryFn: async () => api.get(`/api/items/found-items/${inspectingCaseId}/case-details/`),
    enabled: !!inspectingCaseId && !!isStaff,
  });

  // --- Real Student Dashboard Queries ---
  const { data: claims = [] } = useQuery<Claim[]>({
    queryKey: ['my-claims'],
    queryFn: async () => {
      const res = await api.get<Claim[] | { results: Claim[] }>('/api/pickup/claims/my-claims/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: !isStaff,
  });

  const { data: lostReports = [] } = useQuery<LostItem[]>({
    queryKey: ['my-lost-reports'],
    queryFn: async () => {
      const res = await api.get<LostItem[] | { results: LostItem[] }>('/api/items/lost-items/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: !isStaff,
  });

  const { data: matches = [] } = useQuery<MatchItem[]>({
    queryKey: ['my-matches'],
    queryFn: async () => {
      const res = await api.get<MatchItem[] | { results: MatchItem[] }>('/api/items/matches/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: !isStaff,
  });

  const firstName = user?.name?.split(' ')[0] || 'there';

  const activeReports = lostReports.filter(r => r.status !== 'RESOLVED').length;
  const candidateMatches = matches.filter(m => m.status === 'CANDIDATE').length;
  const pendingClaims = claims.filter(c => c.status === 'PENDING' || (c.status === 'APPROVED' && c.handover?.status !== 'COMPLETED')).length;
  const resolvedCount = claims.filter(c => c.handover?.status === 'COMPLETED').length + lostReports.filter(r => r.status === 'RESOLVED').length;

  // 6-step recovery pipeline stages helper for student cases
  const RECOVERY_STAGES = [
    { key: 'REPORTED', label: 'Reported' },
    { key: 'AI_MONITORING', label: 'AI Monitoring' },
    { key: 'MATCH_FOUND', label: 'Possible Match' },
    { key: 'VERIFICATION', label: 'Verification' },
    { key: 'PICKUP', label: 'Ready for Pickup' },
    { key: 'REUNITED', label: 'Reunited' },
  ];

  const getLostItemStageIndex = (item: LostItem): number => {
    if (item.status === 'RESOLVED') return 5;
    const hasCandidateMatch = matches.some(m => m.lost_item_public_id === item.public_id && m.status === 'CANDIDATE');
    if (hasCandidateMatch) return 2;
    return 1; // AI Monitoring active
  };

  const getClaimStageIndex = (claim: Claim): number => {
    if (claim.handover?.status === 'COMPLETED') return 5;
    if (claim.status === 'APPROVED') return 4;
    if (claim.status === 'PENDING') return 3;
    return 2;
  };

  // ─── STUDENT DASHBOARD ──────────────────────────────────────────────────
  if (!isStaff) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section: Greeting + 3 Required Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 pt-6 pb-8 sm:px-8">
            <p className="text-sm font-medium text-blue-600 mb-1">Welcome back, {firstName} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
              Campus Lost &amp; Found Recovery Platform
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">
              Report lost possessions, log found items with AI vision assistance, and track custody handover through verified campus stations.
            </p>

            {/* Section 4: Quick Actions (3 Primary Cards) */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                to="/lost"
                id="cta-report-lost"
                className="group flex flex-col justify-between p-5 bg-red-50/70 border-2 border-red-200 hover:border-red-400 hover:bg-red-50 rounded-2xl transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-red-900">I Lost Something</p>
                  <p className="text-xs text-red-600 mt-0.5">Start AI-monitored lost report</p>
                </div>
                <div className="mt-3 text-xs font-semibold text-red-700 group-hover:text-red-900 flex items-center gap-1">
                  Report Item <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                </div>
              </Link>

              <Link
                to="/found"
                id="cta-report-found"
                className="group flex flex-col justify-between p-5 bg-teal-50/70 border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50 rounded-2xl transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-600 mb-3">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-teal-900">I Found Something</p>
                  <p className="text-xs text-teal-600 mt-0.5">Photo → AI Scan → Station Drop</p>
                </div>
                <div className="mt-3 text-xs font-semibold text-teal-700 group-hover:text-teal-900 flex items-center gap-1">
                  Upload Photo <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                </div>
              </Link>

              <Link
                to="/found-items"
                id="cta-browse-found"
                className="group flex flex-col justify-between p-5 bg-blue-50/70 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 mb-3">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-blue-900">Browse Found Items</p>
                  <p className="text-xs text-blue-600 mt-0.5">Inspect catalog &amp; holding desks</p>
                </div>
                <div className="mt-3 text-xs font-semibold text-blue-700 group-hover:text-blue-900 flex items-center gap-1">
                  Browse Catalog <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                </div>
              </Link>
            </div>
          </div>

          {/* Status Metric Strip */}
          {(activeReports > 0 || candidateMatches > 0 || pendingClaims > 0 || resolvedCount > 0) && (
            <div className="border-t border-slate-100 bg-slate-50 px-6 sm:px-8 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link to="/my-reports" className="group text-center">
                <div className="text-2xl font-extrabold text-slate-900">{activeReports}</div>
                <div className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">Active Reports</div>
              </Link>
              <Link to="/my-matches" className="group text-center">
                <div className="text-2xl font-extrabold text-blue-700">{candidateMatches}</div>
                <div className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">Possible Matches</div>
              </Link>
              <Link to="/recovery" className="group text-center">
                <div className="text-2xl font-extrabold text-amber-600">{pendingClaims}</div>
                <div className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">Active Claims</div>
              </Link>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-emerald-600">{resolvedCount}</div>
                <div className="text-xs font-medium text-slate-500">Reunited Cases</div>
              </div>
            </div>
          )}
        </div>

        {/* Possible Matches Alert */}
        {candidateMatches > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-900">
                {candidateMatches} possible {candidateMatches === 1 ? 'match' : 'matches'} found
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Reunite matched items in campus custody with your loss reports.</p>
            </div>
            <Link
              to="/my-matches"
              className="shrink-0 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
            >
              Review <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Section 4: Active Recovery Cases (Real Backend Records Only) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Active Recovery Cases
            </h2>
            <Link to="/recovery" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Recovery Center →
            </Link>
          </div>

          {lostReports.length === 0 && claims.length === 0 ? (
            /* Honest Useful Empty State */
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">No active recovery cases</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When you report a lost item or submit a claim on a found item, your recovery journey will appear here with live stage progression.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/lost"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
                >
                  File Lost Report
                </Link>
                <Link
                  to="/found-items"
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Browse Campus Catalog
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lost Item Recovery Cases */}
              {lostReports.map((report) => {
                const stageIdx = getLostItemStageIndex(report);
                const primaryImage = report.images && report.images.length > 0 ? report.images[0].image_url || report.images[0].image : null;

                return (
                  <div
                    key={`lost-${report.public_id}`}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {primaryImage ? (
                          <img src={primaryImage} alt={report.category} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0 font-bold text-sm">
                            {report.category.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-800 px-2 py-0.5 rounded">
                              Lost Report
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              ID: {report.public_id.substring(0, 8)}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mt-0.5">{report.description || report.category}</h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs text-slate-500">
                          Updated {new Date(report.updated_at).toLocaleDateString()}
                        </span>
                        <Link
                          to="/my-matches"
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
                        >
                          Check Matches
                        </Link>
                      </div>
                    </div>

                    {/* Visual 6-Stage Timeline */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                        {RECOVERY_STAGES.map((st, idx) => {
                          const isDone = idx <= stageIdx;
                          const isCurrent = idx === stageIdx;

                          return (
                            <div
                              key={st.key}
                              className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center space-y-1 ${
                                isDone
                                  ? 'bg-blue-50/70 border-blue-200 text-blue-900 font-semibold'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                              )}
                              <span>{st.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Claim Recovery Cases */}
              {claims.map((claim) => {
                const stageIdx = getClaimStageIndex(claim);
                const item = claim.found_item;
                const isReunited = claim.handover?.status === 'COMPLETED';

                return (
                  <div
                    key={`claim-${claim.public_id}`}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0 font-bold text-sm">
                          {isReunited ? '🎉' : 'CLAIM'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                              Ownership Claim
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              ID: {claim.public_id.substring(0, 8)}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mt-0.5">{item.title || item.category}</h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs text-slate-500">
                          Updated {new Date(claim.updated_at).toLocaleDateString()}
                        </span>
                        <Link
                          to="/recovery"
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                        >
                          View Case
                        </Link>
                      </div>
                    </div>

                    {/* Visual 6-Stage Timeline */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                        {RECOVERY_STAGES.map((st, idx) => {
                          const isDone = idx <= stageIdx;
                          const isCurrent = idx === stageIdx;

                          return (
                            <div
                              key={st.key}
                              className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center space-y-1 ${
                                isDone
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-semibold'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              } ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                              )}
                              <span>{st.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── ADMIN / CUSTODIAN DASHBOARD ─────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campus Custodial Operations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <strong>{user?.name}</strong> · Role: <span className="capitalize font-semibold text-slate-800">{user?.role}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/collection-points"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
          >
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            Manage Stations
          </Link>
          <Link
            to="/admin/register-found"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Register Found Item
          </Link>
        </div>
      </div>

      {/* Section 10: Needs Attention (Real backend counts) */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Needs Attention
        </h2>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Link
              to="/admin/verification"
              className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl hover:border-amber-400 hover:shadow-xs transition-all group"
            >
              <div className="text-2xl font-extrabold text-amber-900">{stats.pending_claims ?? 0}</div>
              <div className="text-xs font-bold text-amber-800 mt-1">Claims Awaiting Verification</div>
              <div className="text-[11px] text-amber-600 group-hover:underline mt-1">Review queue →</div>
            </Link>

            <Link
              to="/admin/verification"
              className="bg-red-50/70 border border-red-200 p-4 rounded-xl hover:border-red-400 hover:shadow-xs transition-all group"
            >
              <div className="text-2xl font-extrabold text-red-900">{stats.valuable_awaiting_verification ?? 0}</div>
              <div className="text-xs font-bold text-red-800 mt-1">Valuable Items Awaiting Review</div>
              <div className="text-[11px] text-red-600 group-hover:underline mt-1">Requires OTP →</div>
            </Link>

            <Link
              to="/admin/handovers"
              className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all group"
            >
              <div className="text-2xl font-extrabold text-blue-900">{stats.pending_handovers ?? 0}</div>
              <div className="text-xs font-bold text-blue-800 mt-1">Items Ready for Handover</div>
              <div className="text-[11px] text-blue-600 group-hover:underline mt-1">Process OTP / ID →</div>
            </Link>

            <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-xl">
              <div className="text-2xl font-extrabold text-purple-900">{stats.candidate_matches ?? 0}</div>
              <div className="text-xs font-bold text-purple-800 mt-1">Possible Matches Active</div>
              <div className="text-[11px] text-purple-600 mt-1">Engine v1 Active</div>
            </div>

            <Link
              to="/admin/collection-points"
              className="bg-teal-50/70 border border-teal-200 p-4 rounded-xl hover:border-teal-400 hover:shadow-xs transition-all group"
            >
              <div className="text-2xl font-extrabold text-teal-900">{stats.station_tasks ?? 0}</div>
              <div className="text-xs font-bold text-teal-800 mt-1">Station Collection Tasks</div>
              <div className="text-[11px] text-teal-600 group-hover:underline mt-1">Deposit pending →</div>
            </Link>

            <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl">
              <div className="text-2xl font-extrabold text-slate-900">{stats.disputes ?? 0}</div>
              <div className="text-xs font-bold text-slate-800 mt-1">Active Disputes</div>
              <div className="text-[11px] text-slate-500 mt-1">Custodial cases</div>
            </div>
          </div>
        )}
      </div>

      {/* Section 10: Recovery Queue (Table with real backend items) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-0">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Institutional Recovery Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live items currently registered in custody, awaiting verification, or ready for physical handover.
            </p>
          </div>
          <div className="text-xs font-medium text-slate-500">
            Total Items: <strong>{recoveryQueue.length}</strong>
          </div>
        </div>

        {isQueueLoading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
            Loading recovery queue...
          </div>
        ) : recoveryQueue.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No items registered in the recovery queue yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recoveryQueue.slice(0, 15).map((item) => (
                  <tr key={item.public_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.title || item.category}</div>
                      <div className="text-[11px] text-slate-400 font-mono">ID: {item.public_id.substring(0, 8)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.status === 'READY_FOR_PICKUP'
                          ? 'bg-blue-100 text-blue-800'
                          : item.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'DEPOSIT_PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.risk_tier === 1
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.risk_tier === 1 ? 'Valuable (OTP)' : 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">
                        {item.collection_location?.station_code || 'Central Desk'}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.found_location || 'Campus'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(item.published_at || item.found_date || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setInspectingCaseId(item.public_id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Inspect Case
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 11: Admin Complete Case Inspection Modal */}
      {inspectingCaseId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectingCaseId(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {isCaseDetailLoading || !caseDetail ? (
              <div className="py-20 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                Loading complete case file...
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Administrative Case Audit File
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">
                    {caseDetail.item.title || caseDetail.item.category}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Public Case UUID: {caseDetail.item.public_id}
                  </p>
                </div>

                {/* Section 11.1: Item */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">1. Item Physical Identity</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                    <div>Category: <strong>{caseDetail.item.category}</strong></div>
                    <div>Risk: <strong>{caseDetail.item.risk_tier === 1 ? 'Valuable (OTP)' : 'General'}</strong></div>
                    <div>Status: <strong>{caseDetail.item.status}</strong></div>
                    <div>Published: <strong>{caseDetail.item.is_published ? 'Yes' : 'No'}</strong></div>
                  </div>
                  <p className="text-slate-600 mt-1 pt-1 border-t border-slate-200">
                    {caseDetail.item.description}
                  </p>
                </div>

                {/* Section 11.2: AI Analysis */}
                <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 text-xs space-y-2">
                  <h3 className="font-bold text-teal-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    2. AI Vision Analysis &amp; Metadata
                  </h3>
                  {caseDetail.item.ai_metadata && Object.keys(caseDetail.item.ai_metadata).length > 0 ? (
                    <div className="space-y-1 text-teal-900">
                      <div>Confidence: <strong>{caseDetail.item.ai_metadata.confidence || 'Medium'}</strong></div>
                      <div>Apparent Color: <strong>{caseDetail.item.ai_metadata.apparent_color || 'Unknown'}</strong></div>
                      <div>Visible Characteristics: <strong>{caseDetail.item.ai_metadata.visible_characteristics || 'Detected in frame'}</strong></div>
                    </div>
                  ) : (
                    <p className="text-teal-700 italic">No automated AI vision flags or student corrections registered.</p>
                  )}
                </div>

                {/* Section 11.3: Match */}
                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 text-xs space-y-2">
                  <h3 className="font-bold text-purple-900 uppercase tracking-wider text-[11px]">3. Candidate Correlation &amp; Matches</h3>
                  {caseDetail.matches.length > 0 ? (
                    <div className="space-y-2">
                      {caseDetail.matches.map(m => (
                        <div key={m.public_id} className="p-2.5 bg-white rounded-lg border border-purple-100 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-purple-900">{m.score} / 100 Match</span>
                            <span className="text-slate-500 ml-2">Lost: {m.lost_item.description}</span>
                          </div>
                          <span className="text-[11px] font-mono text-purple-700">{m.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-purple-700 italic">No automated match candidates currently correlated.</p>
                  )}
                </div>

                {/* Section 11.4: Claims & Verification */}
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 text-xs space-y-2">
                  <h3 className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">4. Claims &amp; Verification Evidence</h3>
                  {caseDetail.claims.length > 0 ? (
                    <div className="space-y-2">
                      {caseDetail.claims.map(c => (
                        <div key={c.public_id} className="p-3 bg-white rounded-lg border border-amber-200 space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span>Claimant: {c.student_name} ({c.student_email})</span>
                            <span className="text-amber-800">{c.status}</span>
                          </div>
                          {c.verification && (
                            <div className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                              <span className="font-semibold text-slate-800">Submitted Proof:</span> {c.verification.student_answer}
                            </div>
                          )}
                          {c.handover && (
                            <div className="text-[11px] text-slate-500">
                              Handover Status: <strong>{c.handover.status}</strong> (Valuable: {c.handover.is_valuable ? 'Yes' : 'No'})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-amber-700 italic">No active claims filed on this item.</p>
                  )}
                </div>

                {/* Section 11.5: Audit History */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">5. Custodial Audit Log</h3>
                  {caseDetail.audit_logs.length > 0 ? (
                    <div className="space-y-1.5">
                      {caseDetail.audit_logs.map((log, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 text-[11px]">
                          <span className="font-semibold text-slate-800">{log.action}</span>
                          <span className="text-slate-500">{log.actor_email}</span>
                          <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No prior audit logs recorded for this case.</p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setInspectingCaseId(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Close Case File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
