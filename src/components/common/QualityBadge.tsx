/** Small, original quality markers: "Lossless" and "Hi-Res" pills, optionally with file details. */
import { TIER_SHORT } from '@/services/quality';
import type { QualityTier } from '@/types/music';
import { cn } from '@/utils/cn';

export function QualityBadge({
  tier,
  detail,
  tone = 'default',
  className,
  showHigh = false,
}: {
  tier: QualityTier;
  /** e.g. "24-bit / 96 kHz FLAC". */
  detail?: string;
  tone?: 'default' | 'immersive';
  className?: string;
  /** Also render a badge for the lossy tier (Now Playing); lists skip it. */
  showHigh?: boolean;
}) {
  if (tier === 'high' && !showHigh) return null;
  const label = TIER_SHORT[tier];
  const title = detail ? `${label} · ${detail}` : label;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-[0.35rem] px-1.5 py-[1px] text-[10px] font-extrabold uppercase leading-4 tracking-[0.08em]',
        tier === 'hires' && 'bg-gradient-to-r from-amber-300 to-orange-400 text-black',
        tier === 'lossless' && (tone === 'immersive' ? 'border border-white/50 text-white' : 'border border-fg/35 text-fg/80'),
        tier === 'high' && (tone === 'immersive' ? 'bg-white/15 text-white/85' : 'bg-fg/10 text-muted'),
        className,
      )}
    >
      <svg viewBox="0 0 12 8" className="h-2 w-3" aria-hidden="true">
        <path d="M0 4h2M3 1v6M5 2.5v3M7 0v8M9 2v4M11 3.5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
      {label}
      {detail && <span className="font-semibold normal-case tracking-normal opacity-80">· {detail}</span>}
    </span>
  );
}
