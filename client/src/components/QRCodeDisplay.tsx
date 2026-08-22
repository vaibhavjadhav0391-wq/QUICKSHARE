import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a QR code on a <canvas> element using the qrcode library.
 * The QR code is re-generated whenever `value` changes.
 */
export function QRCodeDisplay({ value, size = 240, className = '' }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#FFFFFF',  // White QR modules on dark background
        light: '#00000000', // Transparent background
      },
      errorCorrectionLevel: 'H', // High error correction for reliable scanning
    }).catch((err) => {
      console.error('[QRCode] Generation error:', err);
    });
  }, [value, size]);

  return (
    <div className={`qr-wrapper ${className}`}>
      <div className="p-4 rounded-2xl bg-surface-900 border border-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="block"
          aria-label="QR code to connect your phone"
        />
      </div>
    </div>
  );
}
