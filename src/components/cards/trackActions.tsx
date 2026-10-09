/** Shared track actions used by context menus, Now Playing and keyboard shortcuts. */
import {
  Album as AlbumIcon,
  CheckCircle2,
  Download,
  Heart,
  HeartOff,
  ListEnd,
  ListPlus,
  ListStart,
  Mic2,
  PenLine,
  Trash2,
  User,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { MenuItem } from '@/components/common/Menu';
import { downloadTrack, removeDownloadedTrack } from '@/services/audioSources';
import { getAlbum } from '@/services/catalog';
import { hasLyrics } from '@/services/lyrics';
import { offlineStore } from '@/services/offlineStore';
import { libraryActions, libraryStore } from '@/state/libraryStore';
import { player } from '@/state/playerStore';
import { ui } from '@/state/uiStore';
import type { Track } from '@/types/music';

export async function toggleDownload(track: Track): Promise<void> {
  const downloaded = Boolean(libraryStore.get().downloads[track.id]);
  if (downloaded) {
    await removeDownloadedTrack(track);
    ui.toast(`Removed "${track.title}" from downloads`);
    return;
  }
  ui.toast(`Downloading "${track.title}"…`);
  try {
    await downloadTrack(track);
    ui.toast(`"${track.title}" is available offline`, 'success');
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'Download failed', 'error');
  }
}

export function trackMenuItems(
  track: Track,
  navigate: NavigateFunction,
  opts: { removeFromPlaylist?: () => void; hideAlbum?: boolean; hideArtist?: boolean } = {},
): MenuItem[] {
  const lib = libraryStore.get();
  const liked = Boolean(lib.likedTracks[track.id]);
  const downloaded = Boolean(lib.downloads[track.id]);
  const isUpload = track.source.kind === 'upload';
  const items: MenuItem[] = [
    { label: 'Play next', icon: <ListStart />, onSelect: () => player.playNext([track.id]) },
    { label: 'Add to queue', icon: <ListEnd />, onSelect: () => player.addToQueue([track.id]) },
    { label: 'Add to playlist…', icon: <ListPlus />, onSelect: () => ui.openAddToPlaylist([track.id]) },
    {
      label: liked ? 'Remove from Liked Songs' : 'Add to Liked Songs',
      icon: liked ? <HeartOff /> : <Heart />,
      onSelect: () => {
        libraryActions.toggleLike(track.id);
        ui.toast(liked ? 'Removed from Liked Songs' : 'Added to Liked Songs', 'success');
      },
    },
  ];
  if (!isUpload && track.source.kind === 'synth') {
    items.push({
      label: downloaded ? 'Remove download' : 'Download for offline',
      icon: downloaded ? <CheckCircle2 /> : <Download />,
      onSelect: () => void toggleDownload(track),
    });
  }
  if (hasLyrics(track)) {
    items.push({
      label: 'View lyrics',
      icon: <Mic2 />,
      divider: true,
      onSelect: () => {
        player.playTrack(track.id);
        ui.openNowPlaying('lyrics');
      },
    });
  }
  items.push({
    label: hasLyrics(track) ? 'Edit lyrics in Studio' : 'Sync lyrics in Studio',
    icon: <PenLine />,
    divider: !hasLyrics(track),
    onSelect: () => navigate(`/studio?track=${encodeURIComponent(track.id)}`),
  });
  if (!opts.hideAlbum && getAlbum(track.albumId)) {
    items.push({ label: 'Go to album', icon: <AlbumIcon />, divider: true, onSelect: () => navigate(`/album/${track.albumId}`) });
  }
  if (!opts.hideArtist && !isUpload) {
    items.push({ label: 'Go to artist', icon: <User />, onSelect: () => navigate(`/artist/${track.artistId}`) });
  }
  if (opts.removeFromPlaylist) {
    items.push({ label: 'Remove from this playlist', icon: <Trash2 />, danger: true, divider: true, onSelect: opts.removeFromPlaylist });
  }
  if (isUpload) {
    items.push({
      label: 'Delete upload',
      icon: <Trash2 />,
      danger: true,
      divider: !opts.removeFromPlaylist,
      onSelect: () => {
        void offlineStore.deleteUpload(track.id);
        libraryActions.removeUpload(track.id);
        ui.toast(`Deleted "${track.title}"`);
      },
    });
  }
  return items;
}
