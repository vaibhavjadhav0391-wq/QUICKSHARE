import { useQRScanner } from '@/hooks/useQRScanner';

interface QRScannerProps {
  onResult: (text: string) => void;
  onClose?: () => void;
}

/**
 * Full-screen QR scanner UI for mobile & desktop.
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
      <div className="flex items-center justify-between px-4 pt-safe-top py-4 bg-gradient-to-b from-black/80 to-transparent z-20">
        <div>
          <h2 className="text-white font-semibold text-lg">Scan QR Code</h2>
          <p className="text-white/60 text-sm">Point camera at the QR code on the PC</p>
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
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {/* Hidden canvas for QR analysis */}
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {/* Video Element — Always rendered so ref is never null */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            state === 'scanning' ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          playsInline
          autoPlay
        />

        {state === 'requesting' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/80 font-medium">Starting Camera...</p>
            </div>
          </div>
        )}

        {state === 'scanning' && (
          <>
            {/* Overlay Frame with Corner Brackets & Animated Line */}
            <div className="scanner-overlay z-10">
              <div className="scanner-corner tl" />
              <div className="scanner-corner tr" />
              <div className="scanner-corner bl" />
              <div className="scanner-corner br" />
              <div className="scanner-line" />
            </div>

            <p className="absolute bottom-24 left-0 right-0 text-center text-white/80 text-sm font-medium z-20 drop-shadow-md">
              Align QR code within the frame
            </p>
          </>
        )}

        {state === 'success' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-md">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center animate-bounce-gentle border border-emerald-500/40">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-bold text-xl">QR Code Detected!</p>
            <p className="text-white/60 text-sm">Connecting session...</p>
          </div>
        )}

        {(state === 'denied' || state === 'error') && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 p-8 bg-black/90 backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-white font-semibold text-lg mb-2">Camera Access Required</p>
              <p className="text-white/60 text-sm mb-4">{error}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={start} className="btn-primary text-xs py-2.5 px-4 bg-amber-600 hover:bg-amber-500">
                Retry Camera
              </button>
              <button onClick={handleClose} className="btn-secondary text-xs py-2.5 px-4">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
