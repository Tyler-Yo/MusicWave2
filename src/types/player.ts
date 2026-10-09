import type { ID, PlayContext } from './music';

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueItem {
  /** Unique per queue entry so the same track can appear twice. */
  uid: string;
  trackId: ID;
  /** True when the listener explicitly added it ("Play next" / "Add to queue"). */
  manual?: boolean;
}

export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlayerState {
  queue: QueueItem[];
  /** Index of the current item in `queue` (-1 when nothing is loaded). */
  index: number;
  /** The un-shuffled order, kept so shuffle can be turned off without losing position. */
  baseOrder: QueueItem[] | null;
  shuffle: boolean;
  repeat: RepeatMode;
  isPlaying: boolean;
  status: PlaybackStatus;
  /** Human-readable status detail (e.g. "Rendering audio…", or an error message). */
  statusDetail?: string;
  volume: number;
  muted: boolean;
  playbackRate: number;
  context: PlayContext | null;
  /** Tracks played in this session, most recent last (for the queue's history section). */
  sessionHistory: ID[];
}
