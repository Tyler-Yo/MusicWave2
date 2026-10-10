/** Shared track actions used by context menus, Now Playing and keyboard shortcuts. */
import {
  Album as AlbumIcon,
  CheckCircle2,
  Download,
  ExternalLink,
  Heart,
  HeartOff,
  ListEnd,
  ListPlus,
  ListStart,
  Mic2,
  PenLine,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { MenuItem } from '@/components/common/Menu';
import { albumHref, artistHref } from '@/services/catalog';
import { cancelDownload, downloadsStore, isDownloadable, toggleDownload } from '@/services/downloads';
import { hasLyrics } from '@/services/lyrics';
import { offlineStore } from '@/services/offlineStore';
import { libraryActions, libraryStore } from '@/state/libraryStore';
import { player } from '@/state/playerStore';
import { ui } from '@/state/uiStore';
import type { Track } from '@/types/music';

export { toggleDownload };

const SOURCE_NAME = { audius: 'Audius', archive: 'Internet Archive' } as const;

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
  const job = downloadsStore.get().jobs[track.id];
  if (job && job.status !== 'error') {
    items.push({ label: 'Cancel download', icon: <XCircle />, onSelect: () => cancelDownload(track.id) });
  } else if (isDownloadable(track)) {
    items.push({
      label: downloaded ? 'Remove download' : job?.status === 'error' ? 'Retry download' : 'Download',
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
  const album = albumHref(track);
  const artist = artistHref(track);
  if (!opts.hideAlbum && album) {
    items.push({ label: track.provider === 'archive' ? 'Go to recording' : 'Go to album', icon: <AlbumIcon />, divider: true, onSelect: () => navigate(album) });
  }
  if (!opts.hideArtist && artist) {
    items.push({ label: 'Go to artist', icon: <User />, divider: !album || opts.hideAlbum, onSelect: () => navigate(artist) });
  }
  if (track.pageUrl && (track.provider === 'audius' || track.provider === 'archive')) {
    const page = track.pageUrl;
    items.push({ label: `Open on ${SOURCE_NAME[track.provider]}`, icon: <ExternalLink />, onSelect: () => window.open(page, '_blank', 'noopener,noreferrer') });
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
