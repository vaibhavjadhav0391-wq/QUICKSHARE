import { useState } from 'react';
import { buildJoinUrl } from '@/utils/deviceDetect';
import type { SessionInfo } from '@/types';

interface SessionInfoPanelProps {
  session: SessionInfo;
  onEndSession: () => void;
  onNewSession: () => void;
}

/**
 * Displays session token, short code, and QR join URL.
 * Allows copying the join link and ending/resetting the session.
 */
export function SessionInfoPanel({ session, onEndSession, onNewSession }: SessionInfoPanelProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl = buildJoinUrl(session.token);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const el = document.createElement('textarea');
      el.value = joinUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Short code */}
      <div className="glass-card p-4 flex flex-col gap-2">
        <p className="section-heading">Fallback Code</p>
        <p className="text-white/50 text-xs mb-1">
          If QR scanning doesn't work, enter this code on your phone:
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-3xl font-bold text-brand-300 tracking-[0.25em] select-all">
            {session.shortCode}
          </p>
          <button
            onClick={handleCopy}
            id="copy-link-btn"
            className={`btn-secondary text-xs px-3 py-2 ${copied ? '!text-emerald-400 !border-emerald-500/30' : ''}`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Session actions */}
      <div className="flex gap-2">
        <button
          onClick={onNewSession}
          id="new-session-btn"
          className="btn-secondary flex-1 text-xs py-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          New Session
        </button>
        <button
          onClick={onEndSession}
          id="end-session-btn"
          className="btn-danger flex-1 text-xs py-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          End Session
        </button>
      </div>
    </div>
  );
}
