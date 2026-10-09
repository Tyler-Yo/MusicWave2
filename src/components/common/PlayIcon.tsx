/** Play ⇄ pause glyph that morphs between states, plus a loading ring. */
import { cn } from '@/utils/cn';

export function PlayPauseGlyph({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        style={{ transition: 'd 220ms cubic-bezier(0.16,1,0.3,1)' }}
        d={
          playing
            ? 'M6.2 4.5 L10.2 4.5 L10.2 19.5 L6.2 19.5 Z M13.8 4.5 L17.8 4.5 L17.8 19.5 L13.8 19.5 Z'
            : 'M7.5 4.2 L13.6 8.1 L13.6 15.9 L7.5 19.8 Z M13.6 8.1 L19.6 12 L19.6 12 L13.6 15.9 Z'
        }
      />
    </svg>
  );
}

export function Spinner({ className, progress }: { className?: string; progress?: number }) {
  const p = progress === undefined ? 0.28 : Math.max(0.04, Math.min(1, progress));
  return (
    <svg viewBox="0 0 24 24" className={cn(progress === undefined && 'animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${p * 59.7} 59.7`}
        transform="rotate(-90 12 12)"
        style={{ transition: 'stroke-dasharray 200ms ease' }}
      />
    </svg>
  );
}

/** Animated equalizer bars shown next to the playing track. */
export function Equalizer({ playing = true, className }: { playing?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-[2px]', className)} aria-hidden="true">
      {[0, 180, 360, 90].map((delay, i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-full bg-primary', playing ? 'eq-bar' : '')}
          style={{ height: playing ? '100%' : `${[40, 70, 55, 30][i]}%`, animationDelay: `-${delay}ms`, animationDuration: `${700 + i * 120}ms` }}
        />
      ))}
    </span>
  );
}
