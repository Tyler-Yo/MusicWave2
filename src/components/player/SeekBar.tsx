/**
 * Seek bar with time labels. While dragging, the label previews the target time
 * and the audio is only seeked on release (no stutter). Optional waveform mode
 * draws the track's analyzed peaks.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Slider } from '@/components/common/Slider';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { usePlayer } from '@/hooks/usePlayer';
import { getAudioEngine } from '@/services/audioEngine';
import { analysisStore } from '@/services/audioSources';
import { useStore } from '@/state/createStore';
import { isCurrentLoaded, pendingPosition, player } from '@/state/playerStore';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { formatTime, speakTime } from '@/utils/format';

function useDuration(track: Track | undefined): number {
  const [duration, setDuration] = useState(track?.duration ?? 0);
  useEffect(() => {
    setDuration(track?.duration ?? 0);
    const engine = getAudioEngine();
    const update = () => {
      const d = engine.duration;
      if (Number.isFinite(d) && d > 0 && isCurrentLoaded()) setDuration(d);
    };
    update();
    return engine.on('durationchange', update);
  }, [track]);
  return duration;
}

function Waveform({ peaks, progress, className }: { peaks: number[]; progress: number; className?: string }) {
  const bars = 120;
  const step = peaks.length / bars;
  return (
    <div className={cn('pointer-events-none flex h-full items-center gap-[2px]', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        let v = 0;
        for (let k = Math.floor(i * step); k < Math.floor((i + 1) * step); k++) v = Math.max(v, peaks[k] ?? 0);
        const played = (i + 0.5) / bars <= progress;
        return (
          <span
            key={i}
            className={cn('flex-1 rounded-full transition-colors duration-150', played ? 'bg-current' : 'bg-current opacity-25')}
            style={{ height: `${Math.max(8, Math.pow(v, 0.8) * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

export function SeekBar({ track, variant = 'default', className }: { track: Track | undefined; variant?: 'default' | 'waveform' | 'light'; className?: string }) {
  const live = usePlaybackTime(15);
  const status = usePlayer((s) => s.status);
  const duration = useDuration(track);
  const [drag, setDrag] = useState<number | null>(null);
  const peaks = useStore(analysisStore, (s) => (track ? s.byTrack[track.id]?.peaks : undefined));
  const dragging = useRef(false);

  const time = drag ?? (isCurrentLoaded() ? live : pendingPosition());
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const light = variant !== 'default';

  const commit = (v: number) => {
    dragging.current = false;
    setDrag(null);
    player.seek(v);
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="relative">
        {variant === 'waveform' && peaks && (
          <div className="absolute inset-x-0 -top-7 h-8 text-white/90">
            <Waveform peaks={peaks} progress={progress} />
          </div>
        )}
        <Slider
          label="Seek"
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          value={Math.min(time, duration || time)}
          valueText={`${speakTime(time)} of ${speakTime(duration)}`}
          disabled={!track}
          onChange={(v) => {
            dragging.current = true;
            setDrag(v);
          }}
          onCommit={(v) => dragging.current && commit(v)}
          className={cn(light && '[--active:white] [--track:rgb(255_255_255/0.25)] hover:[--active:white]')}
          style={{ '--track': light ? 'rgb(255 255 255 / 0.22)' : undefined } as CSSProperties}
        />
      </div>
      <div className={cn('mt-0.5 flex justify-between text-[11px] font-medium tabular-nums', light ? 'text-white/70' : 'text-subtle')}>
        <span>{formatTime(time)}</span>
        {status === 'loading' ? <span className="animate-pulse">Preparing audio…</span> : null}
        <span>-{formatTime(Math.max(0, duration - time))}</span>
      </div>
    </div>
  );
}
