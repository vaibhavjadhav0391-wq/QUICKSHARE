import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Enhanced QRCodeDisplay with modern dark aesthetics, glowing ambient container,
 * amber accents, and center lightning brand icon.
 */
export function QRCodeDisplay({ value, size = 220, className = '' }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#ffffff',     // Clean high-contrast white modules
        light: '#00000000',   // Transparent background
      },
      errorCorrectionLevel: 'H', // High error correction to allow center icon overlay
    }).catch((err) => {
      console.error('[QRCode] Generation error:', err);
    });
  }, [value, size]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/30 to-brand-500/20 rounded-3xl blur-xl animate-pulse pointer-events-none" />

      {/* Styled QR Card Container */}
      <div className="relative p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-md flex flex-col items-center justify-center">
        {/* Decorative corner brackets */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400/80 rounded-tl-lg" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400/80 rounded-tr-lg" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400/80 rounded-bl-lg" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400/80 rounded-br-lg" />

        <div className="relative flex items-center justify-center p-2 rounded-2xl bg-slate-950/80 border border-white/5">
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="block rounded-lg"
            aria-label="QR code to connect your phone"
          />

          {/* Center Brand Badge Icon Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border-2 border-blue-400 p-1 flex items-center justify-center shadow-lg shadow-blue-500/40">
              <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
                <path d="M35 15C35 9.477 39.477 5 45 5H70L95 30V95C95 100.523 90.523 105 85 105H35C29.477 105 25 100.523 25 95V25C25 19.477 29.477 15 35 15Z" fill="#E2EEFF"/>
                <path d="M95 30H75C72.239 30 70 27.761 70 25V5L95 30Z" fill="#B4D4FF"/>
                <circle cx="48" cy="55" r="9" fill="#0052FF"/>
                <circle cx="78" cy="40" r="9" fill="#0052FF"/>
                <circle cx="78" cy="70" r="9" fill="#0052FF"/>
                <path d="M56 51L70 44M56 59L70 66" stroke="#0052FF" strokeWidth="5" strokeLinecap="round"/>
                <path d="M12 45H22M4 65H18M12 55H28" stroke="#0052FF" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
