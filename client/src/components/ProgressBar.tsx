interface ProgressBarProps {
  progress: number; // 0–100
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ progress, className = '', showLabel = false }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1.5 text-xs text-white/50">
          <span>Progress</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
