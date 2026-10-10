/**
 * The single HTMLAudioElement behind all playback, plus a high-precision clock.
 *
 * `HTMLMediaElement.currentTime` only advances in coarse steps in some browsers
 * (and `timeupdate` fires ~4×/s), which is far too coarse for word-level lyrics.
 * `PlaybackClock` extrapolates media time with `performance.now()` between
 * updates, slews gently toward each new reading, re-anchors instantly on
 * seeks / rate changes / stalls, and never runs backwards while playing.
 */

type EngineEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'error'
  | 'loadedmetadata'
  | 'durationchange'
  | 'waiting'
  | 'playing'
  | 'seeking'
  | 'seeked'
  | 'ratechange'
  | 'volumechange'
  | 'timeupdate'
  | 'canplay';

export class PlaybackClock {
  private anchorMedia = 0;
  private anchorPerf = 0;
  private lastRaw = -1;
  /** performance.now() when the element last reported a new currentTime. */
  private lastRawPerf = 0;
  private lastOut = 0;
  private stalled = false;

  constructor(private readonly media: HTMLMediaElement) {
    const reanchor = () => this.reset();
    for (const ev of ['play', 'playing', 'pause', 'seeking', 'seeked', 'ratechange', 'loadedmetadata', 'emptied']) {
      media.addEventListener(ev, reanchor);
    }
    media.addEventListener('waiting', () => {
      this.stalled = true;
      this.reset();
    });
    media.addEventListener('playing', () => {
      this.stalled = false;
    });
  }

  /** Re-anchor to the element's current position (after seeks, pauses, rate changes). */
  reset(): void {
    this.anchorMedia = this.media.currentTime;
    this.anchorPerf = performance.now();
    this.lastRawPerf = this.anchorPerf;
    this.lastRaw = this.anchorMedia;
    this.lastOut = this.anchorMedia;
  }

  /** Best estimate of the current media time in seconds. */
  now(): number {
    const m = this.media;
    const raw = m.currentTime;
    if (m.paused || m.seeking || this.stalled || m.readyState < 2) {
      this.anchorMedia = raw;
      this.anchorPerf = performance.now();
      this.lastRaw = raw;
      this.lastOut = raw;
      return raw;
    }
    const perf = performance.now();
    const rate = m.playbackRate;
    if (raw !== this.lastRaw) {
      const predicted = this.anchorMedia + ((perf - this.anchorPerf) / 1000) * rate;
      const err = raw - predicted;
      if (Math.abs(err) > 0.15) {
        // A jump we did not see coming: trust the element.
        this.anchorMedia = raw;
        this.anchorPerf = perf;
        this.lastOut = raw;
      } else {
        // Small drift: slew toward the reported time without visible jitter.
        this.anchorMedia += err * 0.2;
      }
      this.lastRaw = raw;
      this.lastRawPerf = perf;
    }
    let t = this.anchorMedia + ((perf - this.anchorPerf) / 1000) * rate;
    // If the element has reported no progress for a while it has probably stalled without
    // firing an event: stop extrapolating instead of running away from the audio.
    if (perf - this.lastRawPerf > 400) t = Math.min(t, raw + 0.4 * rate);
    // Monotonic while playing: absorb tiny backward corrections.
    if (t < this.lastOut && this.lastOut - t < 0.1) t = this.lastOut;
    this.lastOut = t;
    const d = m.duration;
    return Number.isFinite(d) ? Math.min(t, d) : t;
  }
}

export class AudioEngine {
  readonly audio: HTMLAudioElement;
  readonly clock: PlaybackClock;
  private loadToken = 0;
  private listeners = new Map<EngineEvent, Set<() => void>>();

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    // No crossOrigin: online catalogs serve audio from many hosts, not all of which send CORS
    // headers, and playback through a plain <audio> element doesn't need them.
    // Keep pitch natural when the speed changes.
    this.audio.preservesPitch = true;
    this.clock = new PlaybackClock(this.audio);
    const events: EngineEvent[] = [
      'play',
      'pause',
      'ended',
      'error',
      'loadedmetadata',
      'durationchange',
      'waiting',
      'playing',
      'seeking',
      'seeked',
      'ratechange',
      'volumechange',
      'timeupdate',
      'canplay',
    ];
    for (const ev of events) this.audio.addEventListener(ev, () => this.listeners.get(ev)?.forEach((l) => l()));
  }

  on(event: EngineEvent, listener: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => set?.delete(listener);
  }

  /**
   * Loads a source and resolves once it can play (or rejects on error).
   * A newer `load` call supersedes an older one (its promise rejects with `superseded`).
   */
  load(url: string, startAt = 0): Promise<void> {
    const token = ++this.loadToken;
    const a = this.audio;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        a.removeEventListener('loadedmetadata', onMeta);
        a.removeEventListener('error', onError);
      };
      const onMeta = () => {
        cleanup();
        if (token !== this.loadToken) return reject(new Error('superseded'));
        if (startAt > 0 && Number.isFinite(a.duration)) a.currentTime = Math.min(startAt, Math.max(0, a.duration - 0.5));
        this.clock.reset();
        resolve();
      };
      const onError = () => {
        cleanup();
        if (token !== this.loadToken) return reject(new Error('superseded'));
        reject(new Error(describeMediaError(a.error)));
      };
      a.addEventListener('loadedmetadata', onMeta);
      a.addEventListener('error', onError);
      a.src = url;
      a.load();
    });
  }

  /** Resolves true when playback started, false if the browser blocked it. */
  async play(): Promise<boolean> {
    try {
      await this.audio.play();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return true;
      return false;
    }
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    const d = this.audio.duration;
    const t = Math.max(0, Number.isFinite(d) ? Math.min(seconds, Math.max(0, d - 0.05)) : seconds);
    // Always use precise `currentTime` seeks (never fastSeek): lyrics need exact positions.
    this.audio.currentTime = t;
    this.clock.reset();
  }

  setVolume(volume: number, muted: boolean): void {
    // Perceptual (quadratic) volume curve.
    this.audio.volume = Math.max(0, Math.min(1, volume * volume));
    this.audio.muted = muted;
  }

  setRate(rate: number): void {
    this.audio.playbackRate = rate;
    this.audio.defaultPlaybackRate = rate;
  }

  unload(): void {
    this.loadToken++;
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }
  get duration(): number {
    return this.audio.duration;
  }
  get paused(): boolean {
    return this.audio.paused;
  }
}

function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was aborted.';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'A network error interrupted the download.';
    case MediaError.MEDIA_ERR_DECODE:
      return 'The audio file is corrupted or uses an unsupported codec.';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'This audio format or URL is not supported.';
    default:
      return 'The audio could not be loaded.';
  }
}

let instance: AudioEngine | null = null;

/** Lazily-created singleton (keeps imports side-effect free for tests). */
export function getAudioEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine();
  return instance;
}
