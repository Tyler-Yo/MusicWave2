import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '@/components/common/Button';
import { Slider } from '@/components/common/Slider';
import { usePlayer } from '@/hooks/usePlayer';
import { player } from '@/state/playerStore';
import { cn } from '@/utils/cn';

export function VolumeControl({ tone = 'default', className }: { tone?: 'default' | 'light'; className?: string }) {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const v = muted ? 0 : volume;
  const Icon = v === 0 ? VolumeX : v < 0.34 ? Volume : v < 0.67 ? Volume1 : Volume2;
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={() => player.toggleMute()} size="sm" className={tone === 'light' ? 'text-white/75 hover:bg-white/10 hover:text-white' : ''}>
        <Icon className="h-[18px] w-[18px]" />
      </IconButton>
      <Slider
        label="Volume"
        value={v}
        valueText={`${Math.round(v * 100)}%`}
        onChange={(x) => player.setVolume(x)}
        className={cn('w-24', tone === 'light' && '[--active:white] [--track:rgb(255_255_255/0.25)] hover:[--active:white]')}
      />
    </div>
  );
}
