/**
 * Pure queue operations (no side effects) so they are easy to unit test.
 * The queue holds history + current + upcoming items; `index` points at the current one.
 */
import type { QueueItem, RepeatMode } from '@/types/player';
import { shuffled } from '@/utils/random';

let uidCounter = 0;
export const newUid = () => `q${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export function makeItems(trackIds: string[], manual = false): QueueItem[] {
  return trackIds.map((trackId) => ({ uid: newUid(), trackId, ...(manual ? { manual: true } : {}) }));
}

/** Shuffles everything after the current item. */
export function shuffleUpcoming(queue: QueueItem[], index: number, random: () => number = Math.random): QueueItem[] {
  return [...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1), random)];
}

/**
 * Restores the original order after shuffle: upcoming items follow `baseOrder`
 * from the current item's position; items added while shuffled are kept at the end.
 */
export function unshuffle(queue: QueueItem[], index: number, baseOrder: QueueItem[]): QueueItem[] {
  const current = queue[index];
  const played = new Set(queue.slice(0, index + 1).map((q) => q.uid));
  const upcoming = new Set(queue.slice(index + 1).map((q) => q.uid));
  const basePos = baseOrder.findIndex((q) => q.uid === current?.uid);
  const ordered = baseOrder.slice(basePos + 1).filter((q) => upcoming.has(q.uid) && !played.has(q.uid));
  const orderedSet = new Set(ordered.map((q) => q.uid));
  const extras = queue.slice(index + 1).filter((q) => !orderedSet.has(q.uid));
  const manual = extras.filter((q) => q.manual);
  const rest = extras.filter((q) => !q.manual);
  return [...queue.slice(0, index + 1), ...manual, ...ordered, ...rest];
}

/** "Play next": directly after the current item. */
export function insertNext(queue: QueueItem[], index: number, items: QueueItem[]): QueueItem[] {
  return [...queue.slice(0, index + 1), ...items, ...queue.slice(index + 1)];
}

/** "Add to queue": after any manually queued items that are already up next. */
export function appendToQueue(queue: QueueItem[], index: number, items: QueueItem[]): QueueItem[] {
  let at = index + 1;
  while (at < queue.length && queue[at].manual) at++;
  return [...queue.slice(0, at), ...items, ...queue.slice(at)];
}

export function moveItem(queue: QueueItem[], from: number, to: number): QueueItem[] {
  if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return queue;
  const next = [...queue];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Removes an item; keeps `index` pointing at the same current item. */
export function removeItem(queue: QueueItem[], index: number, uid: string): { queue: QueueItem[]; index: number } {
  const at = queue.findIndex((q) => q.uid === uid);
  if (at < 0 || at === index) return { queue, index };
  return { queue: queue.filter((q) => q.uid !== uid), index: at < index ? index - 1 : index };
}

/** Index to advance to, or null when playback should stop. */
export function nextIndex(length: number, index: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (index + 1 < length) return index + 1;
  return repeat === 'all' ? 0 : null;
}

export function previousIndex(length: number, index: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (index > 0) return index - 1;
  return repeat === 'all' ? length - 1 : null;
}
