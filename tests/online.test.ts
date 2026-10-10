import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanArtist, cleanTitle, evaluateRecord, findLyrics, pickCandidate, stripTimestamps, type LrclibRecord } from '@/services/providers/lrclib';
import { mapArchiveItem } from '@/services/providers/archive';
import { inspectVariant, selectVariant } from '@/services/remoteAudio';
import { parseLrc } from '@/services/lrc/parser';
import { getRemoteTrack, isRemoteId, registerTracks } from '@/state/remoteCatalog';
import type { Track } from '@/types/music';

const record = (over: Partial<LrclibRecord> = {}): LrclibRecord => ({
  id: 1,
  trackName: 'Night Drive',
  artistName: 'Nova Lane',
  albumName: 'Afterglow',
  duration: 201,
  instrumental: false,
  plainLyrics: 'City lights\nCarry me home',
  syncedLyrics: '[00:12.50] City lights\n[00:15.00] Carry me home',
  ...over,
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('LRCLIB matching', () => {
  it('cleans titles and artists the way lyric databases store them', () => {
    expect(cleanTitle('Night Drive (Official Video) [feat. Someone]')).toBe('Night Drive');
    expect(cleanTitle('Night Drive (prod. by X) ft. Y')).toBe('Night Drive');
    expect(cleanTitle('Night Drive - 2011 Remastered')).toBe('Night Drive');
    expect(cleanArtist('Nova Lane, Echo & The Bay')).toBe('Nova Lane');
    expect(cleanArtist('Nova Lane feat. Echo')).toBe('Nova Lane');
  });

  it('trusts timestamps only for a matching length', () => {
    expect(evaluateRecord(record(), 202)).toMatchObject({ status: 'synced', durationDelta: 1 });
    expect(evaluateRecord(record(), 230)).toMatchObject({ status: 'plain', reason: 'length-mismatch' });
    expect(evaluateRecord(record({ syncedLyrics: null }), 201)).toMatchObject({ status: 'plain', reason: 'no-sync' });
    expect(evaluateRecord(record({ instrumental: true, plainLyrics: null, syncedLyrics: null }), 201).status).toBe('instrumental');
    expect(evaluateRecord(record({ plainLyrics: null, syncedLyrics: null }), 201).status).toBe('none');
  });

  it('needs both title and artist to match, and prefers synced lyrics of the right length', () => {
    const wrongArtist = record({ id: 2, artistName: 'Someone Else' });
    const longer = record({ id: 3, duration: 260 });
    const best = record({ id: 4, duration: 200 });
    expect(pickCandidate([wrongArtist], 'Night Drive', 'Nova Lane', 201)).toBeNull();
    expect(pickCandidate([wrongArtist, longer, best], 'Night Drive', 'Nova Lane', 201)?.id).toBe(4);
  });

  it('turns synced text into plain text and parses it as unsynced lyrics', () => {
    const plain = stripTimestamps('[ar:X]\n[00:01.00] Hello <00:01.50>world\n[00:03.00]\n[00:05.00] Again');
    expect(plain).toBe('Hello world\n\nAgain');
    expect(parseLrc(plain).kind).toBe('plain');
  });

  it('falls back from /get (404) to /search', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes('/api/get?')) return json({ message: 'not found' }, 404);
        return json([record({ id: 9, duration: 200.4 })]);
      }),
    );
    const result = await findLyrics({ title: 'Night Drive (Official Audio)', artist: 'Nova Lane', duration: 201 });
    expect(result).toMatchObject({ status: 'synced', lrclibId: 9 });
    expect(calls[0]).toContain('track_name=Night+Drive');
    expect(calls[1]).toContain('/api/search?');
  });

  it('reports network failures instead of "not found"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(findLyrics({ title: 'A', artist: 'B', duration: 100 })).rejects.toThrow(/Couldn’t reach LRCLIB|offline/);
  });
});

function flacBytes(sampleRate: number, bitDepth: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(4096);
  b.set([0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34]);
  b[18] = (sampleRate >> 12) & 0xff;
  b[19] = (sampleRate >> 4) & 0xff;
  b[20] = ((sampleRate & 0x0f) << 4) | (1 << 1) | (((bitDepth - 1) >> 4) & 1);
  b[21] = ((bitDepth - 1) & 0x0f) << 4;
  return b;
}

function archiveTrack(id: string): Track {
  const mapped = mapArchiveItem({
    metadata: { identifier: id, title: 'Live', creator: 'Band' },
    files: [
      { name: 's1.flac', source: 'original', format: '24bit Flac', title: 'Song', length: '100' },
      { name: 's1.mp3', source: 'derivative', format: 'VBR MP3', original: 's1.flac' },
    ],
  })!;
  return registerTracks(mapped.tracks)[0];
}

describe('quality inspection', () => {
  it('upgrades a 24-bit candidate to Hi-Res when the header says 96 kHz, and remembers it', async () => {
    const track = archiveTrack('insp-hires');
    const fetchMock = vi.fn(async () => new Response(flacBytes(96000, 24), { headers: { 'content-type': 'audio/flac', 'content-length': '50000000' } }));
    vi.stubGlobal('fetch', fetchMock);
    const chosen = await selectVariant(track, 'hires');
    expect(chosen).toMatchObject({ tier: 'hires', format: 'flac', sampleRate: 96000, bitDepth: 24, verified: true });
    const stored = getRemoteTrack(track.id)!;
    expect(stored.source.kind === 'remote' && stored.source.variants[0].tier).toBe('hires');
    // Fetched again from the catalog: the inspected rendition is kept.
    archiveTrack('insp-hires');
    const again = getRemoteTrack(track.id)!;
    expect(again.source.kind === 'remote' && again.source.variants[0].verified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps 24-bit / 48 kHz as Lossless', async () => {
    const track = archiveTrack('insp-48k');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(flacBytes(48000, 24))));
    const chosen = await selectVariant(track, 'hires');
    expect(chosen).toMatchObject({ tier: 'lossless', sampleRate: 48000 });
  });

  it('never claims Hi-Res when the file cannot be read', async () => {
    const track = archiveTrack('insp-blocked');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('CORS'))));
    const v = track.source.kind === 'remote' ? track.source.variants[0] : null;
    const result = await inspectVariant(track, v!);
    expect(result).toMatchObject({ tier: 'lossless', needsInspection: false });
    expect(result?.verified).toBeFalsy();
  });

  it('streams High Quality without touching the lossless file', async () => {
    const track = archiveTrack('insp-high');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const chosen = await selectVariant(track, 'high');
    expect(chosen?.format).toBe('mp3');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back when a rendition is excluded after failing', async () => {
    const track = archiveTrack('insp-fallback');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(flacBytes(44100, 16))));
    const first = await selectVariant(track, 'lossless');
    expect(first?.format).toBe('flac');
    const next = await selectVariant(track, 'lossless', { exclude: new Set([first!.url]) });
    expect(next?.format).toBe('mp3');
  });
});

describe('remote ids', () => {
  it('recognizes online catalog ids only', () => {
    for (const id of ['audius:1', 'audius-user:2', 'audius-playlist:3', 'ia:x:y', 'ia-item:x', 'ia-creator:Band']) expect(isRemoteId(id)).toBe(true);
    for (const id of ['iambic-track', 'audiusfan', 'pl-123', 'uploads']) expect(isRemoteId(id)).toBe(false);
  });
});
