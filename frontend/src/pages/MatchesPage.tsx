import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, getMediaUrl } from '../services/api';
import type { MatchItem, LostItem } from '../types/recovery';
import {
  Sparkles, CheckCircle2, AlertCircle, ShieldAlert,
  Eye, MapPin, Building, X, Loader2,
  FileQuestion, ChevronRight
} from 'lucide-react';

export const MatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State for claiming an item from match
  const [claimingMatch, setClaimingMatch] = useState<MatchItem | null>(null);
  const [inspectingMatch, setInspectingMatch] = useState<MatchItem | null>(null);
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<boolean>(false);

  // Fetch student's real matches from the backend
  const { data: matches = [], isLoading, isError } = useQuery<MatchItem[]>({
    queryKey: ['my-matches'],
    queryFn: async () => {
      const res = await api.get<MatchItem[] | { results: MatchItem[] }>('/api/items/matches/');
      return Array.isArray(res) ? res : (res as { results: MatchItem[] }).results || [];
    },
  });

  // Fetch student's lost reports to check if user has reports
  const { data: reports = [] } = useQuery<LostItem[]>({
    queryKey: ['my-lost-reports'],
    queryFn: async () => {
      const res = await api.get<LostItem[] | { results: LostItem[] }>('/api/items/lost-items/');
      return Array.isArray(res) ? res : (res as { results: LostItem[] }).results || [];
    },
  });

  // Claim mutation reusing existing /api/pickup/claims/ endpoint
  const claimMutation = useMutation({
    mutationFn: async (payload: { found_item_id: string; student_answer: string }) => {
      return api.post('/api/pickup/claims/', payload);
    },
    onSuccess: () => {
      setClaimSuccess(true);
      setClaimError(null);
      queryClient.invalidateQueries({ queryKey: ['my-claims'] });
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
      setTimeout(() => {
        setClaimingMatch(null);
        setClaimSuccess(false);
        setStudentAnswer('');
        navigate('/recovery');
      }, 1500);
    },
    onError: (err: ApiError) => {
      setClaimError(err.message || 'Failed to submit ownership claim. Please try again.');
    },
  });

  // Dismiss match mutation
  const dismissMutation = useMutation({
    mutationFn: async (matchId: number) => {
      return api.post(`/api/items/matches/${matchId}/dismiss/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-matches'] });
    },
  });

  const handleStartClaim = (match: MatchItem) => {
    setClaimingMatch(match);
    setStudentAnswer('');
    setClaimError(null);
    setClaimSuccess(false);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentAnswer.trim()) {
      setClaimError('Please provide details to verify your ownership.');
      return;
    }
    if (!claimingMatch) return;
    claimMutation.mutate({
      found_item_id: claimingMatch.found_item.public_id,
      student_answer: studentAnswer,
    });
  };

  // Group matches by lost report
  const activeMatches = matches.filter((m) => m.status !== 'DISMISSED');
  const groupedMatches: Record<string, { reportTitle: string; reportCategory: string; matches: MatchItem[] }> = {};

  activeMatches.forEach((m) => {
    const key = m.lost_item_public_id || `lost-${m.lost_item_id}`;
    if (!groupedMatches[key]) {
      groupedMatches[key] = {
        reportTitle: m.lost_item_description,
        reportCategory: m.lost_item_category,
        matches: [],
      };
    }
    groupedMatches[key].matches.push(m);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Possible Matches</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              Deterministic v1 Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Automated correlation between your loss reports and found items securely stored at campus holding desks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/reports"
            className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            My Reports
          </Link>
          <Link
            to="/lost"
            className="inline-flex items-center px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            Report Another Item
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-2">Checking for candidate matches...</p>
          </div>
        ) : isError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
            Failed to load matches. Please check your network connection.
          </div>
        ) : reports.length === 0 ? (
          /* User has not filed any reports yet */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">No active loss reports</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              You haven't filed any loss reports yet. File a report first, and Reunite will automatically correlate candidate matches against physical items in campus custody.
            </p>
            <div className="mt-6">
              <Link
                to="/lost"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                Report Lost Item
              </Link>
            </div>
          </div>
        ) : Object.keys(groupedMatches).length === 0 ? (
          /* Honest Empty State: Reports exist, but no matches yet */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">No possible matches yet.</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                We'll continue checking newly reported found items as they are deposited and cataloged at campus collection desks.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 text-left space-y-2">
              <div className="font-semibold text-slate-800">How Matching Works:</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-500">
                <li>Attribute & semantic similarity across categories</li>
                <li>Campus location correlation</li>
                <li>Found date vs estimated loss date</li>
                <li>Distinctive marks and specific characteristics</li>
              </ul>
            </div>
            <div className="pt-2">
              <Link
                to="/available"
                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Browse Public Available Catalog <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedMatches).map(([reportKey, group]) => (
              <div key={reportKey} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                {/* Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Matches For Your Report
                    </span>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs">
                        {group.reportCategory}
                      </span>
                      {group.reportTitle}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 self-start sm:self-auto">
                    {group.matches.length} {group.matches.length === 1 ? 'candidate' : 'candidates'}
                  </span>
                </div>

                {/* Match Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.matches.map((match) => {
                    const found = match.found_item;
                    const isStrong = match.score >= 85;
                    const isMedium = match.score >= 65 && match.score < 85;
                    const badgeBg = isStrong
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : isMedium
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-slate-100 text-slate-700 border-slate-200';

                    const primaryImage = found.images && found.images.length > 0
                      ? getMediaUrl(found.images[0].image_url || found.images[0].image)
                      : null;

                    return (
                      <div
                        key={match.public_id}
                        className="bg-slate-50/60 border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-purple-300 transition-all space-y-4"
                      >
                        <div className="space-y-3">
                          {/* Score & Strength */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${badgeBg}`}>
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              {match.score}/100 — {match.label}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              alg: {match.matching_algorithm_version}
                            </span>
                          </div>

                          {/* Image preview if available */}
                          {primaryImage && (
                            <img
                              src={primaryImage}
                              alt={found.title || found.category}
                              className="w-full h-40 object-cover rounded-lg border border-slate-200"
                            />
                          )}

                          {/* Found item details */}
                          <div>
                            <h3 className="font-bold text-slate-900 text-base leading-snug">
                              {found.title || found.category}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {found.description}
                            </p>
                          </div>

                          {/* Location & Holding Station */}
                          <div className="text-xs space-y-1 pt-2 border-t border-slate-200 text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Found at: <strong className="text-slate-700">{found.found_location || 'Campus premises'}</strong></span>
                            </div>
                            {found.collection_location && (
                              <div className="flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  Holding Desk: <strong className="text-slate-700">{found.collection_location.station_code}</strong> ({found.collection_location.building})
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Why we think this may match preview */}
                          <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg text-xs space-y-1">
                            <p className="font-semibold text-purple-900 text-[11px] uppercase tracking-wide">Why we think this may match:</p>
                            <ul className="space-y-0.5 text-purple-800 text-[11px]">
                              {(!match.score_breakdown || (match.score_breakdown.category_score ?? 0) >= 60) && (
                                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-purple-600 shrink-0" /> Same category</li>
                              )}
                              {(!match.score_breakdown || (match.score_breakdown.attribute_score ?? 0) >= 40) && (
                                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-purple-600 shrink-0" /> Similar attributes &amp; color</li>
                              )}
                              {(!match.score_breakdown || (match.score_breakdown.location_score ?? 0) >= 50) && (
                                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-purple-600 shrink-0" /> Nearby campus location</li>
                              )}
                              {(!match.score_breakdown || (match.score_breakdown.time_score ?? 0) >= 50) && (
                                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-purple-600 shrink-0" /> Similar time window</li>
                              )}
                            </ul>
                            <p className="text-[10px] text-purple-700 font-medium italic pt-1 border-t border-purple-200">
                              AI-assisted match — ownership still needs verification.
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
                          <button
                            onClick={() => setInspectingMatch(match)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                            View Details
                          </button>
                          <button
                            onClick={() => handleStartClaim(match)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                          >
                            This Might Be Mine
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Details & Score Breakdown Modal */}
      {inspectingMatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setInspectingMatch(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Match Inspection
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-2">
                {inspectingMatch.found_item.title || inspectingMatch.found_item.category}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-purple-900 text-sm">
                  {inspectingMatch.score} / 100 — {inspectingMatch.label}
                </span>
              </div>
            </div>

            {/* Found Item Public Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Safe Public Description</h4>
              <p className="text-slate-600 leading-relaxed">{inspectingMatch.found_item.description}</p>
              <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-500">
                <div><span className="font-medium text-slate-700">Found Location:</span> {inspectingMatch.found_item.found_location || 'Campus'}</div>
                <div><span className="font-medium text-slate-700">Found Date:</span> {inspectingMatch.found_item.found_date || 'Recent'}</div>
                {inspectingMatch.found_item.collection_location && (
                  <div>
                    <span className="font-medium text-slate-700">Holding Desk:</span> {inspectingMatch.found_item.collection_location.station_code} ({inspectingMatch.found_item.collection_location.building})
                  </div>
                )}
              </div>
            </div>

            {/* Why we think this may match */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
              <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-[11px]">Why we think this may match:</h4>
              <ul className="space-y-1.5 text-emerald-800">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Same category ({inspectingMatch.found_item.category})</span>
                </li>
                {(!inspectingMatch.score_breakdown || (inspectingMatch.score_breakdown.attribute_score ?? 0) >= 30) && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Similar attributes &amp; color</span>
                  </li>
                )}
                {(!inspectingMatch.score_breakdown || (inspectingMatch.score_breakdown.location_score ?? 0) >= 40) && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Nearby campus location ({inspectingMatch.found_item.found_location || 'Campus'})</span>
                  </li>
                )}
                {(!inspectingMatch.score_breakdown || (inspectingMatch.score_breakdown.time_score ?? 0) >= 40) && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Similar time frame</span>
                  </li>
                )}
                {inspectingMatch.score_breakdown?.photo_score ? (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Similar visual appearance</span>
                  </li>
                ) : null}
              </ul>
            </div>

            {/* Mandatory AI Verification Disclaimer */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">AI-assisted match — ownership still needs verification.</p>
                <p className="text-amber-800 mt-0.5">
                  AI correlation does not prove ownership. You must provide identifying details or private facts to claim the item.
                </p>
              </div>
            </div>

            {/* Score Breakdown Transparency */}
            {inspectingMatch.score_breakdown && (
              <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4 text-xs space-y-2">
                <h4 className="font-bold text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Deterministic Score Breakdown
                </h4>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span>Category Match (weight: 20%):</span>
                    <strong className="font-mono">{inspectingMatch.score_breakdown.category_score}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Attribute & Text Similarity (weight: 40%):</span>
                    <strong className="font-mono">{inspectingMatch.score_breakdown.attribute_score}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Location Signal (weight: 15%):</span>
                    <strong className="font-mono">{inspectingMatch.score_breakdown.location_score}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Date / Time Signal (weight: 10%):</span>
                    <strong className="font-mono">{inspectingMatch.score_breakdown.time_score}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Distinguishing Features (weight: 10%):</span>
                    <strong className="font-mono">{inspectingMatch.score_breakdown.feature_score}%</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Photo Similarity:</span>
                    <em>Not calculated (normalized)</em>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  dismissMutation.mutate(inspectingMatch.id);
                  setInspectingMatch(null);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
              >
                Not my item (Dismiss)
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectingMatch(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const match = inspectingMatch;
                    setInspectingMatch(null);
                    handleStartClaim(match);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                >
                  This Might Be Mine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim Initiation Modal (Reusing existing Ownership Verification Workflow) */}
      {claimingMatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 relative">
            <button
              onClick={() => { setClaimingMatch(null); setClaimError(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Step: Ownership Verification
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-2">
                Claim: {claimingMatch.found_item.title || claimingMatch.found_item.category}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Holding desk: {claimingMatch.found_item.collection_location?.station_code || 'Campus Custody'}
              </p>
            </div>

            {claimSuccess ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-sm font-bold text-emerald-900">Claim Lodged Successfully</h3>
                <p className="text-xs text-emerald-700">
                  Redirecting to your Recovery page to track custodian verification and pickup status...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitClaim} className="space-y-4">
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                    Custodial Verification Required
                  </div>
                  <p className="text-blue-800 leading-relaxed">
                    To prevent unauthorized claims, describe private identifying traits known only to the true owner (e.g. wallpaper, case mark, scratches, specific contents, or keychain details).
                  </p>
                </div>

                {claimError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{claimError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="student-answer-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Your Ownership Verification Answer *
                  </label>
                  <textarea
                    id="student-answer-input"
                    rows={4}
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    placeholder="Provide specific identifying characteristics that prove this item belongs to you..."
                    className="w-full p-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This answer is encrypted and reviewed only by the authorized campus custodian.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setClaimingMatch(null); setClaimError(null); }}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={claimMutation.isPending}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                  >
                    {claimMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Submitting Claim...
                      </>
                    ) : (
                      'Submit Claim for Review'
                    )}
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
