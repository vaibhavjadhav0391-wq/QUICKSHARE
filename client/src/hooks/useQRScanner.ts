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

// Analysis resolution — large enough for jsQR to find the QR, small enough to be fast.
// Downscaling a 1080p/4K camera frame to this before running jsQR dramatically
// reduces CPU usage while keeping accuracy.
const ANALYSIS_WIDTH = 640;
const ANALYSIS_HEIGHT = 480;

// How many milliseconds between QR decode attempts (40ms = ~25fps fast scanning).
const SCAN_INTERVAL_MS = 40;

export function useQRScanner(onResult: (text: string) => void): UseQRScannerReturn {
  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const hasScannedFlag = useRef(false);

  // Keep latest onResult in a ref so the interval closure never goes stale
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; });

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      console.log('[QR] stopping camera');
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopStream();
    setState('idle');
  }, [stopStream]);

  // Core decode tick — runs on a fixed interval (not rAF) so it stays responsive
  // even on low-power devices. Uses a fixed-size off-screen canvas so jsQR
  // always works on the same resolution regardless of camera resolution.
  const decodeTick = useCallback(() => {
    if (!activeRef.current || hasScannedFlag.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Only process if video has real pixel data
    if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) return;

    // Draw to fixed analysis size (not video native size) for jsQR performance
    const W = ANALYSIS_WIDTH;
    const H = ANALYSIS_HEIGHT;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, W, H);
    const imageData = ctx.getImageData(0, 0, W, H);

    // attemptBoth: tries both normal and inverted — handles dark-on-light AND
    // light-on-dark QR codes (screen glare can invert perceived contrast).
    const code = jsQR(imageData.data, W, H, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      if (hasScannedFlag.current) return; // guard against double-fire
      hasScannedFlag.current = true;

      console.log('[QR] QR detected:', code.data);

      // Stop scanning immediately
      activeRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopStream();
      setState('success');

      // Immediately pass decoded result to join logic without delay
      onResultRef.current(code.data);
    }
  }, [stopStream]);

  const startScanning = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    hasScannedFlag.current = false;
    activeRef.current = true;

    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.muted = true;

      let scanStarted = false;
      const beginScanning = () => {
        if (scanStarted) return;
        scanStarted = true;
        console.log('[QR] Scanner started');
        setState('scanning');
        if (intervalRef.current !== null) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(decodeTick, SCAN_INTERVAL_MS);
      };

      // Register listeners BEFORE play() — some browsers fire 'playing'
      // synchronously, and we'd miss it if we added the listener after.
      video.addEventListener('playing', beginScanning, { once: true });
      video.addEventListener('canplay', beginScanning, { once: true });
      video.addEventListener('loadeddata', beginScanning, { once: true });

      video.play().catch(err => {
        console.warn('[QR] video.play() error:', err);
      });
    }
  }, [decodeTick]);

  const start = useCallback(async () => {
    if (activeRef.current) return; // already running

    setError(null);
    setState('requesting');
    console.log('[QR] Camera starting...');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Use Chrome or Safari.');
      setState('error');
      return;
    }

    try {
      let stream: MediaStream;

      // First try: rear camera (environment) at 720p
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Fallback: any camera (handles laptops, desktops, strict devices)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }

      startScanning(stream);

    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
        setState('denied');
      } else if (e.name === 'NotFoundError') {
        setError('No camera found on this device.');
        setState('error');
      } else {
        setError(`Camera error: ${e.message || e.name}`);
        setState('error');
      }
    }
  }, [startScanning]);

  // Auto-start when hook mounts, cleanup on unmount
  useEffect(() => {
    start();
    return () => {
      activeRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopStream();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, videoRef, canvasRef, start, stop, error };
}
