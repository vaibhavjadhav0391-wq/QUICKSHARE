import { useState } from 'react';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import type { SessionInfo } from '@/types';

interface SendWaitingScreenProps {
  session: SessionInfo | null;
  joinUrl: string;
  onCancel: () => void;
}

export function SendWaitingScreen({ session, joinUrl, onCancel }: SendWaitingScreenProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copyCode = async () => {
    if (!session) return;
    try { 
      await navigator.clipboard.writeText(session.shortCode); 
      setCopied('code');
      setTimeout(() => setCopied(null), 2000);
    } catch { 
      fallbackCopy(session.shortCode, 'code');
    }
  };

  const copyLink = async () => {
    if (!joinUrl) return;
    try { 
      await navigator.clipboard.writeText(joinUrl); 
      setCopied('link');
      setTimeout(() => setCopied(null), 2000);
    } catch { 
      fallbackCopy(joinUrl, 'link');
    }
  };

  const fallbackCopy = (text: string, type: 'code' | 'link') => {
    try {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      alert(`Unable to copy automatically. Please select and copy this ${type}: ${text}`);
    }
  };

  const shareLink = async () => {
    if (!joinUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'QuickTransfer',
          text: 'Receive files using this QuickTransfer link',
          url: joinUrl
        });
      } catch (err) {
        /* ignore */
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 animate-fade-in flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Share this session</h1>
        <p className="text-white/45 text-sm">
          Ask the receiver to scan the QR code or enter the code below
        </p>
      </div>

      {/* QR Code Card */}
      <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 flex flex-col items-center gap-5">
        {/* QR Code */}
        <div className="relative">
          {session && joinUrl ? (
            <QRCodeDisplay value={joinUrl} size={200} />
          ) : (
            <div className="w-[200px] h-[200px] rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs">or enter code</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Short Code Display */}
        {session ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-2">
              {session.shortCode.split('').map((ch, i) => (
                <div
                  key={i}
                  className="w-11 h-14 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl font-mono font-bold text-amber-400"
                >
                  {ch}
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs">Connection code</p>
          </div>
        ) : (
          <div className="flex gap-2">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="w-11 h-14 rounded-xl bg-white/5 border border-white/10 skeleton" />
            ))}
          </div>
        )}
      </div>

      {/* Copy Actions */}
      <div className="flex gap-2 w-full">
        <button
          onClick={copyCode}
          disabled={!session}
          className="flex-1 py-3 px-1 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-xs sm:text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40 whitespace-nowrap"
          id="btn-copy-code"
        >
          {copied === 'code' ? '✓ Copied' : '📋 Code'}
        </button>
        <button
          onClick={copyLink}
          disabled={!session}
          className="flex-1 py-3 px-1 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-xs sm:text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40 whitespace-nowrap"
          id="btn-copy-link"
        >
          {copied === 'link' ? '✓ Copied' : '🔗 Link'}
        </button>
        <button
          onClick={shareLink}
          disabled={!session}
          className="flex-1 py-3 px-1 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-xs sm:text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40 whitespace-nowrap"
          id="btn-share-link"
        >
          📤 Share
        </button>
      </div>

      {/* Status */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/25">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <span className="text-amber-300 text-sm font-medium">Waiting for receiver…</span>
        </div>

        <button
          onClick={onCancel}
          className="text-white/30 text-sm hover:text-white/60 transition-colors"
          id="btn-cancel-session"
        >
          Cancel session
        </button>
      </div>
    </div>
  );
}
