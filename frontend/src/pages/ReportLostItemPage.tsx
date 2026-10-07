import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, ApiError } from '../services/api';
import {
  ChevronDown, Upload, X, CheckCircle2, AlertCircle,
  Loader2, ArrowLeft, ArrowRight, FileText
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Category-specific discriminative questions
// ---------------------------------------------------------------------------
interface CategoryQuestion {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
  placeholder?: string;
}

const CATEGORY_QUESTIONS: Record<string, CategoryQuestion[]> = {
  'Electronics': [
    { key: 'brand', label: 'Brand / Make', type: 'text', placeholder: 'e.g. Apple, Samsung, OnePlus' },
    { key: 'model', label: 'Model / Color', type: 'text', placeholder: 'e.g. iPhone 15 Pro, black' },
    { key: 'case_color', label: 'Case / Cover color', type: 'text', placeholder: 'e.g. transparent, navy blue' },
    { key: 'distinctive_mark', label: 'Any distinctive mark or sticker', type: 'text', placeholder: 'e.g. Scratch on top corner' },
  ],
  'Bottles & Containers': [
    { key: 'color', label: 'Color', type: 'text', placeholder: 'e.g. dark blue, silver' },
    { key: 'brand', label: 'Brand (if any)', type: 'text', placeholder: 'e.g. Milton, Hydro Flask, Unknown' },
    { key: 'size', label: 'Approximate size', type: 'select', options: ['Small (under 500ml)', 'Medium (500–750ml)', 'Large (750ml+)'] },
    { key: 'mark', label: 'Any sticker, dent, or marking', type: 'text', placeholder: 'e.g. Dent on lid, blue sticker' },
  ],
  'Stationery & Books': [
    { key: 'type', label: 'Type of item', type: 'select', options: ['Notebook', 'Textbook', 'Calculator', 'Pen/Pencil set', 'Geometry box', 'File/Folder', 'Other'] },
    { key: 'color', label: 'Color / Cover color', type: 'text', placeholder: 'e.g. black cover, red spine' },
    { key: 'name_written', label: 'Is your name written on it?', type: 'select', options: ['Yes, front page', 'Yes, inside cover', 'Yes, on cover', 'No'] },
    { key: 'content', label: 'Any specific content or label', type: 'text', placeholder: 'e.g. "Physics Notes Sem 3"' },
  ],
  'Keys & Badges': [
    { key: 'type', label: 'Key/Badge type', type: 'select', options: ['Room key', 'Vehicle key', 'Padlock key', 'ID card', 'Access card', 'Keychain set', 'Other'] },
    { key: 'keychain', label: 'Keychain or tag details', type: 'text', placeholder: 'e.g. Red keychain with small torch' },
    { key: 'label', label: 'Any label or text on it', type: 'text', placeholder: 'e.g. Name written, room number visible' },
    { key: 'count', label: 'Number of keys on ring', type: 'text', placeholder: 'e.g. 3 keys' },
  ],
  'Clothing & Accessories': [
    { key: 'type', label: 'Type', type: 'select', options: ['Jacket', 'Sweater', 'Scarf', 'Cap/Hat', 'Belt', 'Glasses', 'Earphones', 'Watch', 'Bag', 'Other'] },
    { key: 'color', label: 'Color', type: 'text', placeholder: 'e.g. dark navy blue' },
    { key: 'brand', label: 'Brand (if visible)', type: 'text', placeholder: 'e.g. Adidas, H&M, Unknown' },
    { key: 'mark', label: 'Any distinctive mark or monogram', type: 'text', placeholder: 'e.g. Initials stitched inside' },
  ],
  'Wallet & Cards': [
    { key: 'color', label: 'Wallet color / material', type: 'text', placeholder: 'e.g. brown leather, black synthetic' },
    { key: 'brand', label: 'Brand (if known)', type: 'text', placeholder: 'e.g. Tommy Hilfiger, Unknown' },
    { key: 'contents', label: 'Approximate contents', type: 'text', placeholder: 'e.g. 2 cards, ID, some cash' },
    { key: 'id_type', label: 'Important cards inside (general type, no numbers)', type: 'text', placeholder: 'e.g. College ID, metro card, credit card' },
  ],
  'Documents & ID': [
    { key: 'doc_type', label: 'Document type', type: 'select', options: ['College ID card', 'National ID / Aadhaar', 'Passport', 'Marksheet', 'Certificate', 'Other'] },
    { key: 'name_on', label: 'Name on document', type: 'text', placeholder: 'Your name as it appears on it' },
    { key: 'color', label: 'Color / Folder color', type: 'text', placeholder: 'e.g. blue folder, yellow lamination' },
    { key: 'extra', label: 'Any other identifying detail', type: 'text', placeholder: 'e.g. Sticker, handwriting on cover' },
  ],
};

const DEFAULT_QUESTIONS: CategoryQuestion[] = [
  { key: 'color', label: 'Color or appearance', type: 'text', placeholder: 'Describe the color or appearance' },
  { key: 'brand', label: 'Brand or make (if applicable)', type: 'text', placeholder: 'e.g. Sony, Unknown' },
  { key: 'size', label: 'Approximate size', type: 'text', placeholder: 'e.g. small, fits in pocket' },
  { key: 'mark', label: 'Any distinctive mark', type: 'text', placeholder: 'e.g. sticker, initials, scratch' },
];

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

// Steps: 0 = Category, 1 = Questions, 2 = Location/Time, 3 = Review
const STEPS = ['Category', 'Details', 'Location & Time', 'Review'];

export const ReportLostItemPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0: Category
  const [category, setCategory] = useState('');

  // Step 1: Description + questions
  const [description, setDescription] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Step 2: Location / Time
  const [lostDate, setLostDate] = useState('');
  const [lostTime, setLostTime] = useState('');
  const [lostLocation, setLostLocation] = useState('');

  // Step 3: Image (optional)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const questions = CATEGORY_QUESTIONS[category] || DEFAULT_QUESTIONS;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const normalizedAttributes: Record<string, string> = {};
      questions.forEach(q => {
        if (answers[q.key]) normalizedAttributes[q.key] = answers[q.key];
      });

      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      formData.append('original_answers', JSON.stringify({ ...answers, lost_location: lostLocation, lost_date: lostDate, lost_time: lostTime }));
      formData.append('normalized_attributes', JSON.stringify(normalizedAttributes));
      if (imageFile) formData.append('image', imageFile);

      await apiRequest('/api/items/lost-items/', {
        method: 'POST',
        body: formData,
        headers: {},
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      setFormError(null);
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to submit lost item report. Please try again.');
    },
  });

  const canNext = () => {
    if (step === 0) return !!category;
    if (step === 1) return description.trim().length > 0;
    return true;
  };

  const next = () => {
    setFormError(null);
    if (!canNext()) {
      if (step === 0) setFormError('Please select a category.');
      if (step === 1) setFormError('Please describe the item.');
      return;
    }
    setStep(s => s + 1);
  };

  const back = () => {
    setFormError(null);
    setStep(s => s - 1);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-10 shadow-xs space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">Lost Report Submitted</h1>
          <p className="text-sm text-slate-600">
            Your lost item report has been recorded. Browse the Available Items catalog to see if your item has already been found and submitted.
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
              Browse Found Items
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-slate-400" />
          Report Lost Item
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Report a lost item so staff can match it against found items. Your report helps with identification.
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                idx < step
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : idx === step
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300 text-slate-400'
              }`}>
                {idx < step ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-[11px] mt-1 font-medium ${idx === step ? 'text-slate-900' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-14px] transition-colors ${idx < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Form error */}
      {formError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Step 0: Category */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">What did you lose?</h2>
          <p className="text-sm text-slate-500">Select the category that best describes your lost item.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategory(cat); setAnswers({}); }}
                className={`p-3 rounded-lg border text-sm font-medium text-left transition-all ${
                  category === cat
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Category-specific questions + description */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">Describe your item</h2>
          <p className="text-sm text-slate-500">
            Category: <span className="font-semibold text-slate-800">{category}</span>. Answer as many questions as you can — this helps match your item.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              General Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe the item, its approximate appearance, and anything distinctive..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identification Questions</p>
            {questions.map(q => (
              <div key={q.key}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{q.label}</label>
                {q.type === 'select' ? (
                  <div className="relative">
                    <select
                      value={answers[q.key] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                      className="w-full appearance-none px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white pr-8"
                    >
                      <option value="">Select...</option>
                      {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={answers[q.key] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                    placeholder={q.placeholder}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Location & Time */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">When and where did you lose it?</h2>
          <p className="text-sm text-slate-500">Approximate details help narrow down the search area.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approximate Date</label>
              <input
                type="date"
                value={lostDate}
                onChange={(e) => setLostDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approximate Time</label>
              <input
                type="time"
                value={lostTime}
                onChange={(e) => setLostTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Approximate Lost Location</label>
            <input
              type="text"
              value={lostLocation}
              onChange={(e) => setLostLocation(e.target.value)}
              placeholder="e.g. Library reading room, canteen, Block C staircase..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Optional image */}
          <div className="border-t border-slate-100 pt-3">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Optional: Upload an image of the item
              <span className="text-[11px] font-normal text-slate-400 ml-2">(helps with identification)</span>
            </label>
            {imagePreview ? (
              <div className="relative w-32 h-32">
                <img src={imagePreview} alt="Lost item" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow border border-slate-200 text-slate-500 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors w-full">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs text-slate-500">Click to upload image (optional)</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">Review your report</h2>
          <p className="text-sm text-slate-500">Please verify the details before submitting.</p>

          <div className="space-y-3 divide-y divide-slate-100">
            <div className="pt-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Category</span>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{category}</p>
            </div>
            <div className="pt-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Description</span>
              <p className="text-sm text-slate-700 mt-0.5">{description || '—'}</p>
            </div>
            {Object.entries(answers).filter(([, v]) => v).length > 0 && (
              <div className="pt-3">
                <span className="text-xs font-semibold text-slate-500 uppercase">Identification Details</span>
                <div className="mt-1 space-y-1">
                  {questions.filter(q => answers[q.key]).map(q => (
                    <div key={q.key} className="text-sm text-slate-700">
                      <span className="font-medium text-slate-600">{q.label}:</span> {answers[q.key]}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-3">
              <span className="text-xs font-semibold text-slate-500 uppercase">Location & Time</span>
              <p className="text-sm text-slate-700 mt-0.5">
                {lostLocation || 'Not specified'}{lostDate ? ` • ${lostDate}` : ''}{lostTime ? ` at ${lostTime}` : ''}
              </p>
            </div>
            {imagePreview && (
              <div className="pt-3">
                <span className="text-xs font-semibold text-slate-500 uppercase">Image</span>
                <img src={imagePreview} alt="preview" className="mt-1 w-24 h-24 object-cover rounded-lg border border-slate-200" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={step === 0 ? () => navigate('/dashboard') : back}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-md transition-colors"
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Submit Report
          </button>
        )}
      </div>
    </div>
  );
};
