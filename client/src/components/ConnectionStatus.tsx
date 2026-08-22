import type { ConnectionState } from '@/types';

interface ConnectionStatusProps {
  state: ConnectionState;
  error?: string | null;
  className?: string;
}

const STATE_CONFIG: Record<ConnectionState, {
  dot: string;
  label: string;
  badge: string;
  icon: string;
}> = {
  idle:         { dot: 'idle',      label: 'Not connected',              badge: 'badge-info',    icon: '○' },
  creating:     { dot: 'waiting',   label: 'Creating session...',         badge: 'badge-warning', icon: '⟳' },
  waiting:      { dot: 'waiting',   label: 'Waiting for device...',       badge: 'badge-warning', icon: '⏳' },
  connecting:   { dot: 'waiting',   label: 'Connecting...',               badge: 'badge-warning', icon: '⟳' },
  connected:    { dot: 'connected', label: 'Connected ✓',                 badge: 'badge-success', icon: '✓' },
  'ws-fallback':{ dot: 'connected', label: 'Connected (relay mode)',      badge: 'badge-success', icon: '✓' },
  disconnected: { dot: 'idle',      label: 'Disconnected',                badge: 'badge-info',    icon: '○' },
  error:        { dot: 'error',     label: 'Connection error',            badge: 'badge-error',   icon: '✗' },
};

export function ConnectionStatus({ state, error, className = '' }: ConnectionStatusProps) {
  const cfg = STATE_CONFIG[state];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className={`${cfg.badge} text-sm font-medium`}>
        <span className={`status-dot ${cfg.dot}`} />
        {cfg.label}
      </div>
      {error && state === 'error' && (
        <p className="text-red-400/80 text-xs text-center max-w-xs px-2">{error}</p>
      )}
      {state === 'ws-fallback' && (
        <p className="text-amber-400/70 text-xs text-center max-w-xs">
          Direct P2P failed. Using server relay. Transfer still works but may be slower.
        </p>
      )}
    </div>
  );
}
