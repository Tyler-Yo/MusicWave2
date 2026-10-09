/**
 * PlaybackClock: smooth, monotonic media time between coarse currentTime updates,
 * instant re-anchoring on seeks / pauses, and correct scaling with playbackRate.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaybackClock } from '@/services/audioEngine';

class FakeMedia extends EventTarget {
  currentTime = 0;
  paused = true;
  seeking = false;
  readyState = 4;
  playbackRate = 1;
  duration = 200;
}

let now = 0;
vi.stubGlobal('performance', { now: () => now });
afterEach(() => {
  now = 0;
});

function setup() {
  const media = new FakeMedia();
  const clock = new PlaybackClock(media as unknown as HTMLMediaElement);
  return { media, clock };
}

describe('PlaybackClock', () => {
  it('returns the element time while paused', () => {
    const { media, clock } = setup();
    media.currentTime = 12.5;
    expect(clock.now()).toBe(12.5);
  });

  it('extrapolates between coarse updates and never runs backwards', () => {
    const { media, clock } = setup();
    media.paused = false;
    media.currentTime = 10;
    media.dispatchEvent(new Event('playing'));
    clock.reset();
    const samples: number[] = [];
    // currentTime only updates every 250 ms (like timeupdate), we sample every 16 ms.
    for (let ms = 0; ms <= 1000; ms += 16) {
      now = ms;
      if (ms % 250 < 16) media.currentTime = 10 + Math.floor(ms / 250) * 0.25;
      samples.push(clock.now());
    }
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    // Within a frame of true time at the end.
    expect(Math.abs(samples[samples.length - 1] - 11)).toBeLessThan(0.05);
  });

  it('scales with playbackRate', () => {
    const { media, clock } = setup();
    media.paused = false;
    media.playbackRate = 1.5;
    media.currentTime = 0;
    clock.reset();
    for (let ms = 0; ms <= 1000; ms += 16) {
      now = ms;
      if (ms % 250 < 16) media.currentTime = Math.floor(ms / 250) * 0.25 * 1.5;
      clock.now();
    }
    now = 1000;
    expect(clock.now()).toBeCloseTo(1.5, 1);
  });

  it('does not run away when the element stalls without firing an event', () => {
    const { media, clock } = setup();
    media.paused = false;
    media.currentTime = 30;
    clock.reset();
    now = 5000; // five seconds with no progress reported
    expect(clock.now()).toBeLessThanOrEqual(30.4 + 1e-9);
  });

  it('re-anchors immediately on seeks (jumps larger than the slew window)', () => {
    const { media, clock } = setup();
    media.paused = false;
    media.currentTime = 50;
    clock.reset();
    now = 100;
    clock.now();
    media.currentTime = 5; // backward seek without an event
    now = 116;
    expect(clock.now()).toBeCloseTo(5, 2);
  });
});
