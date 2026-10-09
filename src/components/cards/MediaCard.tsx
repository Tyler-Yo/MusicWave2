/** Album / playlist / mix card with a hover play button. */
import { Link } from 'react-router-dom';
import { CoverImage } from '@/components/common/CoverImage';
import { PlayPauseGlyph } from '@/components/common/PlayIcon';
import { cn } from '@/utils/cn';

export function MediaCard({
  href,
  cover,
  title,
  subtitle,
  playing = false,
  onPlay,
  rounded = 'rounded-xl',
  size = 'md',
  badge,
}: {
  href: string;
  cover: string;
  title: string;
  subtitle?: string;
  playing?: boolean;
  onPlay?: () => void;
  rounded?: string;
  size?: 'md' | 'lg';
  badge?: string;
}) {
  return (
    <div role="listitem" className={cn('group shrink-0 snap-start', size === 'lg' ? 'w-52 sm:w-60' : 'w-40 sm:w-44')}>
      <div className="relative transition duration-500 ease-out-expo group-hover:-translate-y-1">
        <Link to={href} tabIndex={-1} aria-hidden="true" className="block">
          <CoverImage src={cover} alt="" rounded={rounded} className="shadow-card group-hover:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.6)]" />
        </Link>
        {badge && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            {badge}
          </span>
        )}
        {onPlay && (
          <button
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
            onClick={onPlay}
            className={cn(
              'absolute bottom-2.5 right-2.5 grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary shadow-glow transition duration-300 ease-out-expo hover:scale-105',
              playing
                ? 'translate-y-0 opacity-100'
                : 'translate-y-2 opacity-0 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-sm:translate-y-0 max-sm:opacity-100',
            )}
          >
            <PlayPauseGlyph playing={playing} className="h-5 w-5" />
          </button>
        )}
      </div>
      <Link to={href} className="mt-3 block truncate rounded text-sm font-bold hover:underline">
        {title}
      </Link>
      {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>}
    </div>
  );
}
