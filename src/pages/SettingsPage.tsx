import { useEffect, useState, type ReactNode } from 'react';
import { HardDrive, Info, Keyboard, Monitor, Moon, Music2, Palette, RotateCcw, Sun, Timer, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Slider } from '@/components/common/Slider';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useSettings } from '@/hooks/usePlayer';
import { clearRenderCache } from '@/services/audioSources';
import { offlineStore } from '@/services/offlineStore';
import { disablePersistence } from '@/services/storage';
import { settingsActions, type SettingsState } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import { cn } from '@/utils/cn';
import { formatBytes, formatOffset } from '@/utils/format';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line/60 bg-fg/[0.025] p-5 sm:p-6" aria-labelledby={`s-${title}`}>
      <h2 id={`s-${title}`} className="mb-5 flex items-center gap-2.5 text-lg font-extrabold">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ k, label }: { k: keyof SettingsState; label: string }) {
  const value = useSettings((s) => s[k] as boolean);
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold">
      <input type="checkbox" role="switch" aria-label={label} checked={value} onChange={(e) => settingsActions.set(k, e.target.checked as never)} className="peer sr-only" />
      <span className="relative h-7 w-12 rounded-full bg-fg/20 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; icon?: ReactNode }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-fg/[0.07] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition', value === o.value ? 'bg-fg text-bg' : 'text-muted hover:text-fg')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const theme = useSettings((s) => s.theme);
  const motion = useSettings((s) => s.motion);
  const name = useSettings((s) => s.userName);
  const latency = useSettings((s) => s.outputLatency);
  const scale = useSettings((s) => s.lyricsScale);
  const offsets = useSettings((s) => s.lyricsOffsets);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    void offlineStore.estimate().then(setStorage);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-4xl font-black tracking-tight">Settings</h1>

      <Section icon={<UserRound />} title="Profile">
        <Row label="Display name" hint="Used in your greeting on Home.">
          <input
            value={name}
            onChange={(e) => settingsActions.set('userName', e.target.value.slice(0, 40))}
            aria-label="Display name"
            className="h-10 w-56 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-primary"
          />
        </Row>
      </Section>

      <Section icon={<Palette />} title="Appearance">
        <Row label="Theme">
          <Segmented
            label="Theme"
            value={theme}
            onChange={(v) => settingsActions.set('theme', v)}
            options={[
              { value: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
              { value: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
              { value: 'system', label: 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
            ]}
          />
        </Row>
        <Row label="Motion" hint="Reduce animations such as the spinning vinyl and lyric transitions.">
          <Segmented
            label="Motion"
            value={motion}
            onChange={(v) => settingsActions.set('motion', v)}
            options={[
              { value: 'system', label: 'System' },
              { value: 'full', label: 'Full' },
              { value: 'reduce', label: 'Reduced' },
            ]}
          />
        </Row>
        <Row label="Vinyl artwork" hint="Show a spinning record behind the cover in Now Playing.">
          <Toggle k="vinylArt" label="Vinyl artwork" />
        </Row>
      </Section>

      <Section icon={<Music2 />} title="Lyrics">
        <Row label="Karaoke mode" hint="Bigger centered lines, word glow, bouncing ball and interlude countdowns.">
          <Toggle k="karaoke" label="Karaoke mode" />
        </Row>
        <Row label="Lyrics in the mini player" hint="Shows the current line when the window is wide enough.">
          <Toggle k="miniLyrics" label="Lyrics in the mini player" />
        </Row>
        <Row label={`Text size · ${Math.round(scale * 100)}%`}>
          <Slider label="Lyrics text size" min={0.8} max={1.5} step={0.05} value={scale} valueText={`${Math.round(scale * 100)} percent`} onChange={(v) => settingsActions.set('lyricsScale', v)} className="w-48" />
        </Row>
        <Row label={`Audio latency compensation · ${formatOffset(latency)}`} hint="Bluetooth headphones delay sound by 0.1–0.3 s. Increase this until lyrics match what you hear. Applies to every song.">
          <div className="flex items-center gap-2">
            <Slider label="Audio latency compensation" min={-0.5} max={0.5} step={0.01} value={latency} valueText={formatOffset(latency)} onChange={(v) => settingsActions.set('outputLatency', Math.round(v * 100) / 100)} className="w-48" />
            <Button size="sm" variant="ghost" onClick={() => settingsActions.set('outputLatency', 0)} aria-label="Reset latency compensation">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </Row>
        <Row label="Per-song offsets" hint={`${Object.keys(offsets).length} song(s) have a custom sync offset (set with − / + in the lyrics view or [ and ]).`}>
          <Button size="sm" disabled={!Object.keys(offsets).length} onClick={() => settingsActions.set('lyricsOffsets', {})}>
            Reset all
          </Button>
        </Row>
      </Section>

      <Section icon={<HardDrive />} title="Playback & storage">
        <Row label="Offline mode" hint="Simulate no connection — only downloads and uploads can play.">
          <Toggle k="offlineMode" label="Offline mode" />
        </Row>
        <Row label="Cache rendered songs" hint="Demo songs are synthesized in your browser. Caching the last few makes replays instant.">
          <Toggle k="cacheRenders" label="Cache rendered songs" />
        </Row>
        <Row label="Browser storage" hint={storage ? `${formatBytes(storage.usage)} used of ${formatBytes(storage.quota)} available` : 'Storage estimate unavailable'}>
          <Button size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void clearRenderCache().then(() => ui.toast('Render cache cleared', 'success'))}>
            Clear cache
          </Button>
        </Row>
      </Section>

      <Section icon={<Keyboard />} title="Keyboard shortcuts">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {SHORTCUTS.map(([key, action]) => (
            <div key={key} className="flex items-center justify-between gap-3 border-b border-line/40 py-1.5">
              <dt className="text-muted">{action}</dt>
              <dd>
                <kbd className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs font-semibold">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section icon={<Info />} title="About MusicWave">
        <p className="text-sm leading-relaxed text-muted">
          MusicWave is an original demo streaming app. Every song, lyric, artist, cover and logo here was created for this project: the music is composed as data and synthesized live in your browser, the artwork is generated SVG, and the lyrics are original. Icons are from Lucide (ISC license); the typeface is Plus Jakarta Sans (SIL Open Font License).
        </p>
        <Row label="Reset everything" hint="Clears your library, playlists, settings and saved lyrics on this device.">
          <Button
            size="sm"
            variant="danger"
            icon={<Timer className="h-4 w-4" />}
            onClick={() => {
              if (!window.confirm('Reset all MusicWave data on this device?')) return;
              disablePersistence();
              try {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith('musicwave:'))
                  .forEach((k) => localStorage.removeItem(k));
              } catch {
                /* ignore */
              }
              void clearRenderCache().finally(() => window.location.assign('/'));
            }}
          >
            Reset
          </Button>
        </Row>
      </Section>
    </div>
  );
}
