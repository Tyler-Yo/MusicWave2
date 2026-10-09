import { describe, expect, it } from 'vitest';
import { appendToQueue, insertNext, makeItems, moveItem, nextIndex, previousIndex, removeItem, shuffleUpcoming, unshuffle } from '@/state/queue';
import { mulberry32 } from '@/utils/random';

const ids = (q: Array<{ trackId: string }>) => q.map((x) => x.trackId);

describe('queue operations', () => {
  const base = makeItems(['a', 'b', 'c', 'd', 'e']);

  it('gives every entry a unique uid (same track can be queued twice)', () => {
    const q = makeItems(['a', 'a']);
    expect(q[0].uid).not.toBe(q[1].uid);
  });

  it('shuffles only upcoming items and keeps history + current in place', () => {
    const q = shuffleUpcoming(base, 1, mulberry32(7));
    expect(ids(q).slice(0, 2)).toEqual(['a', 'b']);
    expect([...ids(q)].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('unshuffle restores the original order after the current item and keeps manual additions', () => {
    const shuffled = shuffleUpcoming(base, 0, mulberry32(3));
    const withManual = insertNext(shuffled, 0, makeItems(['x'], true));
    const restored = unshuffle(withManual, 0, base);
    expect(ids(restored)).toEqual(['a', 'x', 'b', 'c', 'd', 'e']);
  });

  it('play next goes right after current; add to queue goes after other manual items', () => {
    let q = insertNext(base, 0, makeItems(['n1'], true));
    q = appendToQueue(q, 0, makeItems(['q1'], true));
    q = insertNext(q, 0, makeItems(['n2'], true));
    expect(ids(q)).toEqual(['a', 'n2', 'n1', 'q1', 'b', 'c', 'd', 'e']);
  });

  it('moves and removes items while keeping the current index stable', () => {
    expect(ids(moveItem(base, 4, 1))).toEqual(['a', 'e', 'b', 'c', 'd']);
    const { queue, index } = removeItem(base, 2, base[0].uid);
    expect(ids(queue)).toEqual(['b', 'c', 'd', 'e']);
    expect(queue[index].trackId).toBe('c');
    expect(removeItem(base, 2, base[2].uid).queue).toBe(base); // current can't be removed
  });

  it('computes next/previous with repeat modes', () => {
    expect(nextIndex(5, 4, 'off')).toBeNull();
    expect(nextIndex(5, 4, 'all')).toBe(0);
    expect(nextIndex(5, 1, 'off')).toBe(2);
    expect(previousIndex(5, 0, 'off')).toBeNull();
    expect(previousIndex(5, 0, 'all')).toBe(4);
    expect(nextIndex(0, -1, 'all')).toBeNull();
  });
});
