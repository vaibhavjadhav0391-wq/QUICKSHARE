import { formatBytes, fileTypeIcon, truncateFilename } from '@/utils/formatters';
import type { FileTransferItem } from '@/types';

interface CompleteScreenProps {
  transfers: FileTransferItem[];
  role: 'sender' | 'receiver';
  onNewTransfer: () => void;
}

export function CompleteScreen({ transfers, role, onNewTransfer }: CompleteScreenProps) {
  const totalSize = transfers.reduce((sum, t) => sum + t.size, 0);
  const receivedFiles = transfers.filter(t => t.direction === 'receive' && t.status === 'complete');

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 animate-fade-in flex flex-col items-center gap-6">
      {/* Success Icon */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center">
          <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl animate-pulse" />
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl font-black text-white mb-2">Transfer Complete ✓</h1>
        <p className="text-white/50 text-base">
          {transfers.length} file{transfers.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}{' '}
          {role === 'sender' ? 'sent successfully' : 'received successfully'}
        </p>
      </div>

      {/* Files */}
      <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2.5">
          {transfers.filter(t => t.status === 'complete').map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <span className="text-xl flex-shrink-0">{fileTypeIcon(t.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium truncate">{truncateFilename(t.name, 35)}</p>
                <p className="text-white/30 text-xs">{formatBytes(t.size)} · {t.direction === 'send' ? 'Sent' : 'Received'} ✓</p>
              </div>
              {/* Download link for received files */}
              {t.direction === 'receive' && t.downloadUrl && (
                <a
                  href={t.downloadUrl}
                  download={t.name}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors"
                  id={`download-${t.id}`}
                  title="Download file"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Download All (for receiver) */}
      {receivedFiles.length > 0 && (
        <p className="text-white/35 text-xs text-center">
          Files have been automatically saved to your Downloads folder
        </p>
      )}

      {/* New Transfer button */}
      <button
        onClick={onNewTransfer}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-base transition-all hover:shadow-xl hover:shadow-amber-500/25 hover:scale-[1.01] active:scale-[0.99]"
        id="btn-new-transfer"
      >
        New Transfer
      </button>
    </div>
  );
}
