import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  formatDate,
  formatTime,
  formatDuration,
} from '../utils/formatters';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Film,
  Building2,
  Clock,
  Sparkles,
  Search,
} from 'lucide-react';

export const StaffTicketValidationPage = () => {
  const [manualToken, setManualToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null); // { type: 'SUCCESS'|'ERROR', code, message, ticket, validatedBy, validatedAt }
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Submit token for validation
  const handleValidateToken = useCallback(async (tokenToVerify) => {
    const trimmed = (tokenToVerify || manualToken).trim();
    if (!trimmed) return;

    setValidating(true);
    setResult(null);

    // Stop camera while result is displayed
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      const res = await api.post('/tickets/validate', { qrToken: trimmed });
      if (res.success && res.data) {
        setResult({
          type: 'SUCCESS',
          code: res.data.code,
          message: res.message || 'Ticket validated successfully! Entry granted.',
          ticket: res.data.ticket,
          validatedBy: res.data.validatedBy,
          validatedAt: res.data.validatedAt,
        });
        setManualToken('');
      } else {
        throw new Error(res.message || 'Validation rejected');
      }
    } catch (err) {
      setResult({
        type: 'ERROR',
        code: err.code || 'VALIDATION_FAILED',
        message: err.message || 'Ticket verification failed. Please inspect token or customer booking.',
      });
    } finally {
      setValidating(false);
    }
  }, [manualToken]);

  // Start Camera QR Scanner
  const startCamera = async () => {
    setCameraError('');
    setResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      // Check if native BarcodeDetector API is available (Chrome, Edge, Android)
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              if (rawValue) {
                handleValidateToken(rawValue);
              }
            }
          } catch {
            // Frame detection skipped
          }
        }, 400);
      }
    } catch (err) {
      setCameraError(err.message || 'Failed to activate camera.');
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setCameraActive(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Reset to scan next ticket
  const handleScanNext = () => {
    setResult(null);
    setManualToken('');
    startCamera();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Staff Ticket Entrance Scanner
                </h1>
                <p className="text-xs text-slate-400">
                  Verify cinema admission tickets at the gate via camera QR scan or token search.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!cameraActive ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Camera Scanner</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                <span>Stop Camera</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Camera Scanner Viewport */}
        {cameraActive && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>Camera Scanner Active</span>
              </span>
              <span className="text-slate-400">Point lens at customer’s digital ticket QR</span>
            </div>

            <div className="relative aspect-video max-h-80 mx-auto rounded-2xl overflow-hidden bg-black border border-slate-700 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Target Scan Reticle Overlay */}
              <div className="absolute inset-0 border-2 border-amber-500/40 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-amber-400 rounded-2xl relative shadow-2xl">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br-sm" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-center text-slate-400">
              If your browser does not support automatic barcode detection, enter the token manually below.
            </p>
          </div>
        )}

        {/* Camera Error Alert */}
        {cameraError && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Camera Unavailable</strong>
              <p className="mt-0.5 text-slate-300">{cameraError}</p>
              <p className="mt-1 text-[11px] text-slate-400">You can still validate tickets using the manual token input below.</p>
            </div>
          </div>
        )}

        {/* Validation Result Display */}
        {result && (
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 ${
              result.type === 'SUCCESS'
                ? 'bg-emerald-950/30 border-emerald-500/60 shadow-emerald-500/10'
                : 'bg-red-950/30 border-red-500/60 shadow-red-500/10'
            }`}
          >
            {/* Result Header */}
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                  result.type === 'SUCCESS'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-red-500 text-white'
                }`}
              >
                {result.type === 'SUCCESS' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1">
                <span
                  className={`text-[11px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-md inline-block border ${
                    result.type === 'SUCCESS'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                      : 'bg-red-950 text-red-300 border-red-700/60'
                  }`}
                >
                  {result.code}
                </span>
                <h3 className="text-xl font-black text-white">
                  {result.type === 'SUCCESS' ? 'Admission Granted' : 'Admission Rejected'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">{result.message}</p>
              </div>
            </div>

            {/* Validated Ticket Summary Details */}
            {result.type === 'SUCCESS' && result.ticket && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Ticket Number
                    </span>
                    <span className="font-mono font-bold text-base text-amber-400">
                      {result.ticket.ticketNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Booking Reference
                    </span>
                    <span className="font-mono font-semibold text-slate-300">
                      {result.ticket.bookingReference}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Movie &amp; Format
                    </span>
                    <span className="font-bold text-white text-sm flex items-center gap-1.5 mt-0.5">
                      <Film className="w-4 h-4 text-amber-500" />
                      <span>{result.ticket.movie?.title}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                        {result.ticket.show?.format}
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {result.ticket.movie?.duration ? formatDuration(result.ticket.movie.duration) : ''} • {result.ticket.movie?.rating}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Screen &amp; Seat
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base font-black text-amber-400">
                        Row {result.ticket.seat?.row}, Seat {result.ticket.seat?.seatNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                        {result.ticket.seat?.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {result.ticket.screen?.name} ({result.ticket.theatre?.name})
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Showtime
                    </span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{formatDate(result.ticket.show?.startTime)} at {formatTime(result.ticket.show?.startTime)}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Validated By
                    </span>
                    <span className="font-medium text-emerald-400 mt-0.5 block">
                      {result.validatedBy?.name} ({result.validatedBy?.role}) at {formatTime(result.validatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action to scan next patron */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleScanNext}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Scan Next Ticket</span>
              </button>
            </div>
          </div>
        )}

        {/* Manual Token Entry Fallback */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              <span>Manual Verification Token Entry</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">Backup / Direct Entry</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleValidateToken();
            }}
            className="space-y-3"
          >
            <div>
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste or enter 64-character verification token..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-3">
              {manualToken && (
                <button
                  type="button"
                  onClick={() => setManualToken('')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={!manualToken.trim() || validating}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{validating ? 'Verifying...' : 'Validate Ticket Token'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Validation Rules Card for Staff */}
        <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-400">
          <h4 className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Entrance Gate Validation Protocol</span>
          </h4>
          <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-slate-400">
            <li>Each QR code can only be scanned and admitted <strong>exactly once</strong>.</li>
            <li>Shows open for admission 4 hours prior to the scheduled start time.</li>
            <li>Entry window automatically closes 1 hour after the movie finishes.</li>
            <li>Any duplicate or secondary scan of a used ticket will alert with <strong>ALREADY_USED</strong>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
