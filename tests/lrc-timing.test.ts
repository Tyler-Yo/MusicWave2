import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/services/lrc/parser';
import { buildTimeline, DEFAULT_TIMELINE, findActiveIndex, segmentProgress } from '@/services/lrc/timing';
import { countSyllables, splitSyllables, syllableVowel } from '@/services/lrc/syllables';

const lead = DEFAULT_TIMELINE.leadIn;

describe('buildTimeline', () => {
  it('adds an intro interlude when the first line starts late', () => {
    const tl = buildTimeline(parseLrc('[00:12.00]first\n[00:15.00]second'));
    expect(tl.items[0]).toMatchObject({ type: 'interlude', start: 0 });
    expect(tl.items[0].type === 'interlude' && tl.items[0].end).toBeCloseTo(12 - lead, 6);
    expect(tl.items[1]).toMatchObject({ type: 'line' });
    expect(tl.items[1].activateAt).toBeCloseTo(12 - lead, 6);
  });

  it('activates a line with lead-in, but never while the previous line is still sung', () => {
    // Rap-style back-to-back lines: previous ends exactly when the next starts.
    const tl = buildTimeline(
      parseLrc('[00:01.00]<00:01.00>fast <00:01.20>words<00:02.00>\n[00:02.00]<00:02.00>no <00:02.20>gap<00:03.00>'),
    );
    const [, second] = tl.items;
    expect(second.activateAt).toBeCloseTo(2, 6);
    // Slow ballad lines with a breath: lead-in applies.
    const slow = buildTimeline(parseLrc('[00:01.00]<00:01.00>slow<00:03.00>\n[00:05.00]<00:05.00>line<00:07.00>'));
    expect(slow.items[1].activateAt).toBeCloseTo(5 - lead, 6);
  });

  it('inserts interludes for instrumental breaks and keeps activation monotonic', () => {
    const tl = buildTimeline(
      parseLrc('[00:01.00]<00:01.00>before<00:02.00>\n[00:02.00]\n[00:30.00]<00:30.00>after<00:31.00>'),
    );
    const types = tl.items.map((i) => i.type);
    expect(types).toEqual(['line', 'interlude', 'line']);
    const interlude = tl.items[1];
    expect(interlude.type === 'interlude' && interlude.start).toBeCloseTo(2 + DEFAULT_TIMELINE.lineTail, 6);
    for (let i = 1; i < tl.activateTimes.length; i++) {
      expect(tl.activateTimes[i]).toBeGreaterThanOrEqual(tl.activateTimes[i - 1]);
    }
  });

  it('is empty for plain lyrics', () => {
    expect(buildTimeline(parseLrc('just\ntext')).items).toHaveLength(0);
    expect(buildTimeline(null).items).toHaveLength(0);
  });
});

describe('findActiveIndex', () => {
  const tl = buildTimeline(parseLrc('[00:01.00]a\n[00:03.00]b\n[00:05.00]c'));
  it('binary-searches the active item, including exact boundaries and seeks backwards', () => {
    expect(findActiveIndex(tl, 0)).toBe(-1);
    expect(findActiveIndex(tl, tl.activateTimes[0])).toBe(0);
    expect(findActiveIndex(tl, 4)).toBe(1);
    expect(findActiveIndex(tl, 100)).toBe(2);
    // Seeking backwards is just another lookup — no hidden state.
    expect(findActiveIndex(tl, 1.5)).toBe(0);
  });
});

describe('segmentProgress', () => {
  it('clamps to [0, 1] and is linear in between', () => {
    const seg = { start: 10, end: 12 };
    expect(segmentProgress(seg, 9)).toBe(0);
    expect(segmentProgress(seg, 11)).toBe(0.5);
    expect(segmentProgress(seg, 13)).toBe(1);
  });
});

describe('syllables', () => {
  it('counts syllables reasonably', () => {
    expect(countSyllables('lanterns')).toBe(2);
    expect(countSyllables('beautiful')).toBe(3);
    expect(countSyllables('the')).toBe(1);
    expect(countSyllables('water')).toBe(2);
    expect(countSyllables('fire|flies')).toBe(2);
  });
  it('splits words into syllables and picks vowels', () => {
    expect(splitSyllables('lanterns')).toEqual(['lan', 'terns']);
    expect(splitSyllables('fire|flies')).toEqual(['fire', 'flies']);
    expect(splitSyllables('night')).toEqual(['night']);
    expect(syllableVowel('moon')).toBe('u');
    expect(syllableVowel('night')).toBe('i');
  });
});
