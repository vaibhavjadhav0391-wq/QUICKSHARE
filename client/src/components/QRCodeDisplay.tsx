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
            <div className="w-10 h-10 rounded-xl bg-slate-950 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/40">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
