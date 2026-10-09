import { Gauge } from 'lucide-react';
import { Menu } from '@/components/common/Menu';
import { usePlayer } from '@/hooks/usePlayer';
import { PLAYBACK_RATES, player } from '@/state/playerStore';
import { cn } from '@/utils/cn';

export function SpeedMenu({ tone = 'default' }: { tone?: 'default' | 'light' }) {
  const rate = usePlayer((s) => s.playbackRate);
  return (
    <Menu
      label="Playback speed"
      align="end"
      items={PLAYBACK_RATES.map((r) => ({
        label: r === 1 ? 'Normal (1×)' : `${r}×`,
        checked: r === rate,
        onSelect: () => player.setRate(r),
      }))}
      trigger={(props) => (
        <button
          {...props}
          aria-label={`Playback speed ${rate}×`}
          title="Playback speed (lyrics stay in sync)"
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold tabular-nums transition',
            tone === 'light' ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-fg/[0.07] hover:text-fg',
            rate !== 1 && (tone === 'light' ? '!text-white' : '!text-primary'),
          )}
        >
          <Gauge className="h-4 w-4" />
          {rate}×
        </button>
      )}
    />
  );
}
