'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertCircle, X } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  placeholderText?: string;
  manualOptions?: Array<{ value: string; label: string; searchText?: string }>;
  manualLabel?: string;
  manualMode?: 'select' | 'text';
}

export default function QRScanner({
  onScanSuccess,
  placeholderText = 'Align QR code inside the frame to scan',
  manualOptions = [],
  manualLabel = 'Manual Entry',
  manualMode = 'select',
}: QRScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'qr-reader-element';

  // Toggle Camera
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No camera devices found.');
      }

      // Initialize scanner if not already created
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }

      setCameraActive(true);

      // Start scanning using the back camera (environment) if available, or default
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          // Success
          onScanSuccess(decodedText);
          stopCamera();
        },
        () => {
          // Silent failure (polling scans)
        }
      );
    } catch (err: unknown) {
      console.error('Failed to start scanner:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not access camera. Please check permissions.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    setCameraActive(false);
  };

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-card-border bg-card-bg p-4 glass">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-[#ff7a00]">
          <Camera className="w-4 h-4" /> Scanner Control
        </h3>
        {cameraActive && (
          <button
            onClick={stopCamera}
            className="text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            Turn Off Camera
          </button>
        )}
      </div>

      {/* Camera Viewport */}
      <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-xl overflow-hidden bg-black/40 border border-white/10 flex flex-col items-center justify-center text-center p-4">
        {cameraActive && <div className="scanner-laser" />}
        
        <div id={scannerId} className="w-full h-full absolute inset-0 [&>video]:object-cover" />

        {!cameraActive && (
          <div className="z-10 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-xs text-gray-400 max-w-[200px]">{placeholderText}</p>
            <button
              onClick={startCamera}
              className="bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md shadow-[#ff7a00]/20"
            >
              Start Camera Scan
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-3 flex items-start justify-between gap-2 w-full">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400/70 hover:text-red-400 transition shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Manual Entry Fallback */}
      {(manualMode === 'text' || manualOptions.length > 0) && (
        <div className="border-t border-white/5 pt-3">
          <label className="flex text-xs font-medium text-gray-400 mb-1.5 items-center gap-1.5">
            {manualLabel}
          </label>
          {manualMode === 'text' ? (
            <div className="relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const matched = manualOptions.find(
                    (opt) =>
                      opt.value.toLowerCase() === manualText.trim().toLowerCase() ||
                      (opt.searchText || opt.label).toLowerCase() === manualText.trim().toLowerCase()
                  );
                  if (matched) {
                    onScanSuccess(matched.value);
                    setManualText('');
                    setShowSuggestions(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Type product name or scan ID..."
                  value={manualText}
                  onChange={(e) => {
                    setManualText(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="flex-1 bg-[#161c24] border border-card-border rounded-lg text-xs p-2 text-white outline-none focus:border-[#ff7a00] transition"
                />
                <button
                  type="submit"
                  disabled={
                    !manualOptions.some(
                      (opt) =>
                        opt.value.toLowerCase() === manualText.trim().toLowerCase() ||
                        (opt.searchText || opt.label).toLowerCase() === manualText.trim().toLowerCase()
                    )
                  }
                  className="bg-[#ff7a00] disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent hover:bg-[#e06b00] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition"
                >
                  Add
                </button>
              </form>

              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && manualText.trim() && (
                (() => {
                  const filtered = manualOptions.filter(
                    (opt) =>
                      opt.value.toLowerCase().includes(manualText.toLowerCase()) ||
                      (opt.searchText || opt.label).toLowerCase().includes(manualText.toLowerCase())
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#1a2130]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl z-40 p-1 flex flex-col gap-0.5">
                        {filtered.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setManualText(opt.searchText || opt.label);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-md transition flex justify-between items-center"
                          >
                            <span className="font-semibold">{opt.searchText || opt.label}</span>
                            <span className="text-[10px] text-gray-500 font-mono select-all">
                              {opt.value.slice(0, 12)}...
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onScanSuccess(e.target.value);
                    e.target.value = ''; // Reset select
                  }
                }}
                className="w-full bg-[#161c24] border border-card-border rounded-lg text-xs p-2 text-white outline-none focus:border-[#ff7a00] transition"
                defaultValue=""
              >
                <option value="" disabled>
                  -- Select item to scan --
                </option>
                {manualOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
