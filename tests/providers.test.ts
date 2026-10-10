import { describe, expect, it } from 'vitest';
import { isPlayable, mapAudiusPlaylist, mapAudiusTrack, mapAudiusUser, type AudiusTrackJSON } from '@/services/providers/audius';
import { mapArchiveDoc, mapArchiveItem, parseLength, sanitizeQuery, type ArchiveMetadataJSON } from '@/services/providers/archive';

const user = { id: 'u1', name: 'Nova Lane', handle: 'novalane', is_verified: true, follower_count: 1200, profile_picture: { '480x480': 'https://img/u.jpg' } };

/** Shape follows the Audius API `Track` model (snake_case JSON). */
const audiusTrack = (over: Partial<AudiusTrackJSON> = {}): AudiusTrackJSON => ({
  id: 'D7KyD',
  title: 'Night Drive',
  duration: 201,
  genre: 'Electronic',
  mood: 'Energizing',
  release_date: '2024-05-01T00:00:00Z',
  play_count: 5310,
  permalink: '/novalane/night-drive',
  artwork: { '150x150': 'https://img/150.jpg', '480x480': 'https://img/480.jpg', '1000x1000': 'https://img/1000.jpg' },
  user,
  is_streamable: true,
  is_downloadable: false,
  ...over,
});

describe('Audius mapping', () => {
  it('maps a streamable track to a High Quality stream', () => {
    const t = mapAudiusTrack(audiusTrack());
    expect(t).toMatchObject({
      id: 'audius:D7KyD',
      title: 'Night Drive',
      artistId: 'audius-user:u1',
      artistName: 'Nova Lane',
      albumTitle: 'Single',
      duration: 201,
      genreName: 'Electronic',
      releaseDate: '2024-05-01',
      plays: 5310,
      provider: 'audius',
      artworkUrl: 'https://img/480.jpg',
      pageUrl: 'https://audius.co/novalane/night-drive',
    });
    expect(t.source.kind).toBe('remote');
    if (t.source.kind !== 'remote') return;
    expect(t.source.variants).toHaveLength(1);
    expect(t.source.variants[0]).toMatchObject({ tier: 'high', format: 'mp3' });
    expect(t.source.variants[0].url).toContain('/v1/tracks/D7KyD/stream?');
    expect(t.source.variants[0].url).toContain('app_name=MusicWave');
  });

  it('offers the lossless original only when downloads are allowed', () => {
    const lossless = mapAudiusTrack(audiusTrack({ is_downloadable: true, is_original_available: true, orig_filename: 'night drive master.wav' }));
    if (lossless.source.kind !== 'remote') throw new Error('expected remote');
    expect(lossless.source.variants[1]).toMatchObject({ tier: 'lossless', format: 'wav', needsInspection: true, maybeHiRes: true });
    expect(lossless.source.variants[1].url).toContain('/download?');

    const lossyOriginal = mapAudiusTrack(audiusTrack({ is_downloadable: true, is_original_available: true, orig_filename: 'demo.mp3' }));
    const gated = mapAudiusTrack(audiusTrack({ is_downloadable: true, is_original_available: true, orig_filename: 'a.flac', access: { stream: true, download: false } }));
    for (const t of [lossyOriginal, gated]) expect(t.source.kind === 'remote' && t.source.variants.length).toBe(1);
  });

  it('links album tracks to their album', () => {
    const t = mapAudiusTrack(audiusTrack({ album_backlink: { playlist_id: 77, playlist_name: 'Afterglow', permalink: '/x/album/afterglow' } }));
    expect(t.albumId).toBe('audius-playlist:77');
    expect(t.albumTitle).toBe('Afterglow');
  });

  it('skips gated or unstreamable tracks', () => {
    expect(isPlayable(audiusTrack())).toBe(true);
    expect(isPlayable(audiusTrack({ is_streamable: false }))).toBe(false);
    expect(isPlayable(audiusTrack({ access: { stream: false } }))).toBe(false);
  });

  it('maps users and playlists', () => {
    expect(mapAudiusUser(user)).toMatchObject({ id: 'audius-user:u1', name: 'Nova Lane', verified: true, followerCount: 1200, imageUrl: 'https://img/u.jpg', pageUrl: 'https://audius.co/novalane' });
    expect(
      mapAudiusPlaylist({ id: 'p9', playlist_name: 'Late Night', is_album: true, user, track_count: 9, release_date: '2023-02-03', permalink: '/novalane/album/late-night' }),
    ).toMatchObject({ id: 'audius-playlist:p9', kind: 'album', title: 'Late Night', artistName: 'Nova Lane', artistId: 'audius-user:u1', year: '2023', trackCount: 9 });
  });
});

/** Shape follows archive.org's /metadata/{identifier} response. */
const item: ArchiveMetadataJSON = {
  metadata: {
    identifier: 'band2001-07-04.flac24',
    title: 'Band Live at the Park',
    creator: 'The Band',
    date: '2001-07-04',
    description: '<b>Set 1</b><br>Great show &amp; more',
    licenseurl: 'http://creativecommons.org/licenses/by-nc-sa/3.0/',
  },
  files: [
    { name: 'b01.flac', source: 'original', format: '24bit Flac', title: 'Opener', track: '1', length: '245.6', size: '61000000' },
    { name: 'b01.mp3', source: 'derivative', format: 'VBR MP3', original: 'b01.flac', length: '04:05', bitrate: '192' },
    { name: 'b01.ogg', source: 'derivative', format: 'Ogg Vorbis', original: 'b01.flac' },
    { name: 'b02.flac', source: 'original', format: '24bit Flac', title: 'Closer', track: '2/2', length: '1:02:03' },
    { name: 'b02.mp3', source: 'derivative', format: 'VBR MP3', original: 'b02.flac' },
    { name: 'b00 private.flac', source: 'original', format: 'Flac', private: 'true' },
    { name: 'b00.shn', source: 'original', format: 'Shorten' },
    { name: 'b01.png', source: 'derivative', format: 'PNG', original: 'b01.flac' },
    { name: 'band.ffp', source: 'original', format: 'Text' },
  ],
};

describe('Internet Archive mapping', () => {
  it('groups renditions of the same recording into one track', () => {
    const mapped = mapArchiveItem(item)!;
    expect(mapped.tracks.map((t) => t.title)).toEqual(['Opener', 'Closer']);
    const [opener, closer] = mapped.tracks;
    expect(opener).toMatchObject({
      id: 'ia:band2001-07-04.flac24:b01',
      artistName: 'The Band',
      albumId: 'ia-item:band2001-07-04.flac24',
      albumTitle: 'Band Live at the Park',
      trackNumber: 1,
      duration: 245.6,
      provider: 'archive',
      artworkUrl: 'https://archive.org/services/img/band2001-07-04.flac24',
    });
    expect(closer.duration).toBe(3723);
    if (opener.source.kind !== 'remote') throw new Error('expected remote');
    const tiers = opener.source.variants.map((x) => [x.format, x.tier, x.maybeHiRes ?? false]);
    expect(tiers).toEqual([
      ['flac', 'lossless', true],
      ['mp3', 'high', false],
      ['ogg', 'high', false],
    ]);
    expect(opener.source.variants[0].url).toBe('https://archive.org/download/band2001-07-04.flac24/b01.flac');
    expect(opener.source.variants[1].bitrateKbps).toBe(192);
  });

  it('builds the recording and skips private / unplayable files', () => {
    const { collection, tracks } = mapArchiveItem(item)!;
    expect(tracks).toHaveLength(2);
    expect(collection).toMatchObject({ id: 'ia-item:band2001-07-04.flac24', kind: 'recording', year: '2001', trackCount: 2, bestTier: 'lossless', has24Bit: true });
    expect(collection.description).toBe('Set 1\nGreat show & more');
  });

  it('maps search docs', () => {
    expect(mapArchiveDoc({ identifier: 'x', title: 'X', creator: ['A', 'B'], year: 1999, format: ['24bit Flac', 'VBR MP3'] })).toMatchObject({
      artistName: 'A, B',
      artistId: 'ia-creator:A',
      year: '1999',
      bestTier: 'lossless',
      has24Bit: true,
    });
    expect(mapArchiveDoc({ identifier: 'y', format: ['VBR MP3'] }).bestTier).toBe('high');
  });

  it('parses lengths and sanitizes queries', () => {
    expect(parseLength('245.6')).toBeCloseTo(245.6);
    expect(parseLength('04:05')).toBe(245);
    expect(parseLength(undefined)).toBe(0);
    expect(sanitizeQuery('grateful "dead" AND (1977) OR title:x*')).toBe('grateful dead 1977 title x');
  });
});
