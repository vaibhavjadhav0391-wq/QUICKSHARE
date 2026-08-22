import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { FileTransfer } from '@/components/FileTransfer';
import { SessionInfoPanel } from '@/components/SessionInfo';
import { TransferHistory } from '@/components/TransferHistory';
import { buildJoinUrl } from '@/utils/deviceDetect';
import { vibrate } from '@/utils/deviceDetect';

/**
 * PCPage — the desktop experience.
 *
 * Flow:
 *   1. Create session → show QR code
 *   2. Wait for mobile to join → initiate WebRTC offer
 *   3. Exchange ICE candidates → DataChannel opens
 *   4. Show file transfer UI
 */
export function PCPage() {
  const [peerJoined, setPeerJoined] = useState(false);
  const [webRTCFailed, setWebRTCFailed] = useState(false);
  const [resetKey, setResetKey] = useState(0); // Increment to force re-mount = new session
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

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
    markConnected,
  } = useSignaling({
    role: 'pc',
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
      setResetKey((k) => k + 1);
    },
    onOffer: (sdp) => handleOffer(sdp),
    onAnswer: (sdp) => handleAnswer(sdp),
    onIceCandidate: (c) => handleIceCandidate(c),
  });

  // ── WEBRTC ──
  const { handleOffer, handleAnswer, handleIceCandidate, closePeer } = useWebRTC({
    isInitiator: true,   // PC always creates the offer
    enabled: peerJoined,
    onDataChannelOpen: (channel) => {
      dataChannelRef.current = channel;
      // Mark signaling as fully connected via WebRTC DataChannel
      markConnected('webrtc');
    },
    onDataChannelMessage: handleDataChannelMessage,
    onDataChannelClose: () => {
      dataChannelRef.current = null;
    },
    onConnectionFailed: () => {
      console.warn('[PCPage] WebRTC connection failed');
      setWebRTCFailed(true);
    },
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  });

  const isConnected = sigState === 'connected' || sigState === 'ws-fallback';
  const joinUrl = session ? buildJoinUrl(session.token) : '';

  const handleEndSession = useCallback(() => {
    endSession();
    closePeer();
    setResetKey((k) => k + 1);
    setPeerJoined(false);
    setWebRTCFailed(false);
    dataChannelRef.current = null;
  }, [endSession, closePeer]);

  const handleNewSession = handleEndSession; // Same effect


  return (
    <div key={resetKey} className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full border-b border-white/5">
        <Link to="/" className="flex items-center gap-2" id="logo-link">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-base">QuickTransfer</span>
        </Link>
        <ConnectionStatus state={sigState} error={sigError} />
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {!isConnected ? (
          /* ── WAITING STATE ── */
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-16">
            {/* QR Column */}
            <div className="flex flex-col items-center gap-6 w-full lg:w-auto">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-1">Connect your phone</h1>
                <p className="text-white/40 text-sm">Scan the QR code below with your phone</p>
              </div>

              {session && joinUrl ? (
                <div className="animate-fade-in">
                  <QRCodeDisplay value={joinUrl} size={260} />
                </div>
              ) : (
                <div className="w-[292px] h-[292px] rounded-2xl skeleton" />
              )}

              {/* Status */}
              <div className="flex flex-col items-center gap-2">
                {sigState === 'waiting' && (
                  <p className="text-white/40 text-sm animate-pulse">Waiting for device...</p>
                )}
                {sigState === 'connecting' && (
                  <div className="flex items-center gap-2 text-brand-400 text-sm">
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Establishing connection...
                  </div>
                )}
                {sigState === 'creating' && (
                  <p className="text-white/30 text-sm">Setting up session...</p>
                )}
              </div>

              {/* Session info panel */}
              {session && (
                <div className="w-full max-w-xs animate-slide-up">
                  <SessionInfoPanel
                    session={session}
                    onEndSession={handleEndSession}
                    onNewSession={handleNewSession}
                  />
                </div>
              )}
            </div>

            {/* Instructions Column */}
            <div className="flex-1 w-full">
              <h2 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-4">
                How to connect
              </h2>
              <div className="flex flex-col gap-3">
                {[
                  { n: 1, text: 'Open QuickTransfer on your phone' },
                  { n: 2, text: 'Tap "Scan QR" and allow camera access' },
                  { n: 3, text: 'Point your camera at the QR code above' },
                  { n: 4, text: 'Both devices will show "Connected ✓"' },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-center gap-4 glass-card px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-brand-500/15 text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {n}
                    </div>
                    <p className="text-white/60 text-sm">{text}</p>
                  </div>
                ))}
              </div>

              {/* WebRTC failed warning */}
              {webRTCFailed && (
                <div className="mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 animate-fade-in">
                  <p className="text-amber-400 text-sm font-medium mb-1">⚠ Direct connection failed</p>
                  <p className="text-amber-400/60 text-xs leading-relaxed">
                    Your network may block peer-to-peer connections (common on college/corporate networks).
                    Transfer will be relayed through the server — still private, but may be slower.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── CONNECTED STATE ── */
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Transfer Panel */}
            <div className="flex-1 flex flex-col gap-6 animate-fade-in">
              {/* Connected banner */}
              <div className="glass-card p-5 border-emerald-500/20 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center animate-bounce-gentle">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Phone Connected</p>
                  <p className="text-white/40 text-xs">
                    {sigState === 'ws-fallback'
                      ? 'Connected via server relay (WebRTC not available)'
                      : 'Direct peer-to-peer connection active'}
                  </p>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={handleEndSession}
                    id="disconnect-btn"
                    className="btn-danger text-xs py-2 px-3"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {/* File transfer area */}
              <FileTransfer
                transfers={transfers}
                onSendFile={sendFile}
                onCancel={cancelTransfer}
                disabled={!isConnected || !dataChannelRef.current}
                mode="pc"
              />

              {/* Transfer history */}
              <TransferHistory transfers={transfers} />
            </div>

            {/* Sidebar */}
            {session && (
              <div className="w-full lg:w-72 flex flex-col gap-4">
                <SessionInfoPanel
                  session={session}
                  onEndSession={handleEndSession}
                  onNewSession={handleNewSession}
                />

                {/* Small QR for reference */}
                <div className="flex flex-col items-center gap-2">
                  <p className="section-heading">Session QR</p>
                  <QRCodeDisplay value={joinUrl} size={150} />
                  <p className="text-white/20 text-xs">Share to add another device</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
