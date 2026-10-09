/**
 * Lyrics Studio — write, tap-sync, fine-tune, import and export LRC lyrics.
 *
 * Workflow: pick a track → paste lyrics → press "Start syncing" → tap (Enter / T / ↓)
 * at the start of every line (or every word in word mode). Backspace undoes, B marks
 * an instrumental break. Slow the playback down for tricky passages: timestamps are
 * always taken in song time, so they stay correct at any speed. The live preview on
 * the right uses the exact same sync engine as the player.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCopy,
  Download,
  FileUp,
  Keyboard,
  ListRestart,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Save,
  Timer,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { CoverImage } from '@/components/common/CoverImage';
import { Slider } from '@/components/common/Slider';
import { LyricsView } from '@/components/lyrics/LyricsView';
import { SeekBar } from '@/components/player/SeekBar';
import { SpeedMenu } from '@/components/player/SpeedMenu';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { useCurrentTrack, useIsCurrent, useLibrary, useLyricsState, usePlayer, useSettings } from '@/hooks/usePlayer';
import { allTracks, artistNameOf, getTrack, trackCover } from '@/services/catalog';
import { lyricsSourceFor, originalLyricsFor, parseCached } from '@/services/lyrics';
import {
  applyTap,
  draftStats,
  draftToLyrics,
  linesFromLyrics,
  linesFromText,
  nextCursor,
  textOf,
  undoLast,
  type Cursor,
  type DraftLine,
  type TapMode,
} from '@/services/lrc/draft';
import { parseLrc } from '@/services/lrc/parser';
import { serializeLrc } from '@/services/lrc/serializer';
import { formatLrcTime, parseLooseTime } from '@/services/lrc/time';
import { currentPlaybackTime } from '@/services/playbackTicker';
import { lyricsActions, lyricsStore } from '@/state/lyricsStore';
import { player } from '@/state/playerStore';
import { settingsActions } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { copyToClipboard, downloadText, pickFiles, readFileAsText, slugify } from '@/utils/files';

const SAMPLE = `Paste your lyrics here — one line per lyric line.
Then press “Start syncing” and tap along.`;

function initialDraft(track: Track | undefined): DraftLine[] {
  if (!track) return [];
  const draft = lyricsStore.get().draft;
  if (draft && draft.trackId === track.id && draft.text.trim()) {
    const parsed = draft.lrc ? parseLrc(draft.lrc) : null;
    const timed = parsed && parsed.kind !== 'plain' ? linesFromLyrics(parsed) : [];
    return linesFromText(draft.text, timed);
  }
  const src = lyricsSourceFor(track);
  return src ? linesFromLyrics(parseCached(src.lrc)) : [];
}

function TrackPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  useLibrary((s) => s.uploads);
  const tracks = allTracks();
  return (
    <label className="block text-sm font-semibold">
      Track
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-medium outline-none focus:border-primary"
      >
        {!value && <option value="">Choose a track…</option>}
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title} — {artistNameOf(t)}
            {t.lyricsId ? ' (has lyrics)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function TimeField({ value, onCommit, label }: { value: number | null; onCommit: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value === null ? '' : formatLrcTime(value));
  useEffect(() => setText(value === null ? '' : formatLrcTime(value)), [value]);
  return (
    <input
      value={text}
      placeholder="--:--.--"
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (!text.trim()) return onCommit(null);
        const t = parseLooseTime(text);
        if (Number.isFinite(t)) onCommit(t);
        else setText(value === null ? '' : formatLrcTime(value));
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-8 w-[5.6rem] rounded-lg border border-line bg-surface px-2 text-center font-mono text-xs tabular-nums outline-none focus:border-primary"
    />
  );
}

export default function LyricsStudioPage() {
  const [params, setParams] = useSearchParams();
  const current = useCurrentTrack();
  const trackId = params.get('track') ?? current?.id ?? '';
  const track = trackId ? getTrack(trackId) : undefined;
  const { current: isLoaded, playing } = useIsCurrent(trackId);
  const tapCompensation = useSettings((s) => s.tapCompensation);
  const status = usePlayer((s) => s.status);
  useLyricsState((s) => s.overrides);

  const [lines, setLines] = useState<DraftLine[]>(() => initialDraft(track));
  const [mode, setMode] = useState<TapMode>('line');
  const [tab, setTab] = useState<'sync' | 'lrc'>('sync');
  const [rawLrc, setRawLrc] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const [flash, setFlash] = useState(0);
  const [cursorOverride, setCursorOverride] = useState<Cursor | null>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const now = usePlaybackTime(8);

  // Reload the draft when the track changes.
  useEffect(() => {
    setLines(initialDraft(track));
    setCursorOverride(null);
    setRawDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // Make sure the selected track is the one in the player.
  useEffect(() => {
    if (track && !isLoaded) player.cue(track.id, { type: 'queue', name: 'Lyrics Studio', href: `/studio?track=${track.id}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const metadata = useMemo(
    () => ({ title: track?.title, artist: track ? artistNameOf(track) : undefined, by: 'MusicWave Lyrics Studio' }),
    [track],
  );
  const preview = useMemo(() => draftToLyrics(lines, metadata), [lines, metadata]);
  const enhanced = preview?.kind === 'enhanced';
  const lrcOut = useMemo(() => (preview ? serializeLrc(preview, { mode: enhanced ? 'enhanced' : 'standard', metadata }) : ''), [preview, enhanced, metadata]);
  const stats = draftStats(lines);
  const cursor = cursorOverride ?? nextCursor(lines, mode);

  // Autosave the draft so a refresh never loses work.
  useEffect(() => {
    if (!track) return;
    const id = setTimeout(() => lyricsActions.setDraft({ trackId: track.id, text: textOf(lines), lrc: lrcOut }), 400);
    return () => clearTimeout(id);
  }, [lines, lrcOut, track]);

  useEffect(() => {
    if (!rawDirty) setRawLrc(lrcOut);
  }, [lrcOut, rawDirty]);

  const tap = useCallback(() => {
    if (!cursor || !isLoaded) return;
    const t = Math.max(0, currentPlaybackTime() - tapCompensation);
    setLines((ls) => applyTap(ls, cursor, mode, t));
    setCursorOverride(null);
    setFlash((f) => f + 1);
  }, [cursor, isLoaded, tapCompensation, mode]);

  const undo = useCallback(() => {
    setLines((ls) => undoLast(ls, mode) ?? ls);
    setCursorOverride(null);
  }, [mode]);

  const markBreak = useCallback(() => {
    if (!isLoaded) return;
    const t = Math.max(0, currentPlaybackTime() - tapCompensation);
    setLines((ls) => {
      let idx = -1;
      ls.forEach((l, i) => l.time !== null && l.time <= t && (idx = i));
      if (idx < 0) return ls;
      return ls.map((l, i) => (i === idx ? { ...l, end: t } : l));
    });
    ui.toast('Instrumental break marked');
  }, [isLoaded, tapCompensation]);

  const onPadKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 't' || e.key === 'T' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      tap();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undo();
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      e.stopPropagation();
      markBreak();
    }
  };

  const startSyncing = (fromStart: boolean) => {
    if (!track) return;
    if (fromStart) {
      setLines((ls) => ls.map((l) => ({ ...l, time: null, end: null, words: l.words.map((w) => ({ ...w, time: null })) })));
      setCursorOverride(null);
      player.seek(0);
    }
    player.play();
    padRef.current?.focus();
  };

  const resumeFrom = (i: number) => {
    const line = lines[i];
    setCursorOverride({ line: i, word: 0 });
    const prev = lines.slice(0, i).reverse().find((l) => l.time !== null);
    player.seek(Math.max(0, (line.time ?? prev?.time ?? 0) - 2.5));
    padRef.current?.focus();
  };

  const updateLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = () => {
    if (!track || !lrcOut) return;
    lyricsActions.saveOverride(track.id, lrcOut, 'studio');
    ui.toast(`Lyrics saved to “${track.title}”`, 'success', { label: 'Open lyrics', run: () => ui.openNowPlaying('lyrics') });
  };

  const importLrc = async () => {
    const [file] = await pickFiles('.lrc,.txt,text/plain');
    if (!file) return;
    const text = await readFileAsText(file);
    const parsed = parseLrc(text);
    if (parsed.lines.length === 0) return ui.toast('No lyric lines found in that file.', 'error');
    setLines(linesFromLyrics(parsed));
    setRawDirty(false);
    ui.toast(`Imported ${parsed.lines.length} lines (${parsed.kind === 'enhanced' ? 'word-synced' : parsed.kind === 'standard' ? 'line-synced' : 'not synced yet'})`, 'success');
  };

  const applyRaw = () => {
    const parsed = parseLrc(rawLrc);
    setLines(linesFromLyrics(parsed));
    setRawDirty(false);
    ui.toast(parsed.warnings.length ? `Applied with ${parsed.warnings.length} warning(s)` : 'LRC applied', parsed.warnings.length ? 'info' : 'success');
  };

  const rawParsed = useMemo(() => (rawDirty ? parseLrc(rawLrc) : null), [rawDirty, rawLrc]);
  const cursorLine = cursor ? lines[cursor.line] : undefined;
  const prevStamped = useMemo(() => {
    let best: DraftLine | undefined;
    for (const l of lines) if (l.time !== null && l.time <= now + 0.05 && (!best || (l.time ?? 0) >= (best.time ?? 0))) best = l;
    return best;
  }, [lines, now]);

  if (!track) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-4xl font-black tracking-tight">Lyrics Studio</h1>
        <p className="text-muted">Choose a track to write and synchronize lyrics for.</p>
        <TrackPicker value="" onChange={(id) => setParams({ track: id })} />
      </div>
    );
  }

  const original = originalLyricsFor(track);
  const hasOverride = Boolean(lyricsStore.get().overrides[track.id]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Wand2 className="h-4 w-4" /> Lyrics Studio
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Tap-to-sync editor</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Paste lyrics, play the song and tap at the start of each line or word. Export standard or enhanced LRC, or save straight to the track.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FileUp className="h-4 w-4" />} onClick={() => void importLrc()}>
            Import .lrc
          </Button>
          <Button
            icon={<Download className="h-4 w-4" />}
            disabled={!lrcOut}
            onClick={() => downloadText(`${slugify(`${artistNameOf(track)} ${track.title}`)}.lrc`, lrcOut, 'application/x-lrc;charset=utf-8')}
          >
            Export .lrc
          </Button>
          <Button variant="primary" icon={<Save className="h-4 w-4" />} disabled={!lrcOut} onClick={save}>
            Save to track
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* ---------------------------------------------------------------- editor */}
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 rounded-2xl border border-line/60 bg-fg/[0.03] p-4 sm:grid-cols-[auto_1fr]">
            <CoverImage src={trackCover(track)} alt="" className="hidden h-24 w-24 sm:block" />
            <div className="min-w-0 space-y-3">
              <TrackPicker value={track.id} onChange={(id) => setParams({ track: id })} />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={playing ? 'secondary' : 'primary'} icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} onClick={() => player.toggle()}>
                  {playing ? 'Pause' : status === 'loading' ? 'Loading…' : 'Play'}
                </Button>
                <Button size="sm" icon={<Rewind className="h-4 w-4" />} onClick={() => player.seekBy(-5)}>
                  −5s
                </Button>
                <SpeedMenu />
                <span className="ml-auto text-xs text-subtle">Tip: slow down to 0.75× for fast verses — timestamps stay exact.</span>
              </div>
              <SeekBar track={track} />
            </div>
          </div>

          <div role="tablist" aria-label="Editor mode" className="flex gap-2">
            {(['sync', 'lrc'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn('h-9 rounded-full px-4 text-sm font-semibold', tab === t ? 'bg-fg text-bg' : 'bg-fg/[0.07] text-muted hover:text-fg')}
              >
                {t === 'sync' ? 'Write & tap-sync' : 'Raw LRC'}
              </button>
            ))}
          </div>

          {tab === 'sync' ? (
            <>
              <label className="block text-sm font-semibold">
                Lyrics text
                <textarea
                  value={textOf(lines)}
                  onChange={(e) => setLines((ls) => linesFromText(e.target.value, ls))}
                  placeholder={SAMPLE}
                  rows={6}
                  spellCheck
                  className="mt-1.5 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary"
                />
              </label>

              {/* Tap pad */}
              <div className="rounded-2xl border border-line/60 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div role="radiogroup" aria-label="Tap granularity" className="flex rounded-full bg-fg/[0.07] p-1">
                    {(['line', 'word'] as const).map((m) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => {
                          setMode(m);
                          setCursorOverride(null);
                        }}
                        className={cn('h-8 rounded-full px-4 text-sm font-semibold', mode === m ? 'bg-fg text-bg' : 'text-muted')}
                      >
                        {m === 'line' ? 'Per line' : 'Per word (enhanced)'}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="primary" icon={<Timer className="h-4 w-4" />} disabled={lines.length === 0} onClick={() => startSyncing(true)}>
                    Start syncing from 0:00
                  </Button>
                  <Button size="sm" icon={<Play className="h-4 w-4" />} disabled={lines.length === 0} onClick={() => startSyncing(false)}>
                    Continue
                  </Button>
                </div>

                <div
                  ref={padRef}
                  tabIndex={0}
                  role="group"
                  aria-label="Tap pad. Press Enter, T or Down arrow to stamp the next line or word, Backspace to undo, B to mark an instrumental break. Space plays or pauses."
                  onKeyDown={onPadKey}
                  onClick={tap}
                  className="relative mt-4 cursor-pointer select-none overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-bg/60 px-5 py-6 text-center outline-none transition focus:border-primary focus:bg-bg/80"
                >
                  <span key={flash} className="pointer-events-none absolute inset-0 bg-primary/25 opacity-0 [animation:fade-in_90ms_ease-out_reverse]" aria-hidden="true" />
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-subtle">{cursor ? `Next ${mode}` : 'All stamped'}</p>
                  <p className="mt-2 min-h-[2.5rem] text-2xl font-extrabold leading-tight sm:text-3xl">
                    {cursor && cursorLine ? (
                      mode === 'line' ? (
                        cursorLine.text
                      ) : (
                        <>
                          {cursorLine.words.map((w, j) => (
                            <span key={j} className={cn(j === cursor.word ? 'text-primary underline decoration-4 underline-offset-8' : j < cursor.word ? 'text-fg/40' : 'text-fg/80')}>
                              {w.text}{' '}
                            </span>
                          ))}
                        </>
                      )
                    ) : (
                      <span className="text-primary">Done! Fine-tune below or save.</span>
                    )}
                  </p>
                  <p className="mt-2 truncate text-sm text-muted">{prevStamped ? `Last: [${formatLrcTime(prevStamped.time ?? 0)}] ${prevStamped.text}` : 'Click here or focus and press Enter to tap'}</p>
                  {!isLoaded && <p className="mt-2 text-sm font-semibold text-ember">Loading the track into the player…</p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Keyboard className="h-4 w-4" />
                  <kbd className="rounded border border-line px-1.5 font-mono">Enter</kbd>/<kbd className="rounded border border-line px-1.5 font-mono">T</kbd> tap ·
                  <kbd className="rounded border border-line px-1.5 font-mono">⌫</kbd> undo ·
                  <kbd className="rounded border border-line px-1.5 font-mono">B</kbd> break ·
                  <kbd className="rounded border border-line px-1.5 font-mono">Space</kbd> play/pause
                  <span className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={undo}>
                      Undo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={markBreak}>
                      Mark break
                    </Button>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="font-semibold">Reaction compensation</span>
                  <Slider
                    label="Reaction-time compensation"
                    min={0}
                    max={0.4}
                    step={0.01}
                    value={tapCompensation}
                    valueText={`${Math.round(tapCompensation * 1000)} milliseconds`}
                    onChange={(v) => settingsActions.set('tapCompensation', v)}
                    className="w-40"
                  />
                  <span className="tabular-nums">−{Math.round(tapCompensation * 1000)} ms per tap</span>
                </div>
              </div>

              {/* Line list */}
              <div className="rounded-2xl border border-line/60">
                <div className="flex items-center justify-between border-b border-line/60 px-4 py-3 text-sm">
                  <span className="font-bold">
                    {stats.timedLines}/{stats.lines} lines timed
                    {mode === 'word' && ` · ${stats.timedWords}/${stats.words} words`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setLines((ls) => ls.map((l) => ({ ...l, time: null, end: null, words: l.words.map((w) => ({ ...w, time: null })) })))}
                  >
                    Clear timings
                  </Button>
                </div>
                <ol className="max-h-[28rem] divide-y divide-line/40 overflow-y-auto">
                  {lines.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Paste lyrics above to begin.</li>}
                  {lines.map((l, i) => (
                    <li key={i} className={cn('flex flex-wrap items-center gap-2 px-3 py-2', cursor?.line === i && 'bg-primary/[0.07]')}>
                      <span className="w-6 text-right text-xs tabular-nums text-subtle">{i + 1}</span>
                      <TimeField value={l.time} label={`Start time of line ${i + 1}`} onCommit={(v) => updateLine(i, { time: v, words: v === null ? l.words.map((w) => ({ ...w, time: null })) : l.words })} />
                      <div className="flex">
                        <button className="h-8 rounded-l-lg bg-fg/[0.06] px-2 text-xs font-bold hover:bg-fg/10" aria-label={`Nudge line ${i + 1} earlier`} disabled={l.time === null} onClick={() => l.time !== null && updateLine(i, { time: Math.max(0, +(l.time - 0.05).toFixed(3)) })}>
                          −
                        </button>
                        <button className="h-8 rounded-r-lg bg-fg/[0.06] px-2 text-xs font-bold hover:bg-fg/10" aria-label={`Nudge line ${i + 1} later`} disabled={l.time === null} onClick={() => l.time !== null && updateLine(i, { time: +(l.time + 0.05).toFixed(3) })}>
                          +
                        </button>
                      </div>
                      <button className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary" onClick={() => l.time !== null && player.seek(l.time)} title="Play from this line">
                        {l.text}
                        {mode === 'word' && l.words.some((w) => w.time !== null) && (
                          <span className="ml-2 text-xs text-subtle">({l.words.filter((w) => w.time !== null).length}/{l.words.length} words)</span>
                        )}
                        {l.end !== null && <span className="ml-2 rounded bg-accent/15 px-1.5 text-[10px] font-bold text-accent">break {formatLrcTime(l.end)}</span>}
                      </button>
                      <button className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-fg/5 hover:text-fg" onClick={() => updateLine(i, { time: Math.max(0, +(currentPlaybackTime() - tapCompensation).toFixed(3)) })}>
                        Set to now
                      </button>
                      <button className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-fg/5 hover:text-fg" onClick={() => resumeFrom(i)}>
                        Sync from here
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <textarea
                value={rawLrc}
                onChange={(e) => {
                  setRawLrc(e.target.value);
                  setRawDirty(true);
                }}
                rows={18}
                spellCheck={false}
                aria-label="Raw LRC text"
                className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
              />
              {rawParsed && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-fg/[0.07] px-3 py-1 font-semibold">
                    {rawParsed.kind} · {rawParsed.lines.length} lines
                  </span>
                  {rawParsed.warnings.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-ember">
                      <AlertTriangle className="h-4 w-4" /> {rawParsed.warnings[0]}
                      {rawParsed.warnings.length > 1 && ` (+${rawParsed.warnings.length - 1} more)`}
                    </span>
                  )}
                  <Button size="sm" variant="primary" onClick={applyRaw}>
                    Apply changes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRawDirty(false);
                      setRawLrc(lrcOut);
                    }}
                  >
                    Discard
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<ClipboardCopy className="h-4 w-4" />} disabled={!lrcOut} onClick={() => void copyToClipboard(rawLrc).then((ok) => ui.toast(ok ? 'Copied LRC to clipboard' : 'Clipboard not available', ok ? 'success' : 'error'))}>
                  Copy LRC
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {original && (
              <Button
                size="sm"
                variant="ghost"
                icon={<ListRestart className="h-4 w-4" />}
                onClick={() => {
                  setLines(linesFromLyrics(parseLrc(original)));
                  setRawDirty(false);
                }}
              >
                Load original lyrics
              </Button>
            )}
            {hasOverride && (
              <Button
                size="sm"
                variant="danger"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => {
                  lyricsActions.removeOverride(track.id);
                  setLines(original ? linesFromLyrics(parseLrc(original)) : []);
                  ui.toast(original ? 'Reverted to the original lyrics' : 'Custom lyrics removed');
                }}
              >
                Revert saved custom lyrics
              </Button>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- live preview */}
        <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start" aria-label="Live preview">
          <div className="flex h-[min(78vh,46rem)] flex-col rounded-3xl border border-line/60 bg-elevated p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-extrabold">Live preview</h2>
              <span className="rounded-full bg-fg/[0.07] px-2.5 py-1 text-xs font-semibold text-muted">{preview ? (enhanced ? 'Enhanced LRC' : 'Standard LRC') : 'Not synced yet'}</span>
            </div>
            {preview ? (
              <LyricsView track={track} lyrics={preview} source="custom" variant="panel" showToolbar={false} className="min-h-0 flex-1" />
            ) : (
              <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted">Timed lines appear here and play back in sync as you tap.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
