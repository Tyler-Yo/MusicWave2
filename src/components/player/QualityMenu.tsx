/**
 * Quality badge for the current online track. Shows exactly what is playing
 * (e.g. "Hi-Res · 24-bit / 96 kHz FLAC") and lets the listener switch tier for
 * this song without losing their place.
 */
import { useNavigate } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Menu, type MenuItem } from '@/components/common/Menu';
import { QualityBadge } from '@/components/common/QualityBadge';
import { usePlayer, useSettings } from '@/hooks/usePlayer';
import { TIER_LABEL, TIER_ORDER, variantDetail } from '@/services/quality';
import { availableTiers, mayBeHiRes, playbackQualityStore } from '@/services/remoteAudio';
import { useStore } from '@/state/createStore';
import { player } from '@/state/playerStore';
import { ui } from '@/state/uiStore';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';

export function QualityMenu({ track, tone = 'immersive', compact = false }: { track: Track; tone?: 'immersive' | 'default'; compact?: boolean }) {
  const navigate = useNavigate();
  const quality = useStore(playbackQualityStore, (s) => (s.trackId === track.id ? s : null));
  const override = useStore(playbackQualityStore, (s) => (s.override?.trackId === track.id ? s.override.tier : null));
  const preferred = useSettings((s) => s.streamingQuality);
  const loading = usePlayer((s) => s.status === 'loading');
  if (track.source.kind !== 'remote') return null;
  // Nothing loaded yet (e.g. a restored session): only the full player shows the preference.
  if (!quality?.variant && !loading && compact) return null;

  const variant = quality?.variant ?? null;
  const requested = override ?? preferred;
  const tiers = availableTiers(track);
  const hiResPossible = tiers.includes('hires') || mayBeHiRes(track);
  const detail = variant ? variantDetail(variant) : undefined;

  const items: MenuItem[] = TIER_ORDER.map((tier) => {
    const available = tier === 'hires' ? hiResPossible : tiers.includes(tier);
    const note = tier === 'hires' && !tiers.includes('hires') && hiResPossible ? ' (if the file is Hi-Res)' : !available ? ' — not available' : '';
    return {
      label: `${TIER_LABEL[tier]}${note}`,
      checked: requested === tier,
      disabled: !available,
      onSelect: () => player.setQuality(tier),
    };
  });
  if (quality?.origin === 'download') items.unshift({ label: 'Playing your downloaded copy', disabled: true });
  items.push({
    label: 'Quality settings…',
    icon: <Settings2 />,
    divider: true,
    onSelect: () => {
      ui.closeNowPlaying();
      navigate('/settings#audio-quality');
    },
  });

  return (
    <Menu
      label="Audio quality"
      align="start"
      items={items}
      trigger={(props) => (
        <button
          {...props}
          aria-label={`Audio quality: ${variant ? `${TIER_LABEL[variant.tier]}${detail ? `, ${detail}` : ''}` : loading ? 'loading' : `${TIER_LABEL[requested]} preferred`}. Change quality`}
          className={cn('inline-flex max-w-full items-center rounded-lg p-1 transition', tone === 'immersive' ? 'hover:bg-white/10' : 'hover:bg-fg/10')}
        >
          {variant ? (
            <QualityBadge tier={variant.tier} detail={compact ? undefined : detail} tone={tone} showHigh />
          ) : (
            <span className={cn('text-[11px] font-semibold', tone === 'immersive' ? 'text-white/60' : 'text-muted')}>
              {loading ? 'Choosing quality…' : `${TIER_LABEL[requested]} preferred`}
            </span>
          )}
        </button>
      )}
    />
  );
}
