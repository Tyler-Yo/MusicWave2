/**
 * Regenerates src/data/lyrics/*.lrc from the lyric compositions.
 *
 * The guide vocal in each demo track is rendered from the very same arrangement
 * data, so these LRC files are sample-accurate to the audio (to the centisecond).
 *
 *   npm run generate:lrc
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LYRIC_COMPOSITIONS } from '../src/data/compositions';
import { compositionToLrc } from '../src/audio/synth/lyricsExport';
import { ALBUMS, ARTISTS, TRACKS } from '../src/data/catalog';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'lyrics');

for (const comp of LYRIC_COMPOSITIONS) {
  const track = TRACKS.find((t) => t.source.kind === 'synth' && t.source.compositionId === comp.id);
  if (!track) throw new Error(`No catalog track for composition ${comp.id}`);
  const artist = ARTISTS.find((a) => a.id === track.artistId);
  const album = ALBUMS.find((a) => a.id === track.albumId);
  const lrc = compositionToLrc(comp, {
    title: track.title,
    artist: artist?.name,
    album: album?.title,
    author: track.credits?.writtenBy.join(', '),
    by: 'MusicWave',
  });
  const file = join(outDir, `${comp.id}.lrc`);
  writeFileSync(file, lrc);
  console.log(`wrote ${file} (${lrc.split('\n').length - 1} lines, ${comp.lrcFormat ?? 'enhanced'})`);
}
