import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, QrCode, Search, AlertCircle, Upload, Loader2, CheckCircle2 } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (foundId: string) => void;
}

/**
 * Extracts a normalized Found Report ID (e.g. RNT-F-XXXXXX) from raw QR strings or URLs.
 */
export function extractFoundId(rawText: string): string | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();

  // 1. Direct regex match for RNT-F-XXXXXX format
  const directMatch = trimmed.match(/RNT-F-[2-9A-HJ-NP-Z0-9]{4,10}/i);
  if (directMatch) {
    return directMatch[0].toUpperCase();
  }

  // 2. Query param in URL (e.g. ?id=RNT-F-... or ?found_id=...)
  const paramMatch = trimmed.match(/[?&](?:id|found_id|public_id)=([^&]+)/i);
  if (paramMatch) {
    const val = decodeURIComponent(paramMatch[1]).trim();
    const idMatch = val.match(/RNT-F-[2-9A-HJ-NP-Z0-9]{4,10}/i);
    if (idMatch) return idMatch[0].toUpperCase();
    return val.toUpperCase();
  }

  // 3. Clean raw alphanumeric code if looks like an ID
  if (/^[A-Z0-9-]{6,36}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualIdInput, setManualIdInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFeedback, setDetectedFeedback] = useState<string | null>(null);

  // Stop camera streams
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start camera stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access or search by ID manually.'
          : err.message || 'Unable to access camera.'
      );
      setCameraActive(false);
    }
  };

  // Handle successful scan detection
  const handleFoundCode = (code: string) => {
    const extracted = extractFoundId(code);
    if (extracted) {
      setDetectedFeedback(extracted);
      stopCamera();
      setTimeout(() => {
        onScanSuccess(extracted);
        onClose();
      }, 400);
    }
  };

  // BarcodeDetector scanning loop if supported by browser
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setDetectedFeedback(null);
      setManualIdInput('');
      return;
    }

    startCamera();

    let scanning = true;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('BarcodeDetector initialization fallback:', e);
      }
    }

    const intervalId = setInterval(async () => {
      if (!scanning || !detector || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            scanning = false;
            handleFoundCode(rawValue);
          }
        }
      } catch (err) {
        // Ignored frame scan error
      }
    }, 250);

    return () => {
      scanning = false;
      clearInterval(intervalId);
      stopCamera();
    };
  }, [isOpen]);

  // Image file scan fallback
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCameraError(null);

    try {
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve) => (img.onload = resolve));
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
          handleFoundCode(barcodes[0].rawValue);
          setIsProcessing(false);
          return;
        }
      }
      // If detection didn't resolve automatically, guide to manual ID entry
      setCameraError('Could not decode a QR code from this image. Please enter the Found ID manually.');
    } catch (err: any) {
      setCameraError('Failed to process image. Please enter the Found ID manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;
    const extracted = extractFoundId(manualIdInput);
    if (extracted) {
      stopCamera();
      onScanSuccess(extracted);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Scan Found Item Tag</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Scan QR or enter Found ID for instant retrieval</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport / Fallback */}
        <div className="relative aspect-square max-h-64 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            muted
            playsInline
          />

          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Reticle frame */}
              <div className="w-44 h-44 border-2 border-blue-400/80 rounded-2xl relative shadow-lg">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 -mt-0.5 -ml-0.5" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 -mt-0.5 -mr-0.5" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 -mb-0.5 -ml-0.5" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 -mb-0.5 -mr-0.5" />
                {/* Scanning guide animation */}
                <div className="w-full h-0.5 bg-blue-400/80 animate-pulse mt-20" />
              </div>
            </div>
          )}

          {detectedFeedback && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 p-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              <p className="text-xs uppercase font-bold tracking-wider text-emerald-200">Tag Detected</p>
              <p className="font-mono text-lg font-black">{detectedFeedback}</p>
            </div>
          )}

          {!cameraActive && (
            <div className="text-center p-6 space-y-3">
              <Camera className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400 max-w-xs">
                {cameraError || 'Camera feed paused or unavailable. Use manual ID search or photo upload below.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Select Image
                </button>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center text-white text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Scanning image...
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageFileChange}
          />
        </div>

        {cameraError && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Manual ID Fallback Form (Requirement 3) */}
        <form onSubmit={handleManualSubmit} className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-700">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Manual Found ID Search (if camera is unavailable):
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. RNT-F-8M2Q6W"
                value={manualIdInput}
                onChange={(e) => setManualIdInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono uppercase tracking-wider border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualIdInput.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shrink-0 shadow-xs"
            >
              Look Up
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Scanning or entering an ID immediately opens the matched custodial file for physical inspection and pickup verification.
          </p>
        </form>
      </div>
    </div>
  );
};
