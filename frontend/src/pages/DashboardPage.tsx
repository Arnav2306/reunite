import { FoundItemSticker } from '../components/FoundItemSticker';
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api, getMediaUrl } from '../services/api';
import type { AdminStats, Claim, LostItem, MatchItem, AdminFoundItem, AvailableItem } from '../types/recovery';
import {
  Search, Camera, ArrowRight, Clock,
  PlusCircle, CheckCircle2, Package,
  Sparkles, MapPin, Eye, X,
  ShieldAlert, RefreshCw, Star, ClipboardList,
  History, MessageSquare, Trash2, AlertTriangle,
  Printer, QrCode
} from 'lucide-react';
import { QrScannerModal } from '../components/QrScannerModal';
import { CustodianHandoverModal } from '../components/CustodianHandoverModal';

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

  const { data: auditLogs = [] } = useQuery<Array<{
    public_id: string;
    actor_email: string;
    actor_name: string;
    action: string;
    target_type: string;
    target_id: string;
    details: any;
    timestamp: string;
  }>>({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const res = await api.get<any>('/api/audit/logs/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: !!isStaff,
  });

  const { data: feedbackSummary } = useQuery<{
    total_feedback: number;
    average_rating: number;
  }>({
    queryKey: ['admin-feedback-summary'],
    queryFn: async () => api.get('/api/pickup/feedback/summary/'),
    enabled: !!isStaff,
  });

  const { data: feedbacksList = [] } = useQuery<Array<{
    public_id: string;
    user_name: string;
    rating: number;
    comment: string;
    created_at: string;
  }>>({
    queryKey: ['admin-feedbacks-list'],
    queryFn: async () => {
      const res = await api.get<any>('/api/pickup/feedback/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: !!isStaff,
  });

  const queryClient = useQueryClient();

  const { data: adminLostReports = [], isLoading: isLostLoading } = useQuery<LostItem[]>({
    queryKey: ['admin-lost-reports'],
    queryFn: async () => {
      const res = await api.get<LostItem[] | { results: LostItem[] }>('/api/items/lost-items/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: !!isStaff,
  });

  // Admin Case Detail inspection modal state
  const [inspectingCaseId, setInspectingCaseId] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'queue' | 'tasks' | 'audit' | 'feedback'>('queue');

  // Admin search & filtering state
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminReportTypeFilter, setAdminReportTypeFilter] = useState<'all' | 'found' | 'lost' | 'suspicious'>('all');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('all');
  const [adminExactIdOnly, setAdminExactIdOnly] = useState(false);
  const [printLabelItem, setPrintLabelItem] = useState<{ id: string; category: string; title: string; location?: string; date?: string } | null>(null);
  const [depositConfirmingId, setDepositConfirmingId] = useState<string | null>(null);

  const handleConfirmDeposit = async (foundId: string) => {
    setDepositConfirmingId(foundId);
    try {
      await api.post(`/api/items/found-items/${foundId}/confirm-deposit/`);
      queryClient.invalidateQueries({ queryKey: ['admin-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      if (inspectingCaseId === foundId) {
        queryClient.invalidateQueries({ queryKey: ['case-detail', inspectingCaseId] });
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to confirm deposit.');
    } finally {
      setDepositConfirmingId(null);
    }
  };

  // QR Scanner & Custodian Handover Modal (Dashboard-level)
  const [dashboardScannerOpen, setDashboardScannerOpen] = useState(false);
  const [dashboardHandoverFoundId, setDashboardHandoverFoundId] = useState<string | null>(null);

  // Admin archive modal state
  const [archiveTarget, setArchiveTarget] = useState<{ type: 'found' | 'lost'; id: string; title: string } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const handleArchiveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTarget) return;
    if (!archiveReason.trim()) {
      setArchiveError('A removal/archive reason is required for the audit record.');
      return;
    }
    setArchiveSubmitting(true);
    setArchiveError(null);
    try {
      if (archiveTarget.type === 'found') {
        await api.post(`/api/items/found-items/${archiveTarget.id}/archive/`, { reason: archiveReason.trim() });
      } else {
        await api.post(`/api/items/lost-items/${archiveTarget.id}/archive/`, { reason: archiveReason.trim() });
      }
      setArchiveTarget(null);
      setArchiveReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lost-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    } catch (err: any) {
      setArchiveError(err.message || 'Failed to archive report.');
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const unifiedReports = useMemo(() => {
    if (!isStaff) return [];
    const list: Array<{
      id: string;
      title: string;
      reportType: 'found' | 'lost';
      category: string;
      status: string;
      riskTier: number;
      location: string;
      date: string;
      isSuspicious: boolean;
      suspiciousReason: string;
      canInspect: boolean;
    }> = [];

    recoveryQueue.forEach((item) => {
      const flaggedLog = auditLogs.find(
        (l) => l.target_id === item.public_id && (l.action.includes('FLAGGED') || l.action.includes('SUSPICIOUS'))
      );
      const isSuspicious = !item.is_published || !!flaggedLog;
      const suspiciousReason = flaggedLog?.details?.reason || (!item.is_published ? 'Held for staff review' : '');

      list.push({
        id: item.public_id,
        title: item.title || item.category,
        reportType: 'found',
        category: item.category,
        status: item.status,
        riskTier: item.risk_tier,
        location: item.collection_location?.station_code || item.found_location || 'Campus Desk',
        date: item.published_at || item.found_date || (item as any).created_at || new Date().toISOString(),
        isSuspicious,
        suspiciousReason,
        canInspect: true,
      });
    });

    adminLostReports.forEach((item) => {
      const flaggedLog = auditLogs.find(
        (l) => l.target_id === item.public_id && (l.action.includes('FLAGGED') || l.action.includes('SUSPICIOUS'))
      );
      const isSuspicious = !!flaggedLog;
      const suspiciousReason = flaggedLog?.details?.reason || '';

      list.push({
        id: item.public_id,
        title: item.category,
        reportType: 'lost',
        category: item.category,
        status: item.status,
        riskTier: item.risk_tier || 0,
        location: (item.original_answers as any)?.lost_location || 'Campus',
        date: item.created_at,
        isSuspicious,
        suspiciousReason,
        canInspect: false,
      });
    });

    return list.filter((r) => {
      if (adminReportTypeFilter === 'found' && r.reportType !== 'found') return false;
      if (adminReportTypeFilter === 'lost' && r.reportType !== 'lost') return false;
      if (adminReportTypeFilter === 'suspicious' && !r.isSuspicious) return false;

      if (adminStatusFilter !== 'all' && r.status.toLowerCase() !== adminStatusFilter.toLowerCase()) return false;
      if (adminCategoryFilter !== 'all' && r.category.toLowerCase() !== adminCategoryFilter.toLowerCase()) return false;

      if (adminSearchQuery.trim()) {
        const q = adminSearchQuery.trim().toLowerCase();
        if (adminExactIdOnly) {
          if (r.id.toLowerCase() !== q) return false;
        } else {
          const matchesTitle = r.title.toLowerCase().includes(q);
          const matchesCat = r.category.toLowerCase().includes(q);
          const matchesId = r.id.toLowerCase().includes(q);
          const matchesLoc = r.location.toLowerCase().includes(q);
          if (!matchesTitle && !matchesCat && !matchesId && !matchesLoc) return false;
        }
      }

      return true;
    });
  }, [isStaff, recoveryQueue, adminLostReports, auditLogs, adminReportTypeFilter, adminStatusFilter, adminCategoryFilter, adminSearchQuery, adminExactIdOnly]);

  // Student feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

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

  const { data: foundReports = [] } = useQuery<AvailableItem[]>({
    queryKey: ['my-found-reports'],
    queryFn: async () => {
      const res = await api.get<AvailableItem[] | { results: AvailableItem[] }>('/api/items/student-found/');
      return Array.isArray(res) ? res : (res as { results: AvailableItem[] }).results || [];
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

          {lostReports.length === 0 && claims.length === 0 && foundReports.length === 0 ? (
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
                const primaryImage = report.images && report.images.length > 0 ? getMediaUrl(report.images[0].image_url || report.images[0].image) : null;

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
                        {isReunited && (
                          <button
                            type="button"
                            onClick={() => setShowFeedbackModal(true)}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            Leave Feedback
                          </button>
                        )}
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

              {/* Student Found Item Reports */}
              {foundReports.map((found) => {
                const primaryImage = found.images && found.images.length > 0 ? getMediaUrl(found.images[0].image_url || found.images[0].image) : null;
                return (
                  <div
                    key={`found-${found.public_id}`}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {primaryImage ? (
                          <img src={primaryImage} alt={found.title || found.category} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0 font-bold text-sm">
                            {found.category.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                              Found Report
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              ID: {found.public_id.substring(0, 8)}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mt-0.5">{found.title || found.description || found.category}</h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs text-slate-500">
                          {found.found_location ? `Found at ${found.found_location}` : 'Campus'}
                        </span>
                        <Link
                          to="/found-items"
                          className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
                        >
                          View in Catalog
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Student Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 relative">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">How was your recovery experience?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your feedback helps our campus custodial and lost-and-found team improve operations.
                </p>
              </div>

              {feedbackDone ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                  <p className="text-sm font-bold text-emerald-900">Thank you for your feedback!</p>
                  <p className="text-xs text-emerald-700">Your rating has been submitted to campus operations.</p>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setFeedbackSubmitting(true);
                    try {
                      await api.post('/api/pickup/feedback/', {
                        rating: feedbackRating,
                        comment: feedbackComment,
                      });
                      setFeedbackDone(true);
                      setTimeout(() => {
                        setShowFeedbackModal(false);
                        setFeedbackDone(false);
                        setFeedbackComment('');
                        setFeedbackRating(5);
                      }, 1200);
                    } catch (err) {
                      console.error('Feedback submission error:', err);
                    } finally {
                      setFeedbackSubmitting(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rating (1 to 5 Stars)</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className={`p-2 rounded-xl border transition-all ${
                            feedbackRating >= star
                              ? 'bg-amber-50 border-amber-300 text-amber-500'
                              : 'bg-slate-50 border-slate-200 text-slate-300'
                          }`}
                        >
                          <Star className={`w-5 h-5 ${feedbackRating >= star ? 'fill-amber-400' : ''}`} />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">{feedbackRating} / 5 Stars</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Comments or Suggestions (Optional)</label>
                    <textarea
                      rows={3}
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Tell us what went well or how we can improve..."
                      className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={feedbackSubmitting}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
                    >
                      {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
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
          <button
            id="btn-dashboard-scan-qr"
            type="button"
            onClick={() => setDashboardScannerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-300 hover:bg-blue-100 rounded-xl transition-colors shadow-2xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan Item QR
          </button>
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

      {/* Section 10: Admin Operations Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveAdminTab('queue')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'queue'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Recovery Queue ({recoveryQueue.length})
        </button>
        <button
          onClick={() => setActiveAdminTab('tasks')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'tasks'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Custodian Task Queue ({stats?.station_tasks ?? 0})
        </button>
        <button
          onClick={() => setActiveAdminTab('audit')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'audit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Audit Log Browser ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveAdminTab('feedback')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'feedback'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Student Feedback ({feedbackSummary?.total_feedback ?? 0})
        </button>
      </div>

      {/* TAB 1: REPORTS & CUSTODY MANAGEMENT QUEUE */}
      {activeAdminTab === 'queue' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden space-y-0">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Institutional Reports &amp; Custody Management</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete view of all lost &amp; found reports, suspicious review flags, active campus stations, and resolution controls.
                </p>
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Matching Reports: <strong>{unifiedReports.length}</strong>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="space-y-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={adminExactIdOnly ? "Exact ID (e.g. RNT-F-8M2Q6W)..." : "Search title, category, ID..."}
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 ${
                      adminExactIdOnly ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] px-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300 font-medium select-none">
                    <input
                      type="checkbox"
                      checked={adminExactIdOnly}
                      onChange={(e) => setAdminExactIdOnly(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    Exact-ID Search
                  </label>
                  {adminExactIdOnly && adminSearchQuery.trim() && (
                    <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px]">Filtering exact ID</span>
                  )}
                </div>
              </div>

              <div>
                <select
                  value={adminReportTypeFilter}
                  onChange={(e) => setAdminReportTypeFilter(e.target.value as any)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Report Types</option>
                  <option value="found">Found Items ({recoveryQueue.length})</option>
                  <option value="lost">Lost Reports ({adminLostReports.length})</option>
                  <option value="suspicious">⚠️ Suspicious / Flagged Reports</option>
                </select>
              </div>

              <div>
                <select
                  value={adminStatusFilter}
                  onChange={(e) => setAdminStatusFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="REPORTED">Reported</option>
                  <option value="DEPOSIT_PENDING">Deposit Pending</option>
                  <option value="DEPOSITED">Deposited in Custody</option>
                  <option value="SECURE_HOLD">Secure Hold</option>
                  <option value="READY_FOR_PICKUP">Ready For Pickup</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="ARCHIVED">Archived / Removed</option>
                </select>
              </div>

              <div>
                <select
                  value={adminCategoryFilter}
                  onChange={(e) => setAdminCategoryFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Bottles">Bottles</option>
                  <option value="ID Cards">ID Cards</option>
                  <option value="Keys">Keys</option>
                  <option value="Wallets">Wallets</option>
                  <option value="Bags">Bags</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {isQueueLoading || isLostLoading ? (
            <div className="py-16 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
              Loading reports queue...
            </div>
          ) : unifiedReports.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              No reports match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Item &amp; ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Risk</th>
                    <th className="py-3 px-4">Location / Station</th>
                    <th className="py-3 px-4">Review Signal</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {unifiedReports.map((r) => (
                    <tr key={`${r.reportType}-${r.id}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{r.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: <span className="font-bold text-slate-700 dark:text-slate-300">{r.id}</span> · {r.category}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.reportType === 'found'
                            ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                            : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {r.reportType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'READY_FOR_PICKUP'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : r.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : r.status === 'DEPOSIT_PENDING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : r.status === 'ARCHIVED'
                            ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.riskTier === 1
                            ? 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {r.riskTier === 1 ? 'Valuable (OTP)' : 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {r.location}
                      </td>
                      <td className="py-3.5 px-4">
                        {r.isSuspicious ? (
                          <span
                            title={r.suspiciousReason}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Flagged for Review
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Clear</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {r.reportType === 'found' && r.status === 'DEPOSIT_PENDING' && (
                            <button
                              onClick={() => handleConfirmDeposit(r.id)}
                              disabled={depositConfirmingId === r.id}
                              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg shadow-2xs transition-colors"
                              title="Confirm Physical Receipt & Deposit"
                            >
                              {depositConfirmingId === r.id ? (
                                <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin text-amber-600" />
                              ) : (
                                <Package className="w-3.5 h-3.5 mr-1 text-amber-600" />
                              )}
                              Deposit
                            </button>
                          )}
                          {r.reportType === 'found' && (
                            <button
                              onClick={() => setPrintLabelItem({
                                id: r.id,
                                category: r.category,
                                title: r.title,
                                location: r.location,
                                date: r.date,
                              })}
                              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg shadow-2xs transition-colors"
                              title="Print Physical Custodial Tag"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1 text-teal-600" />
                              Sticker
                            </button>
                          )}
                          {r.canInspect && (
                            <button
                              onClick={() => setInspectingCaseId(r.id)}
                              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg shadow-2xs transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              Inspect
                            </button>
                          )}
                          {r.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => setArchiveTarget({ type: r.reportType, id: r.id, title: r.title })}
                              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
                              title="Archive / Remove Report"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTODIAN TASK QUEUE */}
      {activeAdminTab === 'tasks' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              Assigned Operational Task Queue
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Prioritized custodial actions required across physical campus stations and verification checkpoints.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-800 dark:text-amber-400">Station Deposits</span>
                  <span className="text-lg font-extrabold text-amber-900 dark:text-amber-300">{stats?.station_tasks ?? 0}</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Items reported awaiting physical deposit at collection stations or on-site retrieval.
                </p>
                <Link
                  to="/admin/collection-points"
                  className="block text-center py-2 px-3 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-200 rounded-lg transition-colors"
                >
                  Process Station Deposits →
                </Link>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-blue-800 dark:text-blue-400">Claims Verification</span>
                  <span className="text-lg font-extrabold text-blue-900 dark:text-blue-300">{stats?.pending_claims ?? 0}</span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Student ownership claims with submitted answers awaiting staff verification review.
                </p>
                <Link
                  to="/admin/verification"
                  className="block text-center py-2 px-3 text-xs font-bold text-blue-900 bg-blue-200/80 hover:bg-blue-200 dark:bg-blue-900/60 dark:text-blue-200 rounded-lg transition-colors"
                >
                  Open Verification Queue →
                </Link>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-400">Pending Handovers</span>
                  <span className="text-lg font-extrabold text-emerald-900 dark:text-emerald-300">{stats?.pending_handovers ?? 0}</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Approved items ready for student in-person collection with OTP or ID verification.
                </p>
                <Link
                  to="/admin/handovers"
                  className="block text-center py-2 px-3 text-xs font-bold text-emerald-900 bg-emerald-200/80 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 rounded-lg transition-colors"
                >
                  Execute Handovers →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEDICATED AUDIT LOG BROWSER */}
      {activeAdminTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden space-y-0">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" />
                Institutional Audit Log Browser
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tamper-evident record of all custody state transitions, administrative decisions, and handovers.
              </p>
            </div>
            <div className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300">
              {auditLogs.length} events logged
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 font-mono text-[11px]">
                  {auditLogs.slice(0, 25).map((log) => (
                    <tr key={log.public_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-900 dark:text-slate-200">
                        {log.actor_name || log.actor_email}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {log.target_type} ({log.target_id?.substring(0, 8) || 'N/A'})
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500 dark:text-slate-400 truncate max-w-xs">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STUDENT FEEDBACK VIEW */}
      {activeAdminTab === 'feedback' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-500">
                <Star className="w-7 h-7 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {feedbackSummary?.average_rating ? `${feedbackSummary.average_rating} / 5.0` : 'No ratings yet'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Average Student Recovery Rating</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {feedbackSummary?.total_feedback ?? 0}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Feedback Submissions</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Student Recovery Reviews</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Feedback and suggestions submitted after receiving items or using campus lost-and-found services.
              </p>
            </div>

            {feedbacksList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No student feedback entries submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {feedbacksList.map((fb) => (
                  <div key={fb.public_id} className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${s <= fb.rating ? 'fill-amber-400' : 'text-slate-200 dark:text-slate-700'}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{fb.user_name || 'Student'}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{new Date(fb.created_at).toLocaleDateString()}</span>
                    </div>
                    {fb.comment && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        "{fb.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                {caseDetail.item.status === 'DEPOSIT_PENDING' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-900 block">Item Awaiting Custodial Deposit</span>
                      <span className="text-[11px] text-amber-700">Attach printed sticker and confirm physical custody receipt at station.</span>
                    </div>
                    <button
                      onClick={() => handleConfirmDeposit(caseDetail.item.public_id)}
                      disabled={depositConfirmingId === caseDetail.item.public_id}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                    >
                      {depositConfirmingId === caseDetail.item.public_id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Package className="w-3.5 h-3.5" />
                      )}
                      Confirm Deposit
                    </button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Administrative Case Audit File
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-1">
                      {caseDetail.item.title || caseDetail.item.category}
                    </h2>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      Found Report ID: <strong className="text-blue-800">{caseDetail.item.public_id}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setPrintLabelItem({
                      id: caseDetail.item.public_id,
                      category: caseDetail.item.category,
                      title: caseDetail.item.title || caseDetail.item.category,
                      location: caseDetail.item.collection_location?.station_code || caseDetail.item.found_location,
                      date: caseDetail.item.found_date || caseDetail.item.published_at || (caseDetail.item as any).created_at,
                    })}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-xl transition-colors shadow-2xs self-start"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                    Print Custodial Tag
                  </button>
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
                  {caseDetail.item.images && caseDetail.item.images.length > 0 && (
                    <div className="pt-2 flex items-center gap-2">
                      {caseDetail.item.images.map((img: any) => (
                        <img
                          key={img.id}
                          src={getMediaUrl(img.image_url || img.image)}
                          alt="Case item"
                          className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                        />
                      ))}
                    </div>
                  )}
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

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {caseDetail.item.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => {
                        setArchiveTarget({
                          type: 'found',
                          id: caseDetail.item.public_id,
                          title: caseDetail.item.title || caseDetail.item.category
                        });
                        setInspectingCaseId(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Report
                    </button>
                  )}
                  <div className="flex-1" />
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

      {/* Section 12: Admin Archive / Removal Confirmation Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Archive &amp; Remove Report</h3>
              </div>
              <button
                onClick={() => { setArchiveTarget(null); setArchiveError(null); setArchiveReason(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              You are archiving the {archiveTarget.type} report for <strong className="text-slate-900 dark:text-white">{archiveTarget.title}</strong> ({archiveTarget.id.substring(0, 8)}).
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Soft-Deletion / Archive Policy:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Removes report from normal student catalog and active matching.</li>
                <li>Dismisses linked pending match candidates.</li>
                <li>Preserves custody logs and audit trail for institutional compliance.</li>
              </ul>
            </div>

            <form onSubmit={handleArchiveReport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Removal Reason <span className="text-red-500">*</span> (Recorded in Audit History)
                </label>
                <textarea
                  rows={3}
                  required
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. Duplicate report, invalid/spam entry, or disposed according to policy..."
                  className="w-full text-xs p-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                />
              </div>

              {archiveError && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {archiveError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setArchiveTarget(null); setArchiveError(null); setArchiveReason(''); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={archiveSubmitting || !archiveReason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {archiveSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Confirm Archive &amp; Remove
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Found Item Printable Custodial Tag Modal */}
      {printLabelItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between no-print border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Print Physical Tag</h3>
              </div>
              <button
                onClick={() => setPrintLabelItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clean Printable Sticker (No QR Code or Private Info) */}
            <FoundItemSticker
              foundId={printLabelItem.id}
              category={printLabelItem.category}
              showPrintButton={false}
            />

            {/* Print Controls */}
            <div className="flex items-center justify-end gap-2 pt-2 no-print">
              <button
                type="button"
                onClick={() => setPrintLabelItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard-level QR Scanner Modal */}
      <QrScannerModal
        isOpen={dashboardScannerOpen}
        onClose={() => setDashboardScannerOpen(false)}
        onScanSuccess={(foundId) => {
          setDashboardScannerOpen(false);
          setDashboardHandoverFoundId(foundId.trim().toUpperCase());
        }}
      />

      {/* Dashboard-level Custodian Handover Modal */}
      <CustodianHandoverModal
        foundId={dashboardHandoverFoundId}
        isOpen={!!dashboardHandoverFoundId}
        onClose={() => setDashboardHandoverFoundId(null)}
      />
    </div>
  );
};
