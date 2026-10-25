"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onScan: (registerNo: string) => void;
}

export default function BarcodeScanner({ onScan }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let detector: any = null;
    let animId: number;

    async function startCamera() {
      try {
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Try native BarcodeDetector API if supported
        if ("BarcodeDetector" in window) {
          detector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "qr_code"],
          });

          const scanLoop = async () => {
            if (videoRef.current && detector) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const val = barcodes[0].rawValue;
                  if (val) {
                    onScan(val.trim());
                    closeScanner();
                    return;
                  }
                }
              } catch {
                // frame detection error, continue
              }
            }
            animId = requestAnimationFrame(scanLoop);
          };
          scanLoop();
        }
      } catch (err: any) {
        setError("Camera access unavailable. You can enter or simulate scanning below.");
      }
    }

    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const closeScanner = () => {
    stopCamera();
    setIsOpen(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim().toUpperCase());
      closeScanner();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border rounded text-sm text-gray-700 flex items-center gap-1 font-medium whitespace-nowrap"
        title="Scan Barcode from Student ID card"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
          />
        </svg>
        Scan
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl relative">
            <button
              type="button"
              onClick={closeScanner}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-lg font-bold"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-1">Scan Student ID Card</h2>
            <p className="text-xs text-gray-500 mb-4">
              Hold your ID card barcode in front of the camera to autofill your Register Number.
            </p>

            {error ? (
              <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded mb-4">
                {error}
              </div>
            ) : (
              <div className="relative aspect-video bg-black rounded overflow-hidden mb-4 border-2 border-dashed border-blue-500 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-b-2 border-red-500 pointer-events-none opacity-80" />
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Manual Barcode / Scanner Emulation
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. 21KL1A0501"
                  className="w-full border rounded px-3 py-1.5 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 font-medium"
                >
                  Use This Number
                </button>
                <button
                  type="button"
                  onClick={closeScanner}
                  className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
