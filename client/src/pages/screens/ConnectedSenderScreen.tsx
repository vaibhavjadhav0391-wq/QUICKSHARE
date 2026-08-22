import { formatBytes, fileTypeIcon, truncateFilename } from '@/utils/formatters';

interface ConnectedSenderScreenProps {
  selectedFiles: File[];
  onSendFiles: () => void;
  onDisconnect: () => void;
  isRelay: boolean;
}

export function ConnectedSenderScreen({
  selectedFiles,
  onSendFiles,
  onDisconnect,
  isRelay,
}: ConnectedSenderScreenProps) {
  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 animate-fade-in">
      {/* Connection status */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-300 text-sm font-semibold">Receiver Connected ✓</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${isRelay ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'}`}>
            {isRelay ? '● Relay' : '● Direct P2P'}
          </span>
          <button
            onClick={onDisconnect}
            className="text-xs text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
            id="btn-disconnect"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Files ready to send */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Files ready to send</h2>
          <span className="text-white/35 text-sm">{formatBytes(totalSize)}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {selectedFiles.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/5 border border-white/8"
            >
              <span className="text-xl flex-shrink-0">{fileTypeIcon(file.type || 'application/octet-stream')}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium truncate">{truncateFilename(file.name, 38)}</p>
                <p className="text-white/30 text-xs">{formatBytes(file.size)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Send CTA */}
      <button
        onClick={onSendFiles}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-lg transition-all hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99]"
        id="btn-send-now"
      >
        📤 Send Files
      </button>

      {isRelay && (
        <p className="text-center text-white/30 text-xs mt-3">
          Direct connection unavailable. Using secure relay connection.
        </p>
      )}
    </div>
  );
}
