/** MusicWave's original mark: a rounded tile holding five wave bars under a crest. */
import { useId } from 'react';
import { cn } from '@/utils/cn';

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34E0B6" />
          <stop offset="0.55" stopColor="#4FA8FF" />
          <stop offset="1" stopColor="#8B6CFF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill={`url(#${id}g)`} />
      <path d="M9 17c5-6 10-6 15 0s10 6 15 0" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" />
      {[
        [13, 26, 34],
        [18.5, 22, 38],
        [24, 25, 35],
        [29.5, 20, 40],
        [35, 27, 33],
      ].map(([x, y1, y2]) => (
        <line key={x} x1={x} y1={y1} x2={x} y2={y2} stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-9 w-9 shrink-0 drop-shadow-[0_6px_18px_rgba(52,224,182,0.35)]" />
      {!compact && (
        <span className="text-[1.35rem] font-extrabold tracking-tight">
          Music<span className="text-gradient">Wave</span>
        </span>
      )}
    </span>
  );
}
