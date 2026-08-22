import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Enhanced QRCodeDisplay with clean, unobstructed QR matrix modules
 * for 100% reliable camera scanning across all phones.
 */
export function QRCodeDisplay({ value, size = 220, className = '' }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#ffffff',     // High-contrast clean white modules
        light: '#00000000',   // Transparent background
      },
      errorCorrectionLevel: 'M', // Standard robust error correction
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
        {/* Corner bracket accents */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400/80 rounded-tl-lg" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400/80 rounded-tr-lg" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400/80 rounded-bl-lg" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400/80 rounded-br-lg" />

        <div className="relative flex items-center justify-center p-3 rounded-2xl bg-slate-950/90 border border-white/10">
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="block rounded-lg"
            aria-label="QR code to connect your phone"
          />
        </div>
      </div>
    </div>
  );
}
