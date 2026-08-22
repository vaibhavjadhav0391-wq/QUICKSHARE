import { useState, useRef, useCallback, useEffect } from 'react';
import { QRScanner } from '@/components/QRScanner';

interface ReceiveConnectScreenProps {
  onConnect: (codeOrToken: string) => void;
  onBack: () => void;
  error?: string | null;
  isConnecting?: boolean;
}

const CODE_LENGTH = 6;

export function ReceiveConnectScreen({
  onConnect,
  onBack,
  error,
  isConnecting = false,
}: ReceiveConnectScreenProps) {
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [showScanner, setShowScanner] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullCode = code.join('');
  const codeReady = fullCode.length === CODE_LENGTH && !fullCode.includes('');

  // Auto-submit when all 6 chars entered
  useEffect(() => {
    if (codeReady && !isConnecting) {
      onConnect(fullCode);
    }
  }, [codeReady, fullCode, isConnecting, onConnect]);

  const handleInput = useCallback((i: number, val: string) => {
    const char = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    setCode(prev => {
      const next = [...prev];
      next[i] = char;
      return next;
    });
    if (char && i < CODE_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
      setCode(prev => { const n = [...prev]; n[i - 1] = ''; return n; });
      e.preventDefault();
    } else if (e.key === 'Enter' && codeReady) {
      onConnect(fullCode);
    }
  }, [code, codeReady, fullCode, onConnect]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
    if (pasted) {
      const chars = pasted.split('');
      const next = Array(CODE_LENGTH).fill('');
      chars.forEach((ch, i) => { if (i < CODE_LENGTH) next[i] = ch; });
      setCode(next);
      inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    }
  }, []);

  const handleQRResult = useCallback((text: string) => {
    setShowScanner(false);
    // Extract token from QR URL or use as-is
    let token = text.trim();
    try {
      const url = new URL(text);
      const parts = url.pathname.split('/');
      const joinIdx = parts.indexOf('join');
      if (joinIdx !== -1 && parts[joinIdx + 1]) {
        token = parts[joinIdx + 1];
      }
    } catch { /* not a URL, use as token */ }
    onConnect(token);
  }, [onConnect]);

  if (showScanner) {
    return <QRScanner onResult={handleQRResult} onClose={() => setShowScanner(false)} />;
  }

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          id="btn-back-receive"
          disabled={isConnecting}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Receive Files</h1>
          <p className="text-white/40 text-sm">Connect to the sender's device</p>
        </div>
      </div>

      {/* Scan QR Code */}
      <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-6 flex flex-col items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
          <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white/80 font-semibold">Scan QR Code</p>
          <p className="text-white/35 text-sm mt-1">Use your camera to scan the QR code shown on the sender's screen</p>
        </div>
        <button
          onClick={() => setShowScanner(true)}
          disabled={isConnecting}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          id="btn-open-scanner"
        >
          Open Camera
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-sm">or enter code</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Code Entry */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2.5" onPaste={handlePaste}>
          {code.map((ch, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="text"
              maxLength={1}
              value={ch}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              disabled={isConnecting}
              className={`w-12 h-14 rounded-xl text-center text-xl font-mono font-bold uppercase
                bg-white/5 border transition-all duration-150 outline-none
                ${ch ? 'border-amber-500/60 text-amber-400 bg-amber-500/10' : 'border-white/15 text-white'}
                focus:border-amber-400/80 focus:bg-amber-500/10 focus:text-amber-400
                disabled:opacity-50 disabled:cursor-not-allowed`}
              id={`code-input-${i}`}
              aria-label={`Code character ${i + 1}`}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && (
          <div className="flex flex-col items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
            <button
              onClick={onBack}
              className="py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all"
              id="btn-error-home"
            >
              Go to Home
            </button>
          </div>
        )}

        {isConnecting && (
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-blue-500/10 border border-blue-500/25">
            <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-blue-300 text-sm font-medium">Connecting…</span>
          </div>
        )}

        <p className="text-white/25 text-xs text-center">
          Type the 6-character code shown on the sender's screen
        </p>
      </div>
    </div>
  );
}
