import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError, apiRequest } from '../services/api';
import {
  Upload, X, Sparkles, Loader2, CheckCircle2, AlertCircle,
  ImageIcon, Lock, Eye, ChevronDown, Save, Globe
} from 'lucide-react';

interface CollectionPoint {
  id: number;
  public_id: string;
  station_code: string;
  building: string;
  floor: string;
  station_type: string;
  status: string;
  zone: string;
}

interface AISuggestion {
  suggested_title?: string;
  suggested_category?: string;
  object_type?: string;
  apparent_color?: string;
  visible_brand?: string;
  visible_characteristics?: string;
  safe_description?: string;
  risk_tier?: number;
  confidence?: string;
}

interface AIAnalysisResult {
  available: boolean;
  detail: string;
  suggestion: AISuggestion | null;
}

const CATEGORIES = [
  'Electronics',
  'Bottles & Containers',
  'Stationery & Books',
  'Keys & Badges',
  'Clothing & Accessories',
  'Wallet & Cards',
  'Bags & Luggage',
  'Jewellery & Watches',
  'Sports & Fitness',
  'Documents & ID',
  'Other',
];

const RISK_TIERS = [
  { value: 0, label: 'General Item', description: 'Low-risk item (bottle, book, keys, etc.)' },
  { value: 1, label: 'Valuable Item', description: 'High-risk item (phone, laptop, wallet, ID, etc.)' },
];

export const RegisterFoundItemPage: React.FC = () => {
  const navigate = useNavigate();

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI analysis state
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  // Form state - public fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [foundDate, setFoundDate] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [riskTier, setRiskTier] = useState(0);
  const [collectionPointId, setCollectionPointId] = useState('');

  // Form state - private fields
  const [serialNumber, setSerialNumber] = useState('');
  const [imei, setImei] = useState('');
  const [identifyingMarks, setIdentifyingMarks] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [secretVerificationInfo, setSecretVerificationInfo] = useState('');
  const [showPrivate, setShowPrivate] = useState(true);

  // Submission state
  const [formError, setFormError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Load collection points
  const { data: collectionPoints = [] } = useQuery<CollectionPoint[]>({
    queryKey: ['collection-points'],
    queryFn: async () => {
      const res = await api.get<CollectionPoint[] | { results: CollectionPoint[] }>('/api/collection-points/');
      return Array.isArray(res) ? res : (res as { results: CollectionPoint[] }).results || [];
    },
  });

  // Handle image selection
  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setAiResult(null);
    setAiApplied(false);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageSelect(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  // AI analysis
  const handleAnalyzeImage = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setAiResult(null);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const result = await apiRequest<AIAnalysisResult>('/api/items/analyze-image/', {
        method: 'POST',
        body: formData,
        headers: {},  // Let browser set multipart Content-Type
      });
      setAiResult(result);
    } catch (err) {
      setAiResult({
        available: false,
        detail: err instanceof Error ? err.message : 'Analysis failed.',
        suggestion: null,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiResult?.suggestion) return;
    const s = aiResult.suggestion;
    if (s.suggested_title && !title) setTitle(s.suggested_title);
    if (s.suggested_category) {
      // Map AI suggestion to category list
      const matched = CATEGORIES.find(c =>
        c.toLowerCase().includes((s.suggested_category || '').toLowerCase()) ||
        (s.suggested_category || '').toLowerCase().includes(c.toLowerCase().split(' ')[0])
      );
      if (matched && !category) setCategory(matched);
    }
    if (s.safe_description && !description) setDescription(s.safe_description);
    if (s.risk_tier !== undefined) setRiskTier(s.risk_tier);
    setAiApplied(true);
  };

  // Save draft mutation
  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('found_location', foundLocation);
      formData.append('found_date', foundDate);
      formData.append('risk_tier', String(riskTier));
      if (collectionPointId) formData.append('collection_point', collectionPointId);
      if (serialNumber) formData.append('serial_number', serialNumber);
      if (imei) formData.append('imei', imei);
      if (identifyingMarks) formData.append('identifying_marks', identifyingMarks);
      if (internalNotes) formData.append('internal_notes', internalNotes);
      if (secretVerificationInfo) formData.append('secret_verification_info', secretVerificationInfo);
      if (imageFile) formData.append('image', imageFile);

      const item = await apiRequest<{ id: number; public_id: string }>('/api/items/found-items/', {
        method: 'POST',
        body: formData,
        headers: {},
      });

      if (publish) {
        await api.post(`/api/items/found-items/${item.id}/publish/`);
      }
      return item;
    },
    onSuccess: (item) => {
      setSuccessId(item.public_id);
      setFormError(null);
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to save item. Please check all required fields.');
    },
  });

  const handleSubmit = (publish: boolean) => {
    setFormError(null);
    if (!title.trim()) { setFormError('Title is required.'); return; }
    if (!category) { setFormError('Category is required.'); return; }
    if (!description.trim()) { setFormError('Description is required.'); return; }
    saveMutation.mutate(publish);
  };

  if (successId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-10 shadow-xs space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Item Registered Successfully</h1>
          <p className="text-sm text-slate-600">
            The found item has been saved. Students can now find it in the Available Items catalog (if published).
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/available')}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              View Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900">Register Found Item</h1>
        <p className="text-sm text-slate-600 mt-1">
          Log a new found item submitted to the HOD Cabin or custodial station. Upload a photo for AI-assisted description, then review and save.
        </p>
      </div>

      {/* Error Banner */}
      {formError && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Image Upload + AI */}
        <div className="space-y-4">
          {/* Image Upload */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-500" />
              Item Photo
            </h2>

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Item preview"
                  className="w-full h-48 object-cover rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); setAiResult(null); setAiApplied(false); }}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow border border-slate-200 text-slate-500 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors text-center px-4"
              >
                <Upload className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">Drop image here or click to browse</p>
                <p className="text-[11px] text-slate-400 mt-1">JPG, PNG, WEBP up to 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {imageFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Replace Image
              </button>
            )}
          </div>

          {/* AI Analysis */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              AI Description
            </h2>

            {!imageFile ? (
              <p className="text-xs text-slate-500">Upload an image first to enable AI analysis.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAnalyzeImage}
                  disabled={isAnalyzing}
                  className="w-full py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-md flex items-center justify-center gap-2 transition-colors"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Analyze with AI</>
                  )}
                </button>

                {aiResult && (
                  <div className={`rounded-lg border p-3 text-xs space-y-2 ${
                    aiResult.available && aiResult.suggestion
                      ? 'bg-violet-50 border-violet-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    {aiResult.available && aiResult.suggestion ? (
                      <>
                        <p className="font-semibold text-violet-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> AI Suggestion Ready
                        </p>
                        <div className="space-y-1 text-slate-700">
                          {aiResult.suggestion.suggested_title && (
                            <div><span className="font-medium">Title:</span> {aiResult.suggestion.suggested_title}</div>
                          )}
                          {aiResult.suggestion.suggested_category && (
                            <div><span className="font-medium">Category:</span> {aiResult.suggestion.suggested_category}</div>
                          )}
                          {aiResult.suggestion.safe_description && (
                            <div><span className="font-medium">Description:</span> {aiResult.suggestion.safe_description}</div>
                          )}
                          {aiResult.suggestion.risk_tier !== undefined && (
                            <div><span className="font-medium">Risk:</span> {aiResult.suggestion.risk_tier === 1 ? 'Valuable' : 'General'}</div>
                          )}
                          {aiResult.suggestion.confidence && (
                            <div><span className="font-medium">Confidence:</span> {aiResult.suggestion.confidence}</div>
                          )}
                        </div>
                        <p className="text-[11px] text-violet-700 italic">Review before applying. AI suggestions are not definitive.</p>
                        {!aiApplied ? (
                          <button
                            type="button"
                            onClick={applyAISuggestion}
                            className="w-full py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors"
                          >
                            Apply Suggestion
                          </button>
                        ) : (
                          <p className="text-center text-xs font-semibold text-violet-700">✓ Suggestion applied</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-amber-800">AI analysis unavailable</p>
                        <p className="text-amber-700">{aiResult.detail}</p>
                        <p className="text-amber-700 italic">Please enter the description manually below.</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Form fields */}
        <div className="lg:col-span-2 space-y-4">
          {/* Public Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              Public Details
              <span className="text-[11px] font-normal text-slate-400">(Visible to students)</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Blue Water Bottle, Black iPhone 15 Pro"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-8"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Risk Tier</label>
                <div className="relative">
                  <select
                    value={riskTier}
                    onChange={(e) => setRiskTier(Number(e.target.value))}
                    className="w-full appearance-none px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-8"
                  >
                    {RISK_TIERS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Safe Description <span className="text-red-500">*</span>
                <span className="text-[11px] font-normal text-slate-400 ml-2">Only describe visible, general attributes</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. A dark blue metal water bottle with a white cap found in the canteen area..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Found Location</label>
                <input
                  type="text"
                  value={foundLocation}
                  onChange={(e) => setFoundLocation(e.target.value)}
                  placeholder="e.g. Library Reading Room 2"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Received Date</label>
                <input
                  type="date"
                  value={foundDate}
                  onChange={(e) => setFoundDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Collection / HOD Cabin Location
              </label>
              <div className="relative">
                <select
                  value={collectionPointId}
                  onChange={(e) => setCollectionPointId(e.target.value)}
                  className="w-full appearance-none px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-8"
                >
                  <option value="">Select collection point</option>
                  {collectionPoints.map(cp => (
                    <option key={cp.id} value={String(cp.id)}>
                      {cp.station_code} — {cp.building}{cp.floor ? `, ${cp.floor}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Private / Verification Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <button
              type="button"
              onClick={() => setShowPrivate(v => !v)}
              className="w-full flex items-center justify-between text-sm font-bold text-slate-900 hover:text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-500" />
                Private Verification Details
                <span className="text-[11px] font-normal text-slate-400">(Staff only — not visible to students)</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPrivate ? 'rotate-180' : ''}`} />
            </button>

            {showPrivate && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                  <span>These fields are <strong>never exposed to students</strong>. They are used for ownership verification and audit purposes only.</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="If visible on device"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">IMEI (if phone)</label>
                    <input
                      type="text"
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      placeholder="From SIM tray or settings"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Secret Verification Info</label>
                  <textarea
                    rows={2}
                    value={secretVerificationInfo}
                    onChange={(e) => setSecretVerificationInfo(e.target.value)}
                    placeholder="e.g. Lock screen wallpaper description, case sticker, etc."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Identifying Marks</label>
                  <input
                    type="text"
                    value={identifyingMarks}
                    onChange={(e) => setIdentifyingMarks(e.target.value)}
                    placeholder="Scratches, dents, stickers, engravings..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="e.g. Handed over by security guard at gate 2..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-end">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                Save &amp; Publish
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 text-right">
              Draft items are not visible to students. Publish when ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
