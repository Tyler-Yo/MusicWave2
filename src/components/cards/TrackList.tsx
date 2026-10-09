import { useCallback } from 'react';
import { player } from '@/state/playerStore';
import { playerStore } from '@/state/playerStore';
import type { PlayContext, Track } from '@/types/music';
import { TrackRow, type TrackRowProps } from './TrackRow';

/** A list of tracks that plays in context: clicking a row queues the whole list from that row. */
export function TrackList({
  tracks,
  context,
  showCover = true,
  showAlbum = true,
  showArtist = true,
  rank = false,
  onRemove,
  header = true,
}: {
  tracks: Track[];
  context: PlayContext;
  onRemove?: (index: number) => void;
  header?: boolean;
} & Pick<TrackRowProps, 'showCover' | 'showAlbum' | 'showArtist' | 'rank'>) {
  const play = useCallback(
    (i: number) => {
      const s = playerStore.get();
      const current = s.queue[s.index];
      if (current?.trackId === tracks[i].id && s.context?.type === context.type && s.context?.id === context.id) {
        player.toggle();
        return;
      }
      player.playTracks(
        tracks.map((t) => t.id),
        i,
        context,
      );
    },
    [tracks, context],
  );

  return (
    <div role="list" aria-label={`${context.name} tracks`}>
      {header && (
        <div className="mb-1 hidden grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 border-b border-line/60 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-subtle md:grid">
          <span className="text-center">#</span>
          <span>Title</span>
          <span>{showAlbum ? 'Album' : ''}</span>
          <span className="pr-10 text-right">Time</span>
        </div>
      )}
      {tracks.map((t, i) => (
        <div role="listitem" key={`${t.id}-${i}`}>
          <TrackRow
            track={t}
            index={i}
            onPlay={() => play(i)}
            showCover={showCover}
            showAlbum={showAlbum}
            showArtist={showArtist}
            rank={rank}
            onRemove={onRemove ? () => onRemove(i) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
