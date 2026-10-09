/** Transport controls shared by the mini player and Now Playing. */
import { Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { IconButton } from '@/components/common/Button';
import { PlayPauseGlyph, Spinner } from '@/components/common/PlayIcon';
import { usePlayer } from '@/hooks/usePlayer';
import { renderProgressStore } from '@/services/audioSources';
import { player } from '@/state/playerStore';
import { useStore } from '@/state/createStore';
import { cn } from '@/utils/cn';

export function PlayButton({ size = 'md', tone = 'default', trackId }: { size?: 'md' | 'lg' | 'xl'; tone?: 'default' | 'light'; trackId?: string }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const status = usePlayer((s) => s.status);
  const hasItem = usePlayer((s) => s.index >= 0);
  const progress = useStore(renderProgressStore, (s) => (trackId ? s.byTrack[trackId] : undefined));
  const loading = status === 'loading' && isPlaying;
  const dims = size === 'xl' ? 'h-[4.5rem] w-[4.5rem]' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const icon = size === 'xl' ? 'h-8 w-8' : size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  return (
    <button
      onClick={() => player.toggle()}
      disabled={!hasItem}
      aria-label={loading ? 'Loading — pause' : isPlaying ? 'Pause' : 'Play'}
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full transition duration-200 hover:scale-105 active:scale-95 disabled:opacity-40',
        tone === 'light' ? 'bg-white text-black shadow-[0_10px_30px_-8px_rgba(255,255,255,0.5)]' : 'bg-fg text-bg',
        dims,
      )}
    >
      {loading ? <Spinner className={cn(icon, 'opacity-90')} progress={progress} /> : <PlayPauseGlyph playing={isPlaying} className={icon} />}
    </button>
  );
}

export function TransportControls({ size = 'md', tone = 'default', trackId }: { size?: 'md' | 'lg'; tone?: 'default' | 'light'; trackId?: string }) {
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const big = size === 'lg';
  const icon = big ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  const light = tone === 'light' ? 'text-white/75 hover:text-white hover:bg-white/10' : '';
  const activeLight = tone === 'light' ? '!text-white' : '';
  return (
    <div className={cn('flex items-center', big ? 'gap-3 sm:gap-5' : 'gap-1.5')}>
      <IconButton label={shuffle ? 'Shuffle on' : 'Shuffle off'} aria-pressed={shuffle} active={shuffle} onClick={() => player.toggleShuffle()} size={big ? 'lg' : 'md'} className={cn(light, shuffle && activeLight)}>
        <Shuffle className={big ? 'h-5 w-5' : 'h-4 w-4'} />
      </IconButton>
      <IconButton label="Previous" onClick={() => player.previous()} size={big ? 'lg' : 'md'} className={light}>
        <SkipBack className={icon} fill="currentColor" />
      </IconButton>
      <PlayButton size={big ? 'xl' : 'md'} tone={tone} trackId={trackId} />
      <IconButton label="Next" onClick={() => player.next()} size={big ? 'lg' : 'md'} className={light}>
        <SkipForward className={icon} fill="currentColor" />
      </IconButton>
      <IconButton
        label={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
        aria-pressed={repeat !== 'off'}
        active={repeat !== 'off'}
        onClick={() => player.cycleRepeat()}
        size={big ? 'lg' : 'md'}
        className={cn(light, repeat !== 'off' && activeLight)}
      >
        {repeat === 'one' ? <Repeat1 className={big ? 'h-5 w-5' : 'h-4 w-4'} /> : <Repeat className={big ? 'h-5 w-5' : 'h-4 w-4'} />}
      </IconButton>
    </div>
  );
}
