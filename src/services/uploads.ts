/** Importing the listener's own audio files and .lrc lyrics. */
import { parseLrc } from '@/services/lrc/parser';
import { offlineStore } from '@/services/offlineStore';
import { libraryActions } from '@/state/libraryStore';
import { lyricsActions } from '@/state/lyricsStore';
import { ui } from '@/state/uiStore';
import { pickFiles, readFileAsText } from '@/utils/files';
import { plural } from '@/utils/format';

function audioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = 'metadata';
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.src = url;
  });
}

/** "Artist - Title.mp3" → { artist, title }. */
function metaFromFileName(name: string): { artist: string; title: string } {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: 'Unknown artist', title: base };
}

export async function importAudioFiles(): Promise<void> {
  const files = await pickFiles('audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.flac,.webm', true);
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(file.name)) {
      ui.toast(`Skipped ${file.name}: not an audio file`, 'error');
      continue;
    }
    const id = `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = await audioDuration(file);
    if (duration === 0) {
      ui.toast(`Your browser can’t play ${file.name}.`, 'error');
      continue;
    }
    await offlineStore.putUpload({ id, blob: file, name: file.name, type: file.type, size: file.size });
    const saved = await offlineStore.getUpload(id);
    if (!saved) {
      ui.toast('Could not store the file (storage disabled or full).', 'error');
      continue;
    }
    libraryActions.addUpload({ id, ...metaFromFileName(file.name), duration, fileName: file.name, size: file.size, addedAt: new Date().toISOString() });
    added++;
  }
  if (added) ui.toast(`Imported ${plural(added, 'track')}`, 'success');
}

export async function attachLrc(trackId: string, title: string): Promise<void> {
  const [file] = await pickFiles('.lrc,.txt,text/plain');
  if (!file) return;
  const text = await readFileAsText(file);
  const parsed = parseLrc(text);
  if (parsed.lines.length === 0) {
    ui.toast('That file has no lyric lines.', 'error');
    return;
  }
  lyricsActions.saveOverride(trackId, text, 'import');
  ui.toast(`Lyrics attached to “${title}” (${parsed.kind === 'enhanced' ? 'word-synced' : parsed.kind === 'standard' ? 'line-synced' : 'unsynced'})`, 'success');
}

