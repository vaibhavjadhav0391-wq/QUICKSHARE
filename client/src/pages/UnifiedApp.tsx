import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { HyperText } from '@/components/ui/hyper-text';
import { buildJoinUrl, vibrate } from '@/utils/deviceDetect';

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
  | 'send-select'       // sender picks files
  | 'send-waiting'      // sender shows QR + waits
  | 'receive-connect'   // receiver scans / enters code
  | 'connected-sender'  // both connected, sender confirms send
  | 'connected-receiver'// both connected, receiver sees incoming files
  | 'transferring'      // transfer in progress
  | 'complete';         // transfer done

export function UnifiedApp() {
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();

  // ── UI state ──
  const [screen, setScreen] = useState<AppScreen>(() => urlToken ? 'receive-connect' : 'home');
  const [resetKey, setResetKey] = useState(0);

  // ── Files ──
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pendingReceiverFiles, setPendingReceiverFiles] = useState<FileTransferItem[]>([]);
  const [accepted, setAccepted] = useState(false);

  // ── Connection ──
  const [joinToken, setJoinToken] = useState<string | undefined>(urlToken);
  const [peerJoined, setPeerJoined] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  // Distinguishes sender vs receiver role across the app
  // Initialize to 'receiver' immediately if arriving via a join URL
  const userRole = useRef<'sender' | 'receiver'>(urlToken ? 'receiver' : 'sender');

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
    role: joinToken ? 'mobile' : 'pc',
    joinToken,
    onPeerJoined: () => {
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
      setAccepted(false);
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
  const { handleOffer, handleAnswer, handleIceCandidate, closePeer } = useWebRTC({
    isInitiator: !joinToken,
    enabled: joinToken
      ? (sigState === 'connecting' || sigState === 'connected')
      : peerJoined,
    onDataChannelOpen: (channel) => {
      dataChannelRef.current = channel;
      vibrate([100, 50, 100]);
      markConnected('webrtc');
      setIsConnecting(false);
      setConnectError(null);
      // Receiver side: move to connected-receiver screen
      if (userRole.current === 'receiver') {
        setScreen('connected-receiver');
      }
    },
    onDataChannelMessage: (e) => handleDataChannelMessage(e),
    onDataChannelClose: () => {
      dataChannelRef.current = null;
    },
    onConnectionFailed: () => {
      markConnected('ws');
      setIsConnecting(false);
      // Receiver: still show connected screen in relay mode
      if (userRole.current === 'receiver' && screen === 'receive-connect') {
        setScreen('connected-receiver');
      }
    },
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  });

  // ── FILE TRANSFER ──
  const isRelay = sigState === 'ws-fallback';
  const { transfers, sendFile, handleDataChannelMessage, cancelTransfer } =
    useFileTransfer(dataChannelRef, sendFallbackChunk, isRelay);

  // ── Detect join-success for receiver to navigate to connected screen ──
  useEffect(() => {
    if (sigState === 'connecting' && userRole.current === 'receiver') {
      setIsConnecting(true);
    }
    if ((sigState === 'connected' || sigState === 'ws-fallback') && userRole.current === 'receiver') {
      setIsConnecting(false);
      if (screen === 'receive-connect') {
        setScreen('connected-receiver');
      }
    }
  }, [sigState, screen]);

  // ── Detect incoming file-start to update pending list ──
  useEffect(() => {
    if (userRole.current !== 'receiver') return;
    const incoming = transfers.filter(t => t.direction === 'receive');
    if (incoming.length > 0 && !accepted) {
      setPendingReceiverFiles(incoming);
    }
  }, [transfers, accepted]);

  // ── Auto-progress to transferring screen once accepted or sending ──
  useEffect(() => {
    if (transfers.some(t => t.status === 'transferring') && screen !== 'transferring') {
      setScreen('transferring');
    }
  }, [transfers, screen]);

  // ── Auto-progress to complete screen ──
  useEffect(() => {
    if (
      screen === 'transferring' &&
      transfers.length > 0 &&
      transfers.every(t => t.status === 'complete' || t.status === 'cancelled' || t.status === 'error')
    ) {
      setScreen('complete');
    }
  }, [transfers, screen]);

  // ── If URL has a token, go to receive-connect immediately ──
  useEffect(() => {
    if (urlToken && urlToken !== joinToken) {
      setJoinToken(urlToken);
      userRole.current = 'receiver';
      setScreen('receive-connect');
      // Clean up the URL using React Router so the SPA navigation stays consistent
      navigate('/', { replace: true });
    }
  }, [urlToken, navigate]);

  // ────────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    endSession();
    closePeer();
    setJoinToken(undefined);
    setPeerJoined(false);
    setSelectedFiles([]);
    setPendingReceiverFiles([]);
    setAccepted(false);
    setConnectError(null);
    setIsConnecting(false);
    userRole.current = 'sender';
    dataChannelRef.current = null;
    setResetKey(k => k + 1);
    if (urlToken) navigate('/', { replace: true });
    setScreen('home');
  }, [endSession, closePeer, urlToken, navigate]);

  const handleSendClick = useCallback(() => {
    userRole.current = 'sender';
    setScreen('send-select');
  }, []);

  const handleReceiveClick = useCallback(() => {
    userRole.current = 'receiver';
    setScreen('receive-connect');
  }, []);

  const handleAddFiles = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartSharing = useCallback(() => {
    // useSignaling already auto-creates a session when role === 'pc'
    setScreen('send-waiting');
  }, []);

  const handleReceiverConnect = useCallback((codeOrToken: string) => {
    setConnectError(null);
    setIsConnecting(true);
    const trimmed = codeOrToken.trim();

    // Decide if it's a short code (≤6 chars) or a full token
    if (trimmed.length <= 6) {
      joinByCode(trimmed.toUpperCase());
    } else {
      // Full token — set as joinToken so useSignaling creates mobile role
      setJoinToken(trimmed);
    }
  }, [joinByCode]);

  const handleSendFiles = useCallback(async () => {
    setScreen('transferring');
    for (const file of selectedFiles) {
      await sendFile(file);
    }
  }, [selectedFiles, sendFile]);

  const handleAcceptFiles = useCallback(() => {
    setAccepted(true);
    setScreen('transferring');
    // Downloads trigger automatically via useFileTransfer's assembler on file-end
  }, []);

  const handleDeclineFiles = useCallback(() => {
    handleReset();
  }, [handleReset]);

  // sigError from connection issue
  useEffect(() => {
    if (sigError && (screen === 'receive-connect' || isConnecting)) {
      setConnectError(sigError);
      setIsConnecting(false);
    }
  }, [sigError, screen, isConnecting]);

  const isConnected = sigState === 'connected' || sigState === 'ws-fallback';
  const joinUrl = session ? buildJoinUrl(session.token) : (joinToken ? buildJoinUrl(joinToken) : '');

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return <HomeScreen onSend={handleSendClick} onReceive={handleReceiveClick} />;

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
            onBack={() => { setJoinToken(undefined); setScreen('home'); if (urlToken) navigate('/', { replace: true }); }}
            error={connectError}
            isConnecting={isConnecting}
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
        return <HomeScreen onSend={handleSendClick} onReceive={handleReceiveClick} />;
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Layout Shell
  // ────────────────────────────────────────────────────────────────
  return (
    <div key={resetKey} className="min-h-screen flex flex-col text-white font-sans selection:bg-amber-500/30">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-black/40 backdrop-blur-xl">
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
                {isRelay ? 'Relay' : 'P2P'}
              </div>
            )}

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
    </div>
  );
}
