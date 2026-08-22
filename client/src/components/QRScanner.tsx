import { useQRScanner } from '@/hooks/useQRScanner';

interface QRScannerProps {
  onResult: (text: string) => void;
  onClose?: () => void;
}

/**
 * Full-screen QR scanner UI for mobile.
 * Shows live camera feed with scanning overlay and corner brackets.
 */
export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const { state, videoRef, canvasRef, start, stop, error } = useQRScanner(onResult);

  const handleClose = () => {
    stop();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div>
          <h2 className="text-white font-semibold text-lg">Scan QR Code</h2>
          <p className="text-white/60 text-sm">Point at the QR code on the PC</p>
        </div>
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Close scanner"
          id="qr-scanner-close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden">
        {/* Hidden canvas for QR analysis */}
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {state === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-20 h-20 rounded-full bg-brand-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-medium mb-1">Camera permission required</p>
              <p className="text-white/50 text-sm">Tap the button below to start scanning</p>
            </div>
            <button onClick={start} className="btn-primary text-base px-8 py-4 rounded-2xl" id="start-scan-btn">
              Allow Camera & Scan
            </button>
          </div>
        )}

        {state === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/70">Requesting camera...</p>
            </div>
          </div>
        )}

        {state === 'scanning' && (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
              autoPlay
            />
            {/* Dark overlay with transparent center */}
            <div className="scanner-overlay">
              <div className="absolute inset-0 bg-black/40" />
              {/* Scanning frame */}
              <div
                className="absolute bg-transparent"
                style={{
                  top: '20%', left: '15%', right: '15%', bottom: '20%',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  borderRadius: '8px',
                }}
              />
              {/* Corner brackets */}
              <div className="scanner-corner tl" />
              <div className="scanner-corner tr" />
              <div className="scanner-corner bl" />
              <div className="scanner-corner br" />
              {/* Scan line */}
              <div className="scanner-line" />
            </div>
            <p className="absolute bottom-24 left-0 right-0 text-center text-white/70 text-sm">
              Align QR code within the frame
            </p>
          </>
        )}

        {state === 'success' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center animate-bounce-gentle">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-xl">QR Code Detected!</p>
            <p className="text-white/50 text-sm">Connecting...</p>
          </div>
        )}

        {(state === 'denied' || state === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-medium mb-2">Camera Unavailable</p>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
            <button onClick={handleClose} className="btn-secondary mt-2" id="scanner-error-close">
              Close
            </button>
          </div>
        )}
      </div>

      {/* Start button if idle */}
      {state === 'idle' && null /* handled above */}
    </div>
  );
}
