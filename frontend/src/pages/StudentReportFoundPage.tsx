import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiRequest, ApiError } from '../services/api';
import {
  Camera, Upload, X, Loader2, CheckCircle2, AlertCircle,
  ArrowLeft, ArrowRight, MapPin, Edit3, ChevronDown,
  Info, Package
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

// Steps: 0=Photo, 1=AI Analysis, 2=Review & Correct, 3=Station, 4=Confirm
const STEPS = [
  { id: 0, label: 'Photo', short: 'Photo' },
  { id: 1, label: 'AI Analysis', short: 'Scan' },
  { id: 2, label: 'Review Details', short: 'Review' },
  { id: 3, label: 'Drop-off Station', short: 'Station' },
  { id: 4, label: 'Submit', short: 'Submit' },
];

export const StudentReportFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stationParam = searchParams.get('station');

  // --- Step state ---
  const [step, setStep] = useState(0);

  // --- Step 0: Photo ---
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Step 1: AI ---
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSkipped, setAiSkipped] = useState(false);

  // --- Step 2: Review/Edit form ---
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [foundDate, setFoundDate] = useState(new Date().toISOString().split('T')[0]);
  const [riskTier, setRiskTier] = useState(0);

  // Track which fields were AI-suggested vs user-edited
  const [aiSuggestedFields, setAiSuggestedFields] = useState<Set<string>>(new Set());

  // --- Step 3: Station & Cannot-Carry Mode ---
  const [collectionPointId, setCollectionPointId] = useState('');
  const [cannotCarry, setCannotCarry] = useState(false);
  const [cannotCarryDetails, setCannotCarryDetails] = useState('');

  // --- Submission ---
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

  // Pre-select station if provided in URL parameter (e.g. from QR scan)
  useEffect(() => {
    if (stationParam && collectionPoints.length > 0) {
      const match = collectionPoints.find(
        cp => cp.station_code.toLowerCase() === stationParam.toLowerCase() || String(cp.id) === stationParam
      );
      if (match) {
        setCollectionPointId(String(match.id));
      }
    }
  }, [stationParam, collectionPoints]);

  // Handle image selection
  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setAiResult(null);
    setAiSkipped(false);
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
        headers: {},
      });
      setAiResult(result);

      // Auto-populate form fields from AI suggestion
      if (result.available && result.suggestion) {
        const s = result.suggestion;
        const suggestedFields = new Set<string>();

        if (s.suggested_title) { setTitle(s.suggested_title); suggestedFields.add('title'); }
        if (s.suggested_category) {
          const matched = CATEGORIES.find(c =>
            c.toLowerCase().includes((s.suggested_category || '').toLowerCase()) ||
            (s.suggested_category || '').toLowerCase().includes(c.toLowerCase().split(' ')[0])
          );
          if (matched) { setCategory(matched); suggestedFields.add('category'); }
        }
        if (s.safe_description) { setDescription(s.safe_description); suggestedFields.add('description'); }
        if (s.risk_tier !== undefined) { setRiskTier(s.risk_tier); suggestedFields.add('riskTier'); }
        setAiSuggestedFields(suggestedFields);
      }
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

  const handleSkipAI = () => {
    setAiSkipped(true);
    setStep(2);
  };

  // Submit found item
  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('found_location', foundLocation);
      formData.append('found_date', foundDate);
      formData.append('risk_tier', String(riskTier));
      formData.append('cannot_carry', cannotCarry ? 'true' : 'false');
      if (cannotCarry && cannotCarryDetails) {
        formData.append('cannot_carry_details', cannotCarryDetails);
      }
      if (!cannotCarry && collectionPointId) {
        formData.append('collection_point', collectionPointId);
      }
      if (imageFile) formData.append('image', imageFile);

      const item = await apiRequest<{ id: number; public_id: string }>('/api/items/student-found/', {
        method: 'POST',
        body: formData,
        headers: {},
      });
      return item;
    },
    onSuccess: (item) => {
      setSuccessId(item.public_id);
      setFormError(null);
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to submit report. Please try again.');
    },
  });

  const canProceedFromStep = (s: number): boolean => {
    if (s === 0) return !!imageFile;
    if (s === 1) return !!aiResult || aiSkipped;
    if (s === 2) return !!title.trim() && !!category && !!description.trim();
    if (s === 3) return true; // Station selection is optional — student may not know
    return true;
  };

  const goNext = () => {
    setFormError(null);
    if (!canProceedFromStep(step)) {
      if (step === 0) setFormError('Please upload or take a photo of the found item.');
      if (step === 2) setFormError('Please fill in the item title, category, and description.');
      return;
    }

    if (step === 1 && aiResult && !aiSkipped) {
      // AI done, go to review
      setStep(2);
    } else if (step === 4) {
      submitMutation.mutate();
    } else {
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    setFormError(null);
    if (step === 0) { navigate('/dashboard'); return; }
    if (step === 2 && aiSkipped) { setStep(0); return; }
    setStep(s => s - 1);
  };

  const selectedStation = collectionPoints.find(cp => String(cp.id) === collectionPointId);

  // ─── Success Screen ──────────────────────────────────────────────────────
  if (successId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Thank you for reporting!</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your found item report has been submitted. A campus custodian will review it and list it
            in the Found Items catalog so the owner can claim it.
          </p>
          {selectedStation && (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-left">
              <p className="text-xs font-semibold text-teal-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Please deposit the item at:
              </p>
              <p className="text-sm font-bold text-teal-900">{selectedStation.building}{selectedStation.floor ? ` — ${selectedStation.floor}` : ''}</p>
              <p className="text-xs text-teal-700 mt-0.5">{selectedStation.station_code}</p>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/found-items')}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Browse Found Items
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step Indicator ──────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-6">
      {STEPS.map((s, idx) => (
        <React.Fragment key={s.id}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              idx < step
                ? 'bg-teal-500 text-white'
                : idx === step
                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              {idx < step ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium hidden sm:block ${idx === step ? 'text-blue-700' : idx < step ? 'text-teal-600' : 'text-slate-400'}`}>
              {s.short}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mt-[-10px] transition-colors ${idx < step ? 'bg-teal-400' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <button onClick={() => navigate('/dashboard')} className="hover:text-slate-800 transition-colors">Dashboard</button>
          <span>/</span>
          <span className="text-slate-700 font-medium">Report Found Item</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">I Found Something</h1>
        <p className="text-sm text-slate-500 mt-1">
          Take a photo and let Reunite's AI identify the item for you.
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator />

      {/* Error Banner */}
      {formError && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <span>{formError}</span>
        </div>
      )}

      {/* ── STEP 0: PHOTO ────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Take a clear photo of the item</h2>
            <p className="text-sm text-slate-500 mt-1">
              Reunite's AI will identify the item and create the description for you.
              No typing needed.
            </p>
          </div>

          {imagePreview ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img
                  src={imagePreview}
                  alt="Found item"
                  className="w-full max-h-72 object-contain bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); setAiResult(null); }}
                  className="absolute top-3 right-3 p-1.5 bg-white rounded-full shadow border border-slate-200 text-slate-500 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" /> Replace Photo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center min-h-64 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors text-center px-6 py-8 group"
              >
                <div className="w-14 h-14 rounded-full bg-slate-100 group-hover:bg-blue-50 border border-slate-200 flex items-center justify-center mb-4 transition-colors">
                  <Camera className="w-7 h-7 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="text-base font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">
                  Tap to upload a photo
                </p>
                <p className="text-sm text-slate-500 mt-1">or drag and drop an image here</p>
                <p className="text-xs text-slate-400 mt-3">JPG, PNG, WEBP — up to 10MB</p>
              </div>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full py-3 text-sm font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Take Photo with Camera
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

          {/* Tips */}
          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Tips for a good photo
            </p>
            <ul className="text-xs text-blue-700 space-y-0.5">
              <li>• Place item on a flat surface with good lighting</li>
              <li>• Capture the whole item including any visible labels</li>
              <li>• Avoid blurry or dark photos</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 1: AI ANALYSIS ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">AI is analyzing your photo…</h2>
            <p className="text-sm text-slate-500 mt-1">
              Reunite will identify the item and fill in the details for you.
            </p>
          </div>

          {/* Photo thumbnail */}
          {imagePreview && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <img src={imagePreview} alt="Item" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Your photo</p>
                <p className="text-xs text-slate-500">{imageFile?.name}</p>
              </div>
            </div>
          )}

          {/* AI Analyze Button */}
          {!aiResult && !isAnalyzing && (
            <button
              type="button"
              onClick={handleAnalyzeImage}
              className="w-full py-3.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Package className="w-4 h-4" />
              Analyze with AI
            </button>
          )}

          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-slate-700">AI is analyzing your photo…</p>
              <p className="text-xs text-slate-500">This usually takes a few seconds</p>
            </div>
          )}

          {/* AI Result */}
          {aiResult && !isAnalyzing && (
            <div className={`rounded-xl border p-4 space-y-3 ${
              aiResult.available && aiResult.suggestion
                ? 'bg-teal-50 border-teal-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              {aiResult.available && aiResult.suggestion ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <p className="text-sm font-semibold text-teal-800">Here's what Reunite detected</p>
                    {aiResult.suggestion.confidence && (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${
                        aiResult.suggestion.confidence === 'high'
                          ? 'bg-teal-100 text-teal-700'
                          : aiResult.suggestion.confidence === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {aiResult.suggestion.confidence} confidence
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {aiResult.suggestion.suggested_title && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-teal-800 min-w-24">Item:</span>
                        <span className="text-teal-900">{aiResult.suggestion.suggested_title}</span>
                      </div>
                    )}
                    {aiResult.suggestion.apparent_color && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-teal-800 min-w-24">Color:</span>
                        <span className="text-teal-900">{aiResult.suggestion.apparent_color}</span>
                      </div>
                    )}
                    {aiResult.suggestion.visible_brand && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-teal-800 min-w-24">Brand:</span>
                        <span className="text-teal-900">{aiResult.suggestion.visible_brand}</span>
                      </div>
                    )}
                    {aiResult.suggestion.suggested_category && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-teal-800 min-w-24">Category:</span>
                        <span className="text-teal-900">{aiResult.suggestion.suggested_category}</span>
                      </div>
                    )}
                    {aiResult.suggestion.visible_characteristics && (
                      <div className="flex gap-2">
                        <span className="font-semibold text-teal-800 min-w-24 shrink-0">Features:</span>
                        <span className="text-teal-900">{aiResult.suggestion.visible_characteristics}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-teal-700 italic pt-1 border-t border-teal-200">
                    You can review and correct these details in the next step.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-800">AI analysis unavailable</p>
                  <p className="text-sm text-amber-700">{aiResult.detail || 'AI analysis is currently unavailable. Your report has been saved and can still be reviewed.'}</p>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAnalyzeImage}
                      className="px-3.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors"
                    >
                      Retry AI Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors"
                    >
                      Continue to Manual Review →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Skip AI option */}
          {!isAnalyzing && !aiResult && (
            <button
              type="button"
              onClick={handleSkipAI}
              className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Skip AI — describe manually
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2: REVIEW & CORRECT ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {aiResult?.available ? "Review the detected details" : "Describe the found item"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {aiResult?.available
                ? "We've filled in what we detected. Please correct anything that looks wrong."
                : "Tell us a little about the item you found."}
            </p>
          </div>

          {/* Image thumbnail */}
          {imagePreview && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <img src={imagePreview} alt="Item" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
              <div className="text-xs text-slate-500">Your photo</div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Item Name <span className="text-red-500">*</span>
              {aiSuggestedFields.has('title') && (
                <span className="ml-2 text-xs font-normal text-teal-600 flex items-center gap-1 inline-flex">
                  <Package className="w-3 h-3" /> AI suggested
                </span>
              )}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setAiSuggestedFields(prev => { const n = new Set(prev); n.delete('title'); return n; }); }}
              placeholder="e.g. Blue Water Bottle, Black AirPods"
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                aiSuggestedFields.has('title') ? 'border-teal-300 bg-teal-50/30' : 'border-slate-300 bg-white'
              }`}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Category <span className="text-red-500">*</span>
              {aiSuggestedFields.has('category') && (
                <span className="ml-2 text-xs font-normal text-teal-600 inline-flex items-center gap-1">
                  <Package className="w-3 h-3" /> AI suggested
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setAiSuggestedFields(prev => { const n = new Set(prev); n.delete('category'); return n; }); }}
                className={`w-full appearance-none px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8 transition-colors ${
                  aiSuggestedFields.has('category') ? 'border-teal-300 bg-teal-50/30' : 'border-slate-300 bg-white'
                }`}
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Description <span className="text-red-500">*</span>
              {aiSuggestedFields.has('description') && (
                <span className="ml-2 text-xs font-normal text-teal-600 inline-flex items-center gap-1">
                  <Package className="w-3 h-3" /> AI suggested
                </span>
              )}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => { setDescription(e.target.value); setAiSuggestedFields(prev => { const n = new Set(prev); n.delete('description'); return n; }); }}
              placeholder="Describe the item's color, appearance, and any distinctive features you can see…"
              className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors resize-none ${
                aiSuggestedFields.has('description') ? 'border-teal-300 bg-teal-50/30' : 'border-slate-300 bg-white'
              }`}
            />
          </div>

          {/* Found Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Where did you find it?</label>
            <input
              type="text"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              placeholder="e.g. Library reading room, Canteen, Block C staircase…"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Date & Risk */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date found</label>
              <input
                type="date"
                value={foundDate}
                onChange={(e) => setFoundDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Item type</label>
              <div className="relative">
                <select
                  value={riskTier}
                  onChange={(e) => setRiskTier(Number(e.target.value))}
                  className="w-full appearance-none px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8"
                >
                  <option value={0}>General</option>
                  <option value={1}>Valuable</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Correction notice */}
          {aiSuggestedFields.size > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
              <Edit3 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Fields highlighted in green were filled by AI. Correct anything that doesn't look right — your corrections are saved separately.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: STATION ──────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Custodial Handover or Drop-off</h2>
            <p className="text-sm text-slate-500 mt-1">
              Choose a campus collection station, or flag that the item cannot be carried.
            </p>
          </div>

          {/* Cannot-carry mode selector */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Cannot carry to a collection desk?</p>
                <p className="text-xs text-slate-500">If the item is too heavy, bulky, or immovable, request custodial pickup.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCannotCarry(!cannotCarry);
                  if (!cannotCarry) setCollectionPointId('');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                  cannotCarry
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {cannotCarry ? '✓ Cannot Carry Active' : 'Flag Cannot Carry'}
              </button>
            </div>

            {cannotCarry && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Exact On-Site Location &amp; Landmark for Staff Retrieval <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={cannotCarryDetails}
                  onChange={(e) => setCannotCarryDetails(e.target.value)}
                  placeholder="e.g. Science Block Ground Floor, near Lab 102 water dispenser"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>
            )}
          </div>

          {!cannotCarry && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Available Campus Stations</p>
              {collectionPoints.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-sm text-slate-500">No collection stations found.</p>
                  <p className="text-xs text-slate-400 mt-1">You can skip this step and our team will contact you.</p>
                </div>
              ) : (
            <div className="space-y-2.5">
              {collectionPoints.filter(cp => cp.status === 'ACTIVE' || !cp.status).map(cp => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => setCollectionPointId(collectionPointId === String(cp.id) ? '' : String(cp.id))}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    collectionPointId === String(cp.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className={`w-4 h-4 ${collectionPointId === String(cp.id) ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className={`text-sm font-semibold ${collectionPointId === String(cp.id) ? 'text-blue-900' : 'text-slate-800'}`}>
                          {cp.building}
                        </span>
                        {cp.floor && (
                          <span className="text-xs text-slate-500">— {cp.floor}</span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ml-6 ${collectionPointId === String(cp.id) ? 'text-blue-600' : 'text-slate-500'}`}>
                        Station: {cp.station_code}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      collectionPointId === String(cp.id)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-slate-300'
                    }`}>
                      {collectionPointId === String(cp.id) && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
              </div>
            )}
          </div>
        )}

          <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs text-amber-700">
              <strong>Need assistance?</strong> You can still submit the report and our custodial team will
              reach out about physical retrieval or drop-off.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 4: CONFIRM & SUBMIT ─────────────────────────────────────── */}
      {step === 4 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Confirm your report</h2>
            <p className="text-sm text-slate-500 mt-1">Review your submission before sending it.</p>
          </div>

          {/* Summary card */}
          <div className="space-y-3 divide-y divide-slate-100">
            {imagePreview && (
              <div className="flex items-center gap-3">
                <img src={imagePreview} alt="Item" className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500">{category}</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    riskTier === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {riskTier === 1 ? 'Valuable' : 'General'} item
                  </span>
                </div>
              </div>
            )}
            <div className="pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Description</p>
              <p className="text-sm text-slate-700">{description}</p>
            </div>
            {foundLocation && (
              <div className="pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Found at</p>
                <p className="text-sm text-slate-700">{foundLocation}</p>
              </div>
            )}
            {selectedStation && (
              <div className="pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Drop-off station</p>
                <p className="text-sm text-slate-700 font-medium">{selectedStation.building}{selectedStation.floor ? ` — ${selectedStation.floor}` : ''}</p>
                <p className="text-xs text-slate-500">{selectedStation.station_code}</p>
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs text-slate-600">
              By submitting, you confirm that you found this item on campus and are turning it in to Reunite. 
              A campus custodian will review your report before listing it publicly.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step === 1 && aiResult && (
          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors"
          >
            Review Details
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {step === 1 && !aiResult && !isAnalyzing && (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            {!imageFile ? 'Upload First' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {(step === 0 || step === 2 || step === 3) && (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {step === 4 && (
          <button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Submit Report</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
