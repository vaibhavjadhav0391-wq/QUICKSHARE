import { useNavigate } from 'react-router-dom';
import HowItWorks from '@/components/ui/how-it-works';
import { useTheme } from '@/context/ThemeContext';
import { StarWarsToggleSwitch } from '@/components/ui/star-wars-toggle-switch';

export function HowItWorksPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Back to home"
              id="btn-flow-back"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-bold text-lg text-white">How QuickTransfer Works</span>
          </div>

          <div className="flex items-center gap-3">
            <StarWarsToggleSwitch
              checked={isDark}
              onChange={toggleTheme}
            />
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs hover:from-amber-400 hover:to-orange-400 transition-all shadow-md shadow-amber-500/20"
              id="btn-flow-start"
            >
              Start Transfer →
            </button>
          </div>
        </div>
      </header>

      {/* Main visual flow content */}
      <main className="flex-1">
        <div className="text-center pt-10 pb-4 px-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            Visual Transfer Guide
          </h1>
          <p className="text-white/45 text-sm md:text-base max-w-xl mx-auto">
            QuickTransfer is a zero-storage, P2P encrypted file sharing web app. Here is how your files move securely from sender to receiver.
          </p>
        </div>

        <HowItWorks />
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/30 bg-black">
        QuickTransfer · P2P Encrypted File Sharing · Visual Flow Guide
      </footer>
    </div>
  );
}
