import { formatBytes, fileTypeIcon, truncateFilename } from '@/utils/formatters';
import type { FileTransferItem } from '@/types';

interface ConnectedReceiverScreenProps {
  pendingFiles: FileTransferItem[];
  onAccept: () => void;
  onDecline: () => void;
  isRelay: boolean;
  isWaiting: boolean; // true when connected but no files announced yet
}

export function ConnectedReceiverScreen({
  pendingFiles,
  onAccept,
  onDecline,
  isRelay,
  isWaiting,
}: ConnectedReceiverScreenProps) {
  const totalSize = pendingFiles.reduce((sum, f) => sum + f.size, 0);
  const hasFiles = pendingFiles.length > 0;

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 animate-fade-in">
      {/* Connection status */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-300 text-sm font-semibold">Connected to Sender ✓</span>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${isRelay ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'}`}>
          {isRelay ? '● Relay' : '● Direct P2P'}
        </span>
      </div>

      {isWaiting && !hasFiles ? (
        /* Waiting for sender to initiate */
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-white/80 font-semibold">Waiting for sender…</p>
            <p className="text-white/35 text-sm mt-1">The sender will send files shortly</p>
          </div>
        </div>
      ) : (
        /* Incoming files preview */
        <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold">Incoming Files</p>
              <p className="text-white/35 text-xs">{pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mb-1">
            {pendingFiles.map((f, i) => (
              <div
                key={f.id || i}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/5 border border-white/8"
              >
                <span className="text-xl flex-shrink-0">{fileTypeIcon(f.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{truncateFilename(f.name, 38)}</p>
                  <p className="text-white/30 text-xs">{formatBytes(f.size)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accept / Decline */}
      {hasFiles && (
        <div className="flex flex-col gap-3">
          <button
            onClick={onAccept}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg transition-all hover:shadow-xl hover:shadow-blue-500/25 hover:scale-[1.01] active:scale-[0.99]"
            id="btn-accept-files"
          >
            📥 Accept Files
          </button>
          <button
            onClick={onDecline}
            className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 font-medium hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
            id="btn-decline-files"
          >
            Decline
          </button>
        </div>
      )}

      {isRelay && (
        <p className="text-center text-white/25 text-xs mt-4">
          Direct connection unavailable. Using secure relay connection.
        </p>
      )}
    </div>
  );
}
