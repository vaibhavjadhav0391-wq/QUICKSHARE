import { Link } from 'react-router-dom';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Open on PC',
    description: 'Visit QuickTransfer on your computer. A QR code appears instantly.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Scan with Phone',
    description: 'Open QuickTransfer on your phone and scan the QR code. Both devices connect instantly.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Select a File',
    description: 'Choose any file — PDF, photo, video, document. No size limit.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Done',
    description: 'File transfers directly between devices. No login, no cloud storage, no waiting.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const FEATURES = [
  { icon: '🔒', label: 'No Login Required' },
  { icon: '⚡', label: 'Direct P2P Transfer' },
  { icon: '🌐', label: 'Works Across Networks' },
  { icon: '🗑️', label: 'Nothing Stored Permanently' },
  { icon: '📱', label: 'Any Device, Any Browser' },
  { icon: '∞', label: 'No File Size Limit' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* NAV */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">QuickTransfer</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pc" id="nav-connect-pc" className="btn-secondary text-sm py-2 px-4 hidden sm:flex">
            Connect PC
          </Link>
          <Link to="/mobile" id="nav-scan-qr" className="btn-primary text-sm py-2 px-4">
            Scan QR
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <main className="flex-1 flex flex-col">
        <section className="flex flex-col items-center justify-center text-center px-6 py-16 md:py-24 max-w-4xl mx-auto w-full">
          {/* Badge */}
          <div className="badge-info mb-6 animate-fade-in">
            <span className="status-dot waiting" />
            No login · No WhatsApp · Just scan
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 animate-slide-up"
            style={{ lineHeight: 1.05 }}>
            Transfer files{' '}
            <span className="bg-gradient-to-r from-brand-400 to-brand-200 bg-clip-text text-transparent">
              instantly
            </span>
          </h1>

          <p className="text-xl text-white/50 max-w-xl mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Connect your phone and PC with a QR code. Transfer any file directly — peer-to-peer, no account needed.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link
              to="/pc"
              id="hero-connect-pc"
              className="btn-primary text-base px-8 py-4 rounded-2xl w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2 2h14a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Connect PC
            </Link>
            <Link
              to="/mobile"
              id="hero-scan-qr"
              className="btn-secondary text-base px-8 py-4 rounded-2xl w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan QR on Phone
            </Link>
          </div>
        </section>

        {/* FEATURES STRIP */}
        <section className="border-y border-white/5 bg-white/2 py-6">
          <div className="max-w-5xl mx-auto px-6 overflow-x-auto">
            <div className="flex items-center justify-between gap-6 min-w-max mx-auto">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-white/50 text-sm whitespace-nowrap">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-5xl mx-auto w-full px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">How it works</h2>
            <p className="text-white/40">Four steps. No friction.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="glass-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400">
                    {item.icon}
                  </div>
                  <span className="font-mono text-xs text-white/20 font-bold">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center px-6 py-12 max-w-2xl mx-auto w-full">
          <div className="glass-card p-8 flex flex-col items-center gap-6">
            <h2 className="text-2xl font-bold text-white">Ready to transfer?</h2>
            <p className="text-white/40 text-sm">
              Open this page on your PC, then open it on your phone. That's it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Link to="/pc" id="cta-pc" className="btn-primary flex-1 py-4 rounded-2xl text-base justify-center">
                I'm on a PC
              </Link>
              <Link to="/mobile" id="cta-mobile" className="btn-secondary flex-1 py-4 rounded-2xl text-base justify-center">
                I'm on my Phone
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-8 text-white/20 text-xs border-t border-white/5">
        <p>QuickTransfer · Files go directly between your devices · Nothing stored permanently</p>
      </footer>
    </div>
  );
}
