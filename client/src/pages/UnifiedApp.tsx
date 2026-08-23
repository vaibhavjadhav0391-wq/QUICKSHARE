import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { HyperText } from '@/components/ui/hyper-text';
import { buildJoinUrl, vibrate } from '@/utils/deviceDetect';
import { useTheme } from '@/context/ThemeContext';
import { StarWarsToggleSwitch } from '@/components/ui/star-wars-toggle-switch';

// ── SCREENS ──
import { HomeScreen } from './screens/HomeScreen';
import { SendSelectScreen } from './screens/SendSelectScreen';
import { SendWaitingScreen } from './screens/SendWaitingScreen';
import { ReceiveConnectScreen } from './screens/ReceiveConnectScreen';
import { ConnectedSenderScreen } from './screens/ConnectedSenderScreen';
import { ConnectedReceiverScreen } from './screens/ConnectedReceiverScreen';
import { TransferringScreen } from './screens/TransferringScreen';
import { CompleteScreen } from './screens/CompleteScreen';
import type { FileTransferItem } from '@/types';

// ────────────────────────────────────────────────────────────────
// Application State Machine
// ────────────────────────────────────────────────────────────────
type AppScreen =
  | 'home'
  | 'send-select'        // sender picks files
  | 'send-waiting'       // sender shows QR + waits
  | 'receive-connect'    // receiver scans / enters code
  | 'connected-sender'   // both connected, sender confirms send
  | 'connected-receiver' // both connected, receiver sees incoming files
  | 'transferring'       // transfer in progress
  | 'complete';          // transfer done

export function UnifiedApp() {
  // urlToken is present when user opens /join/<token>
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  // ── UI state ──
  const [screen, setScreen] = useState<AppScreen>(() => urlToken ? 'receive-connect' : 'home');
  const [resetKey, setResetKey] = useState(0);

  // ── Files ──
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pendingReceiverFiles, setPendingReceiverFiles] = useState<FileTransferItem[]>([]);
  const [accepted, setAccepted] = useState(false);

  // ── Connection ──
  // joinToken drives useSignaling: when set + role='mobile', it joins the session
  const [joinToken, setJoinToken] = useState<string | undefined>(urlToken);
  const [peerJoined, setPeerJoined] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(() => !!urlToken); // start connecting immediately when URL token present

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  // Initialize to receiver role immediately when arriving via a join URL
  const userRole = useRef<'sender' | 'receiver'>(urlToken ? 'receiver' : 'sender');

  // signalingRole controls when the socket connects and in what mode:
  //   null     → no socket (idle — user hasn't started sharing or joining yet)
  //   'pc'     → sender: create-session on connect
  //   'mobile' → receiver: join-session on connect
  //
  // Key: when user clicks "Receive Files" but hasn't entered a code yet, we
  // keep signalingRole=null so no accidental PC session is created.
  const [signalingRole, setSignalingRole] = useState<'pc' | 'mobile' | null>(
    urlToken ? 'mobile' : null
  );

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
    sendFallbackChunk,
  } = useSignaling({
    role: signalingRole,
    joinToken,
    onPeerJoined: () => {
      console.log('[QuickTransfer] Peer connected (sender side)');
      setPeerJoined(true);
      vibrate(100);
      // PC (sender) → receiver connected → move to confirm-send screen
      if (userRole.current === 'sender') {
        setScreen('connected-sender');
      }
    },
    onPeerDisconnected: () => {
      setPeerJoined(false);
      dataChannelRef.current = null;
      clearAllFileState();
      // Return to appropriate waiting state
      if (userRole.current === 'sender') {
        setScreen('send-waiting');
      } else {
        setScreen('receive-connect');
      }
    },
    onSessionEnded: () => {
      handleReset();
    },
    onCodeResolved: (token) => {
      console.log('[QuickTransfer] Code resolved to token:', token.slice(0, 8) + '...');
      // Switch to mobile role so the new socket fires join-session with resolved token
      setSignalingRole('mobile');
      setJoinToken(token);
      setIsConnecting(true);
      setConnectError(null);
    },
    onOffer: (sdp) => handleOffer(sdp),
    onAnswer: (sdp) => handleAnswer(sdp),
    onIceCandidate: (c) => handleIceCandidate(c),
    onFallbackChunk: (data) => handleDataChannelMessage({ data } as MessageEvent),
  });

  // ── WEBRTC ──
  const { handleOffer, handleAnswer, handleIceCandidate, closePeer, candidateType } = useWebRTC({
    isInitiator: !joinToken,
    enabled: joinToken
      ? (sigState === 'connecting' || sigState === 'connected')
      : peerJoined,
    onDataChannelOpen: (channel) => {
      console.log('[QuickTransfer] Signaling connected: WebRTC DataChannel open');
      dataChannelRef.current = channel;
      vibrate([100, 50, 100]);
      markConnected('webrtc');
      setIsConnecting(false);
      setConnectError(null);
      // Receiver side: move to connected-receiver screen
      if (userRole.current === 'receiver') {
        console.log('[QuickTransfer] Join success — moving to connected-receiver');
        setScreen('connected-receiver');
        // Clean URL now that we're connected
        navigate('/', { replace: true });
      }
    },
    onDataChannelMessage: (e) => handleDataChannelMessage(e),
    onDataChannelClose: () => {
      dataChannelRef.current = null;
    },
    onConnectionFailed: () => {
      // WebRTC failed — fall back to WS relay
      markConnected('ws');
      setIsConnecting(false);
      // Receiver: still show connected screen in relay mode
      if (userRole.current === 'receiver' && screen === 'receive-connect') {
        console.log('[QuickTransfer] Join success (relay fallback) — moving to connected-receiver');
        setScreen('connected-receiver');
        navigate('/', { replace: true });
      }
    },
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  });

  // ── FILE TRANSFER ──
  const isWebRTCRelay = candidateType === 'relay';
  const isSocketRelay = sigState === 'ws-fallback';
  const isRelay = isWebRTCRelay || isSocketRelay;

  const { transfers, sendFile, handleDataChannelMessage, cancelTransfer, clearTransfers } =
    useFileTransfer(dataChannelRef, sendFallbackChunk, isSocketRelay);

  // Helper to completely wipe all file and transfer state for a clean new transfer
  const clearAllFileState = useCallback(() => {
    setSelectedFiles([]);
    setPendingReceiverFiles([]);
    setAccepted(false);
    clearTransfers();
  }, [clearTransfers]);

  // ── When urlToken arrives (deep link), set up receiver mode ──
  // CRITICAL: do NOT navigate away from /join/:token until after joining succeeds.
  // We only store the joinToken in state; the URL stays as-is until connected.
  useEffect(() => {
    if (urlToken) {
      console.log('[QuickTransfer] Join URL detected:', urlToken.slice(0, 8) + '...');
      console.log('[QuickTransfer] Parsed session token:', urlToken);
      userRole.current = 'receiver';
      clearAllFileState();
      setSignalingRole('mobile');
      setScreen('receive-connect');
      setIsConnecting(true);
      setConnectError(null);
      // joinToken is already set from useState(urlToken) initial value.
      // Only update if different (handles HMR / strict-mode double-fire).
      setJoinToken(prev => (prev !== urlToken ? urlToken : prev));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken, clearAllFileState]);

  // ── Log when signaling emits join-session ──
  useEffect(() => {
    if (joinToken && sigState === 'connecting') {
      console.log('[QuickTransfer] Join requested — token:', joinToken.slice(0, 8) + '...');
    }
  }, [joinToken, sigState]);

  // ── Detect join-success: sigState moves to 'connecting' (server confirmed join) ──
  useEffect(() => {
    if (sigState === 'connecting' && userRole.current === 'receiver') {
      console.log('[QuickTransfer] Signaling connected — waiting for WebRTC...');
      setIsConnecting(true);
    }
    // ws-fallback: connected via relay (WebRTC not available / timed out)
    if ((sigState === 'connected' || sigState === 'ws-fallback') && userRole.current === 'receiver') {
      console.log('[QuickTransfer] Join success — state:', sigState);
      setIsConnecting(false);
      if (screen === 'receive-connect') {
        setScreen('connected-receiver');
        navigate('/', { replace: true });
      }
    }
  }, [sigState, screen, navigate]);

  // ── Detect incoming file-start to update pending list ──
  useEffect(() => {
    if (userRole.current !== 'receiver') return;
    const incoming = transfers.filter(t => t.direction === 'receive');
    if (incoming.length > 0) {
      setPendingReceiverFiles(incoming);
    }
  }, [transfers]);

  // ── Auto-progress screen state based on transfers (Receiving/Sending & Completion) ──
  useEffect(() => {
    if (transfers.length === 0) return;

    const hasTransferring = transfers.some(t => t.status === 'transferring');
    const allFinished = transfers.every(
      t => t.status === 'complete' || t.status === 'cancelled' || t.status === 'error'
    );

    // 1. Any file is currently transferring -> transition to transferring screen
    if (hasTransferring && screen !== 'transferring' && screen !== 'complete') {
      setScreen('transferring');
      if (userRole.current === 'receiver') {
        setAccepted(true);
      }
    }
    // 2. All files in current transfer are finished -> transition to complete screen immediately
    else if (allFinished && (screen === 'transferring' || screen === 'connected-receiver' || screen === 'receive-connect' || screen === 'connected-sender')) {
      setScreen('complete');
    }
  }, [transfers, screen]);

  // ── Propagate sigError to UI ──
  useEffect(() => {
    if (sigError && (screen === 'receive-connect' || isConnecting)) {
      console.warn('[QuickTransfer] Signaling error:', sigError);
      setConnectError(sigError);
      setIsConnecting(false);
    }
  }, [sigError, screen, isConnecting]);

  // ────────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    endSession();
    closePeer();
    clearAllFileState();
    setSignalingRole(null);
    setJoinToken(undefined);
    setPeerJoined(false);
    setConnectError(null);
    setIsConnecting(false);
    userRole.current = 'sender';
    dataChannelRef.current = null;
    setResetKey(k => k + 1);
    navigate('/', { replace: true });
    setScreen('home');
  }, [endSession, closePeer, clearAllFileState, navigate]);

  const handleSendClick = useCallback(() => {
    userRole.current = 'sender';
    clearAllFileState();
    setScreen('send-select');
  }, [clearAllFileState]);

  const handleReceiveClick = useCallback(() => {
    userRole.current = 'receiver';
    clearAllFileState();
    setScreen('receive-connect');
  }, [clearAllFileState]);

  const handleAddFiles = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartSharing = useCallback(() => {
    // Activate PC/sender role in signaling — creates a session on connect
    setSignalingRole('pc');
    setScreen('send-waiting');
  }, []);

  /**
   * Central join function called by:
   *   - 6-char code entry (manual)
   *   - QR scan (token extracted from URL)
   *   - (URL-based join is handled via urlToken → joinToken state)
   */
  const handleReceiverConnect = useCallback((codeOrToken: string) => {
    clearAllFileState();
    setConnectError(null);
    setIsConnecting(true);
    const trimmed = codeOrToken.trim();
    userRole.current = 'receiver';

    if (/^[A-Z0-9]{1,6}$/i.test(trimmed) && trimmed.length <= 6) {
      // Short code path:
      //   1. Ensure a socket is connected (signalingRole='mobile' with no joinToken
      //      won't send join-session since joinToken is undefined — but it WILL
      //      connect the socket so joinByCode can use it).
      //   2. Server receives join-by-code, resolves to token, emits code-resolved.
      //   3. onCodeResolved sets signalingRole='mobile' + joinToken=token.
      //   4. Effect re-runs: new socket fires join-session {token}.
      console.log('[QuickTransfer] Code entered:', trimmed);
      console.log('[QuickTransfer] CODE NORMALIZED:', trimmed.toUpperCase());
      console.log('[QuickTransfer] JOIN REQUEST (by code):', trimmed.toUpperCase());
      // Ensure the socket is connecting (signalingRole='mobile' triggers connectSocket).
      // joinByCode queues the code internally if socket isn't ready yet.
      setSignalingRole(prev => prev ?? 'mobile');
      joinByCode(trimmed.toUpperCase());
    } else {
      // Full token path (from QR scan or link paste)
      console.log('[QuickTransfer] JOIN REQUEST (by token):', trimmed.slice(0, 8) + '...');
      setSignalingRole('mobile');
      setJoinToken(trimmed);
    }
  }, [joinByCode, clearAllFileState]);

  const handleSendFiles = useCallback(async () => {
    clearTransfers();
    setPendingReceiverFiles([]);
    setAccepted(false);
    setScreen('transferring');
    for (const file of selectedFiles) {
      await sendFile(file);
    }
  }, [selectedFiles, sendFile, clearTransfers]);

  const handleAcceptFiles = useCallback(() => {
    setAccepted(true);
    setScreen('transferring');
    // Downloads trigger automatically via useFileTransfer's assembler on file-end
  }, []);

  const handleDeclineFiles = useCallback(() => {
    handleReset();
  }, [handleReset]);

  const isConnected = sigState === 'connected' || sigState === 'ws-fallback';

  // Build join URL from sender's session token
  const joinUrl = session ? buildJoinUrl(session.token) : (joinToken ? buildJoinUrl(joinToken) : '');

  // Log session info when created (sender side)
  useEffect(() => {
    if (session) {
      console.log('[QuickTransfer] Session created');
      console.log('[QuickTransfer] Session ID:', session.token.slice(0, 8) + '...');
      console.log('[QuickTransfer] Connection code:', session.shortCode);
      console.log('[QuickTransfer] Share URL:', buildJoinUrl(session.token));
      console.log('[QuickTransfer] QR payload:', buildJoinUrl(session.token));
    }
  }, [session]);

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            onSend={handleSendClick}
            onReceive={handleReceiveClick}
            onHowItWorks={() => navigate('/how-it-works')}
          />
        );

      case 'send-select':
        return (
          <SendSelectScreen
            selectedFiles={selectedFiles}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
            onStartSharing={handleStartSharing}
            onBack={() => setScreen('home')}
          />
        );

      case 'send-waiting':
        return (
          <SendWaitingScreen
            session={session}
            joinUrl={joinUrl}
            onCancel={handleReset}
          />
        );

      case 'receive-connect':
        return (
          <ReceiveConnectScreen
            onConnect={handleReceiverConnect}
            onBack={() => {
              setJoinToken(undefined);
              setIsConnecting(false);
              setConnectError(null);
              setScreen('home');
              navigate('/', { replace: true });
            }}
            error={connectError}
            isConnecting={isConnecting}
            // Pass urlToken so the screen can show "Joining shared session..." immediately
            autoJoinToken={urlToken}
          />
        );

      case 'connected-sender':
        return (
          <ConnectedSenderScreen
            selectedFiles={selectedFiles}
            onSendFiles={handleSendFiles}
            onDisconnect={handleReset}
            isRelay={isRelay}
          />
        );

      case 'connected-receiver':
        return (
          <ConnectedReceiverScreen
            pendingFiles={pendingReceiverFiles}
            onAccept={handleAcceptFiles}
            onDecline={handleDeclineFiles}
            isRelay={isRelay}
            isWaiting={pendingReceiverFiles.length === 0}
          />
        );

      case 'transferring':
        return (
          <TransferringScreen
            transfers={transfers}
            role={userRole.current}
            isRelay={isRelay}
          />
        );

      case 'complete':
        return (
          <CompleteScreen
            transfers={transfers}
            role={userRole.current}
            onNewTransfer={handleReset}
          />
        );

      default:
        return (
          <HomeScreen
            onSend={handleSendClick}
            onReceive={handleReceiveClick}
            onHowItWorks={() => navigate('/how-it-works')}
          />
        );
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Layout Shell
  // ────────────────────────────────────────────────────────────────
  return (
    <div key={resetKey} className="min-h-screen flex flex-col text-white font-sans selection:bg-amber-500/30">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <button
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={handleReset}
            id="header-logo"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md" fill="none">
                <path d="M35 15C35 9.477 39.477 5 45 5H70L95 30V95C95 100.523 90.523 105 85 105H35C29.477 105 25 100.523 25 95V25C25 19.477 29.477 15 35 15Z" fill="#E2EEFF"/>
                <path d="M95 30H75C72.239 30 70 27.761 70 25V5L95 30Z" fill="#B4D4FF"/>
                <circle cx="48" cy="55" r="9" fill="#0052FF"/>
                <circle cx="78" cy="40" r="9" fill="#0052FF"/>
                <circle cx="78" cy="70" r="9" fill="#0052FF"/>
                <path d="M56 51L70 44M56 59L70 66" stroke="#0052FF" strokeWidth="5" strokeLinecap="round"/>
                <path d="M12 45H22M4 65H18M12 55H28" stroke="#0052FF" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <HyperText text="QuickTransfer" className="text-base font-extrabold text-white tracking-tight" />
          </button>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Connection indicator (only when connected) */}
            {isConnected && (
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border
                ${isRelay ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {isRelay ? (isWebRTCRelay ? 'TURN Relay' : 'Relay') : 'P2P'}
              </div>
            )}

            {/* How It Works Button */}
            <button
              onClick={() => navigate('/how-it-works')}
              className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all px-3 py-1.5 rounded-xl font-medium"
              id="btn-how-it-works-header"
            >
              <span>⚡ How it works</span>
            </button>

            {/* New Session / Cancel (only when not on home) */}
            {screen !== 'home' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-2 rounded-xl hover:bg-white/5"
                id="btn-new-session"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Session
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col">
        {renderScreen()}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-5 text-center text-xs text-white/20">
        QuickTransfer · P2P Encrypted File Sharing · No Accounts · No Storage
      </footer>

      {/* ── Floating BB-8 Theme Toggle ── */}
      <StarWarsToggleSwitch
        checked={isDark}
        onChange={toggleTheme}
      />
    </div>
  );
}
