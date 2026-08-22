import { useState, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { QRScanner } from '@/components/QRScanner';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { FileTransfer } from '@/components/FileTransfer';
import { vibrate, isSecureContext } from '@/utils/deviceDetect';

/**
 * MobilePage — the phone experience.
 *
 * Flow:
 *   1. Show "Scan QR" and "Enter Code" options
 *   2. QR scanner or code entry → extract token
 *   3. Join session → wait for WebRTC offer from PC
 *   4. Answer offer → DataChannel opens
 *   5. Show file transfer UI
 */
export function MobilePage() {
  const location = useLocation();
  const locationState = location.state as { joinToken?: string } | null;

  const [showScanner, setShowScanner] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  // joinToken can come from: QR scan, code entry, or deep link (/join/:token → JoinPage → navigate here)
  const [joinToken, setJoinToken] = useState<string | undefined>(locationState?.joinToken);
  const [sessionReady, setSessionReady] = useState(!!locationState?.joinToken);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const { transfers, sendFile, handleDataChannelMessage, cancelTransfer } =
    useFileTransfer(dataChannelRef);

  // ── SIGNALING ──
  const {
    state: sigState,
    error: sigError,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    joinByCode,
    markConnected,
  } = useSignaling({
    role: joinToken ? 'mobile' : null,
    joinToken,
    onPeerJoined: () => {
      // Mobile doesn't receive peer-joined, but handle it just in case
    },
    onPeerDisconnected: () => {
      dataChannelRef.current = null;
    },
    onOffer: (sdp) => handleOffer(sdp),
    onAnswer: (sdp) => handleAnswer(sdp),
    onIceCandidate: (c) => handleIceCandidate(c),
  });

  // ── WEBRTC ──
  const { handleOffer, handleAnswer, handleIceCandidate } = useWebRTC({
    isInitiator: false,  // Mobile is the responder
    enabled: sigState === 'connecting' || sigState === 'connected',
    onDataChannelOpen: (channel) => {
      dataChannelRef.current = channel;
      vibrate([100, 50, 100]); // Haptic feedback on connection
      markConnected('webrtc');
    },
    onDataChannelMessage: handleDataChannelMessage,
    onDataChannelClose: () => {
      dataChannelRef.current = null;
    },
    onConnectionFailed: () => {
      console.warn('[MobilePage] WebRTC connection failed');
    },
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  });

  const isConnected = sigState === 'connected' || sigState === 'ws-fallback';

  // ── QR SCANNED ──
  const handleQRResult = useCallback((text: string) => {
    setShowScanner(false);
    // Extract token from URL: https://host/join/<token>
    let token: string | null = null;
    try {
      const url = new URL(text);
      const parts = url.pathname.split('/');
      // pathname is /join/<token>
      const joinIdx = parts.indexOf('join');
      if (joinIdx !== -1 && parts[joinIdx + 1]) {
        token = parts[joinIdx + 1];
      }
    } catch {
      // Not a URL — maybe it's just the token directly
      token = text.trim();
    }

    if (token) {
      setJoinToken(token);
      setSessionReady(true);
    }
  }, []);

  // ── CODE ENTRY ──
  const handleCodeSubmit = useCallback(() => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 6) return;
    joinByCode(code);
    setShowCodeEntry(false);
  }, [codeInput, joinByCode]);

  // ── RESET ──
  const handleReset = useCallback(() => {
    setShowScanner(false);
    setShowCodeEntry(false);
    setCodeInput('');
    setJoinToken(undefined);
    setSessionReady(false);
    dataChannelRef.current = null;
  }, []);

  const notSecure = !isSecureContext();

  return (
    <div className="min-h-screen flex flex-col safe-top safe-bottom">
      {/* QR Scanner overlay */}
      {showScanner && (
        <QRScanner
          onResult={handleQRResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="flex items-center gap-2" id="mobile-logo">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-base">QuickTransfer</span>
        </Link>
        <ConnectionStatus state={sigState} />
      </header>

      <main className="flex-1 flex flex-col px-5 py-6 gap-6 max-w-md mx-auto w-full">

        {/* ── NOT YET JOINED ── */}
        {!sessionReady && sigState === 'idle' && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Connect to PC</h1>
              <p className="text-white/40 text-sm">
                Open QuickTransfer on a PC, then scan the QR code or enter the fallback code.
              </p>
            </div>

            {notSecure && (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-amber-400 text-sm font-medium">⚠ Camera requires HTTPS</p>
                <p className="text-amber-400/60 text-xs mt-1">
                  QR scanning requires a secure connection (HTTPS). You can still use the manual code below.
                </p>
              </div>
            )}

            {/* Scan QR Button */}
            <button
              onClick={() => setShowScanner(true)}
              id="scan-qr-btn"
              disabled={notSecure}
              className="btn-primary py-5 rounded-2xl text-base disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan QR Code
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/20 text-xs">or use fallback code</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Code Entry Toggle */}
            {!showCodeEntry ? (
              <button
                onClick={() => setShowCodeEntry(true)}
                id="enter-code-btn"
                className="btn-secondary py-5 rounded-2xl text-base"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Enter Code Manually
              </button>
            ) : (
              <div className="glass-card p-5 flex flex-col gap-4 animate-slide-up">
                <label className="section-heading" htmlFor="code-field">
                  Enter the 6-character code from the PC
                </label>
                <input
                  id="code-field"
                  className="input-field text-2xl"
                  type="text"
                  maxLength={6}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCodeSubmit}
                    id="submit-code-btn"
                    disabled={codeInput.length < 6}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => { setShowCodeEntry(false); setCodeInput(''); }}
                    className="btn-secondary px-4"
                    id="cancel-code-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CONNECTING ── */}
        {(sigState === 'connecting' || sigState === 'creating') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
            <div className="w-16 h-16 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Connecting...</p>
              <p className="text-white/40 text-sm mt-1">Establishing secure connection</p>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {sigState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg mb-2">Connection Failed</p>
              <p className="text-white/50 text-sm">{sigError}</p>
            </div>
            <button onClick={handleReset} className="btn-primary" id="mobile-retry-btn">
              Try Again
            </button>
          </div>
        )}

        {/* ── CONNECTED ── */}
        {isConnected && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Connected banner */}
            <div className="glass-card p-5 border-emerald-500/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center animate-bounce-gentle">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">Connected to PC ✓</p>
                <p className="text-white/40 text-xs">
                  {sigState === 'ws-fallback' ? 'Using server relay' : 'Direct P2P connection'}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="btn-danger text-xs py-1.5 px-3"
                id="mobile-disconnect-btn"
              >
                Disconnect
              </button>
            </div>

            {/* File transfer */}
            <FileTransfer
              transfers={transfers}
              onSendFile={sendFile}
              onCancel={cancelTransfer}
              disabled={!isConnected || !dataChannelRef.current}
              mode="mobile"
            />
          </div>
        )}
      </main>
    </div>
  );
}
