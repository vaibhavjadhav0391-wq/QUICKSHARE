import { formatBytes, fileTypeIcon, truncateFilename } from '@/utils/formatters';

interface HomeScreenProps {
  onSend: () => void;
  onReceive: () => void;
  onHowItWorks?: () => void;
}

export function HomeScreen({ onSend, onReceive, onHowItWorks }: HomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] px-4 py-12 animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-12 max-w-xl">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
          Share files{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
            directly
          </span>{' '}
          between devices
        </h1>
        <p className="text-white/50 text-lg leading-relaxed">
          No accounts, no cloud, no limits. Peer-to-peer file sharing in seconds.
        </p>
      </div>

      {/* Primary Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl mb-6">
        {/* Send Files */}
        <button
          id="btn-send-files"
          onClick={onSend}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent p-8 text-left transition-all duration-300 hover:border-amber-500/40 hover:from-amber-500/25 hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/10 active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-amber-400/20 transition-all duration-500" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-5 group-hover:bg-amber-500/30 transition-colors">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Send Files</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Select files and share them to any device using a QR code or connection code.
            </p>
          </div>
          <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center group-hover:bg-amber-500/40 transition-all group-hover:translate-x-0.5 duration-200">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Receive Files */}
        <button
          id="btn-receive-files"
          onClick={onReceive}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent p-8 text-left transition-all duration-300 hover:border-blue-500/40 hover:from-blue-500/25 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-blue-400/20 transition-all duration-500" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
              <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Receive Files</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Scan a QR code or enter a connection code to receive files from another device.
            </p>
          </div>
          <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/40 transition-all group-hover:translate-x-0.5 duration-200">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>

      {/* How it works CTA button */}
      {onHowItWorks && (
        <button
          id="btn-how-it-works-home"
          onClick={onHowItWorks}
          className="mb-8 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-400/30 text-white/80 hover:text-white text-xs font-semibold transition-all group shadow-md"
        >
          <span className="text-amber-400 font-bold">⚡ How QuickTransfer Works</span>
          <span className="text-white/40 group-hover:translate-x-0.5 transition-transform">→</span>
        </button>
      )}

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/35">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          End-to-end encrypted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          No file size limit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          No account required
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Nothing stored on servers
        </span>
      </div>
    </div>
  );
}

// Re-export helpers used by multiple screens
export { formatBytes, fileTypeIcon, truncateFilename };
