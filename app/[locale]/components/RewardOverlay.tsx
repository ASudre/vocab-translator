import { useEffect } from 'react';

type RewardKind = 'mastered' | 'level';

interface RewardOverlayProps {
  kind: RewardKind;
  onDone: () => void;
}

export function RewardOverlay({ kind, onDone }: RewardOverlayProps) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDone();
    }, kind === 'level' ? 1600 : 1200);

    return () => window.clearTimeout(timeout);
  }, [kind, onDone]);

  const title = kind === 'level' ? 'A1 terminé' : 'Mot validé';

  return (
    <div className="reward-overlay" aria-hidden>
      <div className="reward-backdrop" />

      <div className="reward-center">
        <div className={kind === 'level' ? 'reward-badge reward-badge-level' : 'reward-badge'}>
          <div className="reward-icon">
            <svg className="reward-check" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="reward-title">{title}</div>
        </div>

        <div className={kind === 'level' ? 'reward-burst reward-burst-level' : 'reward-burst'}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="reward-particle" />
          ))}
        </div>
      </div>
    </div>
  );
}
