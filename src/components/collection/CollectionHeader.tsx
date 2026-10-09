/** Hero header for albums, playlists, mixes, artists and genres. */
import type { ReactNode } from 'react';
import { CoverImage } from '@/components/common/CoverImage';
import type { Palette } from '@/types/music';
import { cn } from '@/utils/cn';
import { rgba } from '@/utils/color';

export function CollectionHeader({
  cover,
  kind,
  title,
  description,
  meta,
  palette,
  actions,
  round = false,
}: {
  cover: string;
  kind: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  palette: Palette;
  actions?: ReactNode;
  round?: boolean;
}) {
  return (
    <header className="relative -mx-4 -mt-6 mb-8 overflow-hidden px-4 pb-8 pt-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: `linear-gradient(180deg, ${rgba(palette.a, 0.55)} 0%, ${rgba(palette.b, 0.25)} 45%, transparent 100%)` }}
        aria-hidden="true"
      />
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:text-left">
        <CoverImage
          src={cover}
          alt=""
          eager
          rounded={round ? 'rounded-full' : 'rounded-2xl'}
          className="w-48 shrink-0 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] sm:w-56 lg:w-60"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg/70">{kind}</p>
          <h1 className={cn('mt-2 font-black tracking-tight', title.length > 22 ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-4xl sm:text-5xl lg:text-6xl')}>{title}</h1>
          {description && <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-fg/75 sm:mx-0">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-fg/70 sm:justify-start">{meta}</div>}
        </div>
      </div>
      {actions && <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:justify-start">{actions}</div>}
    </header>
  );
}
