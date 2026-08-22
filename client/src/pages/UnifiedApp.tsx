import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { QRScanner } from '@/components/QRScanner';
import { FileTransfer } from '@/components/FileTransfer';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { TransferHistory } from '@/components/TransferHistory';
import { MenuBar, MenuItem } from '@/components/ui/glow-menu';
import { buildJoinUrl, isMobileDevice, vibrate, isSecureContext } from '@/utils/deviceDetect';

export function UnifiedApp() {
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();

  // State
  const [peerJoined, setPeerJoined] = useState(false);
  const [webRTCFailed, setWebRTCFailed] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [joinToken, setJoinToken] = useState<string | undefined>(urlToken);
  const [copied, setCopied] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const isMobile = isMobileDevice();
  const notSecure = !isSecureContext();

  const role = joinToken ? 'mobile' : 'pc';

  const { transfers, sendFile, handleDataChannelMessage, cancelTransfer } =
    useFileTransfer(dataChannelRef);

  // ── SIGNALING ──
  const {
    state: sigState,
    session,
    error: sigError,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    endSession,
    joinByCode,
    markConnected,
  } = useSignaling({
    role,
    joinToken,
    onPeerJoined: () => {
      setPeerJoined(true);
      vibrate(100);
    },
    onPeerDisconnected: () => {
      setPeerJoined(false);
      setWebRTCFailed(false);
      dataChannelRef.current = null;
    },
    onSessionEnded: () => {
      handleReset();
    },
    onOffer: (sdp) => handleOffer(sdp),
    onAnswer: (sdp) => handleAnswer(sdp),
    onIceCandidate: (c) => handleIceCandidate(c),
  });

  // ── WEBRTC ──
  const { handleOffer, handleAnswer, handleIceCandidate, closePeer } = useWebRTC({
    isInitiator: role === 'pc',
    enabled: role === 'pc' ? peerJoined : (sigState === 'connecting' || sigState === 'connected'),
    onDataChannelOpen: (channel) => {
      dataChannelRef.current = channel;
      vibrate([100, 50, 100]);
      markConnected('webrtc');
    },
    onDataChannelMessage: handleDataChannelMessage,
    onDataChannelClose: () => {
      dataChannelRef.current = null;
    },
    onConnectionFailed: () => {
      console.warn('[QuickTransfer] WebRTC connection failed');
      setWebRTCFailed(true);
    },
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  });

  const isConnected = sigState === 'connected' || sigState === 'ws-fallback';
  const joinUrl = session ? buildJoinUrl(session.token) : (joinToken ? buildJoinUrl(joinToken) : '');

  // Handlers
  const handleReset = useCallback(() => {
    endSession();
    closePeer();
    setJoinToken(undefined);
    setPeerJoined(false);
    setWebRTCFailed(false);
    setShowScanner(false);
    setShowCodeModal(false);
    setCodeInput('');
    dataChannelRef.current = null;
    setResetKey((k) => k + 1);
    if (urlToken) {
      navigate('/', { replace: true });
    }
  }, [endSession, closePeer, urlToken, navigate]);

  const handleQRResult = useCallback((text: string) => {
    setShowScanner(false);
    let extractedToken: string | null = null;
    try {
      const url = new URL(text);
      const parts = url.pathname.split('/');
      const joinIdx = parts.indexOf('join');
      if (joinIdx !== -1 && parts[joinIdx + 1]) {
        extractedToken = parts[joinIdx + 1];
      }
    } catch {
      extractedToken = text.trim();
    }

    if (extractedToken) {
      setJoinToken(extractedToken);
    }
  }, []);

  const handleCodeSubmit = useCallback(() => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 6) return;
    joinByCode(code);
    setShowCodeModal(false);
  }, [codeInput, joinByCode]);

  const handleCopyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNavClick = (label: string) => {
    setActiveNav(label);
    if (label === 'Scan QR') {
      setShowScanner(true);
    } else if (label === 'Enter Code') {
      setShowCodeModal(true);
    } else if (label === 'New Session') {
      handleReset();
    } else if (label === 'Home') {
      navigate('/');
    }
  };

  const navItems: MenuItem[] = [
    {
      icon: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      label: "Home",
      href: "#",
      gradient: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.1) 50%, rgba(29,78,216,0) 100%)",
      iconColor: "text-blue-400",
    },
    {
      icon: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
      label: "Scan QR",
      href: "#",
      gradient: "radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.1) 50%, rgba(180,83,9,0) 100%)",
      iconColor: "text-amber-400",
    },
    {
      icon: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z" />
        </svg>
      ),
      label: "Enter Code",
      href: "#",
      gradient: "radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(147,51,234,0.1) 50%, rgba(126,34,206,0) 100%)",
      iconColor: "text-purple-400",
    },
    {
      icon: () => (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      label: "New Session",
      href: "#",
      gradient: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.1) 50%, rgba(185,28,28,0) 100%)",
      iconColor: "text-red-400",
    },
  ];

  useEffect(() => {
    if (urlToken && urlToken !== joinToken) {
      setJoinToken(urlToken);
    }
  }, [urlToken, joinToken]);

  return (
    <div key={resetKey} className="min-h-screen flex flex-col text-white font-sans selection:bg-amber-500/30">
      {/* ── QR CAMERA SCANNER MODAL ── */}
      {showScanner && (
        <QRScanner
          onResult={handleQRResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── CODE ENTRY MODAL ── */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 flex flex-col gap-4 animate-scale-up border-amber-500/20">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Enter Connection Code</h3>
              <button onClick={() => setShowCodeModal(false)} className="text-white/40 hover:text-white">✕</button>
            </div>
            <p className="text-white/60 text-sm">
              Enter the 6-character code displayed on the other device's screen.
            </p>
            <input
              className="input-field text-3xl font-mono tracking-widest text-amber-400 border-amber-500/30"
              type="text"
              maxLength={6}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCodeSubmit}
                disabled={codeInput.length < 6}
                className="btn-primary flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
              >
                Connect
              </button>
              <button onClick={() => setShowCodeModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER WITH GLOW MENU BAR ── */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-blue-500/30 p-1 flex items-center justify-center shadow-lg shadow-blue-500/20">
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
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2">
                QuickTransfer
                <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  P2P
                </span>
              </span>
              <p className="text-xs text-white/40 hidden sm:block">Scan. Send. Done.</p>
            </div>
          </div>

          {/* 🌟 Glowing 3D Navigation Menu */}
          <MenuBar
            items={navItems}
            activeItem={activeNav}
            onItemClick={handleNavClick}
          />
        </div>
      </header>

      {/* ── MAIN CONTENT WORKSPACE ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-8 md:py-14 flex flex-col justify-center">
        
        {/* Connection status header bar */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
          <ConnectionStatus state={sigState} error={sigError} />
          {isConnected && (
            <button
              onClick={handleReset}
              className="btn-danger text-xs py-1.5 px-3"
            >
              Disconnect Peer
            </button>
          )}
        </div>

        {/* Dynamic Grid: Left (Action Box) + Right (Hero/Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">

          {/* ── LEFT COLUMN: MAIN ACTION CARD ── */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="glass-card p-6 md:p-8 flex flex-col items-center justify-center text-center h-full min-h-[420px] border-white/10 relative overflow-hidden group">
              
              {/* Background Ambient Glow */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/15 transition-all duration-500" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-500/15 transition-all duration-500" />

              {!isConnected ? (
                /* ── STATE 1: WAITING / CONNECTING ── */
                <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                  <div className="badge-info bg-amber-500/15 border-amber-500/30 text-amber-300">
                    <span className="status-dot waiting" />
                    Instant QR Connection
                  </div>

                  {/* Large QR Display */}
                  {session && joinUrl ? (
                    <div className="flex flex-col items-center gap-3">
                      <QRCodeDisplay value={joinUrl} size={220} />
                      <div className="text-center mt-1">
                        <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                          Fallback Short Code
                        </p>
                        <p className="text-2xl font-mono font-bold text-amber-400 tracking-[0.2em]">
                          {session.shortCode}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-[220px] h-[220px] rounded-2xl skeleton" />
                  )}

                  {/* Actions under QR */}
                  <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
                    <button
                      onClick={() => setShowScanner(true)}
                      className="btn-primary flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm py-3"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      Scan QR Code
                    </button>

                    <button
                      onClick={handleCopyLink}
                      className="btn-secondary flex-1 text-xs py-3 border-white/20"
                    >
                      {copied ? 'Copied Link! ✓' : 'Copy Session Link'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── STATE 2: CONNECTED (FILE TRANSFER ACTIVE) ── */
                <div className="w-full flex flex-col gap-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
                      <span className="status-dot connected" />
                      Devices Connected ✓
                    </span>
                    <span className="text-white/40 text-xs">
                      {sigState === 'ws-fallback' ? 'Relay Mode' : 'P2P Active'}
                    </span>
                  </div>

                  <FileTransfer
                    transfers={transfers}
                    onSendFile={sendFile}
                    onCancel={cancelTransfer}
                    disabled={!isConnected || !dataChannelRef.current}
                    mode={isMobile ? 'mobile' : 'pc'}
                  />
                </div>
              )}

            </div>
          </div>

          {/* ── RIGHT COLUMN: HERO & DETAILS ── */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 mb-6">
                <span>⚡</span> Peer-to-Peer Encrypted File Sharing
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-6">
                Share files directly from your device to anywhere
              </h1>

              <p className="text-lg text-white/60 font-normal leading-relaxed mb-8">
                Connect your phone and PC instantly using a QR code. Send files of any size directly without WhatsApp logins, Google Drive uploads, or permanent cloud storage.
              </p>

              {/* Bullet Features Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="glass-card p-4 flex items-center gap-3">
                  <span className="text-2xl text-amber-400">∞</span>
                  <div>
                    <h4 className="text-white font-semibold text-sm">No file size limit</h4>
                    <p className="text-white/40 text-xs">Chunked direct streaming</p>
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center gap-3">
                  <span className="text-2xl text-amber-400">⚡</span>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Blazingly fast</h4>
                    <p className="text-white/40 text-xs">WebRTC DataChannel P2P</p>
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center gap-3">
                  <span className="text-2xl text-amber-400">🔒</span>
                  <div>
                    <h4 className="text-white font-semibold text-sm">End-to-end P2P</h4>
                    <p className="text-white/40 text-xs">Nothing saved on cloud</p>
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center gap-3">
                  <span className="text-2xl text-amber-400">📱</span>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Phone & PC Ready</h4>
                    <p className="text-white/40 text-xs">Any browser & ratio</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transfer History or Security Note */}
            <div className="mt-auto pt-6 border-t border-white/10">
              {transfers.length > 0 ? (
                <TransferHistory transfers={transfers} />
              ) : (
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>🔒 Cryptographic temporary session</span>
                  <span>Auto-expires on close</span>
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/30">
        <p>QuickTransfer · Direct WebRTC Peer-to-Peer File Sharing · No Accounts · No Permanent Storage</p>
      </footer>
    </div>
  );
}
