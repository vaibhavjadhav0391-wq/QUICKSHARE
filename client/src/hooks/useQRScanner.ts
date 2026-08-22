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

export function useQRScanner(onResult: (text: string) => void): UseQRScannerReturn {
  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);

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
      if (ctx) {
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
          return;
        }
      }
    }

    if (activeRef.current) {
      rafRef.current = requestAnimationFrame(scan);
    }
  }, [stop, onResult]);

  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.play().catch((err) => {
        console.warn('[QRScanner] Play error:', err);
      });
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setState('requesting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available in this browser. Please use Chrome, Firefox, or Safari.');
      setState('error');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Fallback for laptop webcams or strict devices
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      streamRef.current = stream;
      activeRef.current = true;
      setState('scanning');

      // Attach stream on next tick to ensure <video> element is rendered in DOM
      setTimeout(() => {
        attachStreamToVideo(stream);
        rafRef.current = requestAnimationFrame(scan);
      }, 50);

    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in browser settings.');
        setState('denied');
      } else if (e.name === 'NotFoundError') {
        setError('No camera found on this device.');
        setState('error');
      } else {
        setError(`Camera error: ${e.message}`);
        setState('error');
      }
    }
  }, [scan, attachStreamToVideo]);

  // Auto-start camera when scanner mounts
  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, []);

  // Ensure video element receives stream when mounted
  useEffect(() => {
    if (state === 'scanning' && streamRef.current) {
      attachStreamToVideo(streamRef.current);
    }
  }, [state, attachStreamToVideo]);

  return { state, videoRef, canvasRef, start, stop, error };
}
