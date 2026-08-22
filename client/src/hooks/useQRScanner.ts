import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';

type ScannerState = 'idle' | 'requesting' | 'scanning' | 'success' | 'denied' | 'error';

interface UseQRScannerReturn {
  state: ScannerState;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  start: () => void;
  stop: () => void;
  error: string | null;
}

/**
 * useQRScanner — uses getUserMedia + jsQR to scan QR codes from the camera.
 *
 * How it works:
 *   1. Requests camera permission (rear camera preferred)
 *   2. Streams video to a <video> element
 *   3. Every animation frame, draws video frame to a hidden <canvas>
 *   4. jsQR analyzes the canvas pixel data for QR codes
 *   5. On detection, calls onResult and stops the camera
 */
export function useQRScanner(onResult: (text: string) => void): UseQRScannerReturn {
  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false); // prevents stale closure issues

  const stop = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState('idle');
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !activeRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        console.log('[QRScanner] Detected QR:', code.data);
        stop();
        setState('success');
        onResult(code.data);
        return; // Don't request another frame
      }
    }

    rafRef.current = requestAnimationFrame(scan);
  }, [stop, onResult]);

  const start = useCallback(async () => {
    if (state === 'scanning' || state === 'requesting') return;
    setError(null);
    setState('requesting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available in this browser. Please use Chrome or Firefox on Android, or Safari on iOS.');
      setState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
      }

      activeRef.current = true;
      setState('scanning');
      rafRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
        setState('denied');
      } else if (e.name === 'NotFoundError') {
        setError('No camera found on this device.');
        setState('error');
      } else {
        setError(`Camera error: ${e.message}`);
        setState('error');
      }
    }
  }, [state, scan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { state, videoRef, canvasRef, start, stop, error };
}
