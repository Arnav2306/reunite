import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { LostItem, MatchItem } from '../types/recovery';
import {
  Search, Plus, Calendar, MapPin, Sparkles, Clock, CheckCircle2,
  Eye, ChevronRight, X, Loader2,
  FileText, RefreshCw
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  REPORTED: { label: 'Reported', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  MATCH_FOUND: { label: 'Possible Match', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  VERIFICATION_PENDING: { label: 'Under Review', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  HANDOVER: { label: 'Handover in Progress', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  RESOLVED: { label: 'Resolved', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export const MyLostItemsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<LostItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch real lost item reports of the authenticated student
  const { data: reports = [], isLoading, isError } = useQuery<LostItem[]>({
    queryKey: ['my-lost-reports'],
    queryFn: async () => {
      const res = await api.get<LostItem[] | { results: LostItem[] }>('/api/items/lost-items/');
      return Array.isArray(res) ? res : (res as { results: LostItem[] }).results || [];
    },
  });

  // Fetch matches for the selected report
  const { data: reportMatches = [], isLoading: isLoadingMatches } = useQuery<MatchItem[]>({
    queryKey: ['report-matches', selectedReport?.id],
    queryFn: async () => {
      if (!selectedReport) return [];
      const res = await api.get<MatchItem[] | { results: MatchItem[] }>(`/api/items/lost-items/${selectedReport.id}/matches/`);
      return Array.isArray(res) ? res : (res as { results: MatchItem[] }).results || [];
    },
    enabled: !!selectedReport,
  });

  // Re-run matching mutation
  const runMatchingMutation = useMutation({
    mutationFn: async (reportId: number) => {
      return api.post(`/api/items/lost-items/${reportId}/run-matching/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lost-reports'] });
      if (selectedReport) {
        queryClient.invalidateQueries({ queryKey: ['report-matches', selectedReport.id] });
      }
    },
  });

  // Filtering
  const filteredReports = reports.filter((report) => {
    const matchesCategory = categoryFilter === 'all' || report.category.toLowerCase() === categoryFilter.toLowerCase();
    const location = report.original_answers?.lost_location || '';
    const matchesSearch =
      !searchQuery ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.public_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = Array.from(new Set(reports.map((r) => r.category)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Lost Item Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track reported losses, view automated matching updates, and check recovery statuses.
          </p>
        </div>
        <Link
          to="/lost"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Report Lost Item
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search reports by keyword, category, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-2">Loading your loss reports...</p>
          </div>
        ) : isError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
            Failed to load reports. Please try refreshing the page.
          </div>
        ) : reports.length === 0 ? (
          /* Honest Empty State */
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto my-8 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">You haven't reported a lost item yet.</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              If you misplaced an item on campus, report it with key characteristics.
              Our automated matching system will cross-check newly found items deposited at campus collection points.
            </p>
            <div className="mt-6">
              <Link
                to="/lost"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Report Lost Item
              </Link>
            </div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
            No loss reports match your search query.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => {
              const statusCfg = STATUS_CONFIG[report.status] || {
                label: report.status,
                bg: 'bg-slate-100',
                text: 'text-slate-700',
                border: 'border-slate-200',
              };
              const lostLocation = report.original_answers?.lost_location || 'Campus premises';
              const lostDate = report.original_answers?.lost_date || new Date(report.created_at).toLocaleDateString();
              const hasMatches = (report.matches_count ?? 0) > 0 || report.status === 'MATCH_FOUND';

              return (
                <div
                  key={report.public_id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                        {report.category}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                        {statusCfg.label}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                      {report.description}
                    </h3>

                    <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Lost: <strong className="text-slate-700 font-medium">{lostLocation}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Approx. Date: <strong className="text-slate-700 font-medium">{lostDate}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>Report ID: <code className="font-mono text-slate-500">{report.public_id.slice(0, 8)}</code></span>
                      </div>
                    </div>

                    {/* Possible Match Banner */}
                    {hasMatches && (
                      <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-between text-xs text-purple-900">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>Candidate matches found</span>
                        </div>
                        <Link
                          to={`/matches`}
                          className="text-purple-700 hover:text-purple-900 font-bold underline text-[11px] flex items-center gap-0.5"
                        >
                          View <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-2xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      View Details & History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedReport(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800">
                  {selectedReport.category}
                </span>
                {(() => {
                  const cfg = STATUS_CONFIG[selectedReport.status] || {
                    label: selectedReport.status,
                    bg: 'bg-slate-100',
                    text: 'text-slate-700',
                    border: 'border-slate-300',
                  };
                  return (
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedReport.description}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Report Reference ID: {selectedReport.public_id}
              </p>
            </div>

            {/* Report Information Grid */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Loss Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-medium">Approximate Lost Location:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedReport.original_answers?.lost_location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Estimated Date:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedReport.original_answers?.lost_date || new Date(selectedReport.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Estimated Time:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedReport.original_answers?.lost_time || 'Not specified'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Report Filed On:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {new Date(selectedReport.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Normalized Attributes / Safe Answers */}
              {selectedReport.normalized_attributes && Object.keys(selectedReport.normalized_attributes).length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-slate-500 font-medium block mb-2">Item Characteristics:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedReport.normalized_attributes).map(([k, v]) => (
                      <div key={k} className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">{k.replace('_', ' ')}</span>
                        <span className="font-medium text-slate-800">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Candidate Matches Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Candidate Matches ({reportMatches.length})
                </h4>
                <button
                  onClick={() => runMatchingMutation.mutate(selectedReport.id)}
                  disabled={runMatchingMutation.isPending}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runMatchingMutation.isPending ? 'animate-spin' : ''}`} />
                  Check for New Matches
                </button>
              </div>

              {isLoadingMatches ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading matches...</div>
              ) : reportMatches.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  No candidate matches found yet. We automatically compare against new found items when deposited.
                </div>
              ) : (
                <div className="space-y-2">
                  {reportMatches.map((m) => (
                    <div
                      key={m.public_id}
                      className="p-3 bg-white border border-purple-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-900">{m.score}/100</span>
                          <span className="font-semibold text-slate-700">— {m.label}</span>
                        </div>
                        <p className="text-slate-600 font-medium">{m.found_item.title || m.found_item.description}</p>
                        <p className="text-[11px] text-slate-400">
                          Found at: {m.found_item.found_location || 'Campus'}
                        </p>
                      </div>
                      <Link
                        to="/matches"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition-colors shrink-0"
                      >
                        Inspect Match
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Report Timeline</h4>
              <div className="flex items-center gap-3 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Loss report recorded on {new Date(selectedReport.created_at).toLocaleDateString()}</span>
              </div>
              {selectedReport.status === 'MATCH_FOUND' && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Potential match identified and pending review</span>
                </div>
              )}
              {selectedReport.status === 'READY_FOR_PICKUP' && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Item verified and ready for physical pickup at holding desk</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
