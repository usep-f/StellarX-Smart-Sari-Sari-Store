'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  placeholderText?: string;
  simulateOptions?: Array<{ value: string; label: string }>;
  simulateLabel?: string;
}

export default function QRScanner({
  onScanSuccess,
  placeholderText = 'Align QR code inside the frame to scan',
  simulateOptions = [],
  simulateLabel = 'Simulate Scan',
}: QRScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Desktop Simulator Fallback */}
      {simulateOptions.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <label className="flex text-xs font-medium text-gray-400 mb-1.5 items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> {simulateLabel} (Desktop Testing)
          </label>
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
              {simulateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
