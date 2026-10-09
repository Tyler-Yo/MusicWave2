/** Play / Shuffle buttons for a collection. */
import { Shuffle } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { PlayPauseGlyph } from '@/components/common/PlayIcon';
import { usePlayer } from '@/hooks/usePlayer';
import { player } from '@/state/playerStore';
import type { PlayContext } from '@/types/music';

export function PlayActions({ trackIds, context }: { trackIds: string[]; context: PlayContext }) {
  const playing = usePlayer((s) => s.isPlaying && s.context?.type === context.type && s.context?.id === context.id);
  const isContext = usePlayer((s) => s.context?.type === context.type && s.context?.id === context.id && s.index >= 0);
  return (
    <>
      <Button
        variant="primary"
        size="lg"
        disabled={trackIds.length === 0}
        onClick={() => (isContext ? player.toggle() : player.playTracks(trackIds, 0, context, { shuffle: false }))}
        icon={<PlayPauseGlyph playing={playing} className="h-5 w-5" />}
      >
        {playing ? 'Pause' : 'Play'}
      </Button>
      <Button size="lg" disabled={trackIds.length === 0} onClick={() => player.playTracks(trackIds, -1, context, { shuffle: true })} icon={<Shuffle className="h-4 w-4" />}>
        Shuffle
      </Button>
    </>
  );
}
