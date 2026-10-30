import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { AvailableItem } from '../types/recovery';
import { Search, ShieldAlert, CheckCircle2, PackageCheck, AlertCircle, Loader2, X, Tag, Lock, Calendar, Building } from 'lucide-react';

export const AvailableItemsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [building, setBuilding] = useState('all');
  const [floor, setFloor] = useState('all');
  const [riskTier, setRiskTier] = useState('all');
  const [date, setDate] = useState('');
  const [selectedItem, setSelectedItem] = useState<AvailableItem | null>(null);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Query available items catalog with real backend filters
  const { data: items = [], isLoading, isError } = useQuery<AvailableItem[]>({
    queryKey: ['available-items', search, category, building, floor, riskTier, date],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category && category !== 'all') params.append('category', category);
      if (building && building !== 'all') params.append('building', building);
      if (floor && floor !== 'all') params.append('floor', floor);
      if (riskTier && riskTier !== 'all') params.append('risk_tier', riskTier);
      if (date) params.append('date', date);
      const url = `/api/items/available-items/?${params.toString()}`;
      const res = await api.get<AvailableItem[] | { results: AvailableItem[] }>(url);
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  // Claim submission mutation
  const claimMutation = useMutation({
    mutationFn: async (payload: { found_item_id: string; student_answer: string }) => {
      return api.post('/api/pickup/claims/', payload);
    },
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['my-claims'] });
      setTimeout(() => {
        setSelectedItem(null);
        setSubmitSuccess(false);
        setStudentAnswer('');
        navigate('/recovery');
      }, 1500);
    },
    onError: (err: ApiError) => {
      setSubmitError(err.message || 'Failed to submit claim. Please try again.');
    },
  });

  const handleOpenClaim = (item: AvailableItem) => {
    setSelectedItem(item);
    setStudentAnswer('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !studentAnswer.trim()) return;
    setSubmitError(null);
    claimMutation.mutate({
      found_item_id: selectedItem.public_id,
      student_answer: studentAnswer.trim(),
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Found Items on Campus</h1>
            <p className="text-sm text-slate-600 mt-1">
              Browse items found across campus and secured at custodial desks. If an item belongs to you, verify ownership to initiate return.
            </p>
          </div>
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
            <ShieldAlert className="w-4 h-4 mr-1.5 text-blue-600" />
            Official Custodial Desk Hold
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by category, Found ID, or station building..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="all">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Bottles & Containers">Bottles & Containers</option>
            <option value="Stationery & Books">Stationery & Books</option>
            <option value="Keys & Badges">Keys & Badges</option>
            <option value="Vehicle Keys">Vehicle Keys</option>
            <option value="Clothing & Accessories">Clothing & Accessories</option>
            <option value="Wallet & Cards">Wallet & Cards</option>
            <option value="Bags & Luggage">Bags & Luggage</option>
            <option value="Jewellery & Watches">Jewellery & Watches</option>
          </select>

          <select
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="all">All Buildings</option>
            <option value="Main Administration">Main Administration</option>
            <option value="Central Library">Central Library</option>
            <option value="Academic Block A">Academic Block A</option>
            <option value="Academic Block B">Academic Block B</option>
            <option value="Sports Complex">Sports Complex</option>
          </select>

          <select
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="all">All Floors</option>
            <option value="Ground Floor">Ground Floor</option>
            <option value="1st Floor">1st Floor</option>
            <option value="2nd Floor">2nd Floor</option>
            <option value="3rd Floor">3rd Floor</option>
          </select>

          <select
            value={riskTier}
            onChange={(e) => setRiskTier(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="all">All Tiers (Risk)</option>
            <option value="0">General Items</option>
            <option value="1">Valuable Items (OTP)</option>
          </select>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            title="Filter by date found"
            className="px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
          />
        </div>
      </div>

      {/* Catalog Grid */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-2">Loading available catalog...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
          Failed to load available catalog. Please check your network connection.
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No items available</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no published found items matching your filter criteria held at custodial stations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.public_id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Found Category</span>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{item.category}</h3>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 shrink-0">
                    {item.public_id}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                    Available for verification
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      item.risk_tier === 1
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {item.risk_tier === 1 ? 'Valuable (OTP on Pickup)' : 'General Item'}
                  </span>
                </div>

                {/* Security Protection Notice: Photos & specific descriptions withheld */}
                <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
                    <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Details Protected</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Photos and identifying descriptions are withheld to prevent false claims. Verify ownership below to claim.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Found: <strong className="text-slate-700">{item.found_date ? new Date(item.found_date).toLocaleDateString() : 'Recent'}</strong></span>
                  </div>
                  {item.collection_location && (
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Holding Desk: <strong className="text-slate-700">{item.collection_location.station_code}</strong> ({item.collection_location.building})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleOpenClaim(item)}
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  This Might Be Mine (Verify Ownership)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Claim Submission Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900">Verify Ownership & Claim</h2>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900">Category: {selectedItem.category}</span>
                <span className="font-mono font-bold text-blue-950 bg-white px-2 py-0.5 rounded border border-blue-300">{selectedItem.public_id}</span>
              </div>
              <p className="text-[11px] text-blue-800">
                To prevent false claims, visual details are hidden. Describe your item specifically (e.g. brand, model, exact color, stickers, contents, or serial numbers) so campus staff can verify your claim.
              </p>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">Claim Submitted Successfully!</h3>
                <p className="text-xs text-slate-600">
                  Redirecting to your recovery status tracker...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitClaim} className="mt-4 space-y-4">
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 leading-relaxed">
                  <strong>Ownership Verification Prompt:</strong> Please describe unique marks, scratches, serial numbers, wallpaper details, or specific internal contents to verify ownership for custodial staff.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Verification Answer <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="e.g. Scratched on bottom right corner, blue sticker on back, contains 3 keys..."
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={claimMutation.isPending || !studentAnswer.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md shadow-xs transition-colors flex items-center"
                  >
                    {claimMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Submit Claim
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
