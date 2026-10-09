import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Heart, ListMusic, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react';
import { TrackList } from '@/components/cards/TrackList';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { PlayActions } from '@/components/collection/PlayActions';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Menu } from '@/components/common/Menu';
import { useLibrary } from '@/hooks/usePlayer';
import { getPlaylist, getTracks, playlistCover, userPlaylistToPlaylist } from '@/services/catalog';
import { libraryActions } from '@/state/libraryStore';
import { ui } from '@/state/uiStore';
import { formatTotal, plural, relativeTime } from '@/utils/format';

function EditPlaylistDialog({ id, title, description, onClose }: { id: string; title: string; description: string; onClose: () => void }) {
  const [t, setT] = useState(title);
  const [d, setD] = useState(description);
  return (
    <Dialog open onClose={onClose} title="Edit playlist details">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          libraryActions.updatePlaylist(id, { title: t.trim() || title, description: d.trim() });
          onClose();
        }}
      >
        <label className="block text-sm font-semibold">
          Name
          <input data-autofocus value={t} onChange={(e) => setT(e.target.value)} maxLength={80} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-sm font-semibold">
          Description
          <textarea value={d} onChange={(e) => setD(e.target.value)} rows={3} maxLength={300} className="mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary" />
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={<Check className="h-4 w-4" />}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function PlaylistPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const userPlaylist = useLibrary((s) => s.playlists.find((p) => p.id === id));
  const saved = useLibrary((s) => Boolean(s.savedPlaylists[id]));
  useLibrary((s) => s.uploads);
  const [editing, setEditing] = useState(false);
  const playlist = userPlaylist ? userPlaylistToPlaylist(userPlaylist) : getPlaylist(id);
  if (!playlist) return <EmptyState icon={<ListMusic className="h-7 w-7" />} title="Playlist not found">It may have been deleted.</EmptyState>;

  const tracks = getTracks(playlist.trackIds);
  const total = tracks.reduce((a, t) => a + t.duration, 0);
  const context = { type: 'playlist' as const, id: playlist.id, name: playlist.title, href: `/playlist/${playlist.id}` };

  return (
    <div className="space-y-8">
      <CollectionHeader
        cover={playlistCover(playlist)}
        kind={playlist.isUser ? 'Your playlist' : 'Playlist'}
        title={playlist.title}
        description={playlist.description || (playlist.isUser ? 'Add a description from the edit menu.' : undefined)}
        palette={playlist.palette}
        meta={
          <>
            <span className="font-bold text-fg">{playlist.curator}</span>
            <span>· {plural(tracks.length, 'song')}{tracks.length ? `, ${formatTotal(total)}` : ''}</span>
            {userPlaylist && <span>· Updated {relativeTime(userPlaylist.updatedAt)}</span>}
          </>
        }
        actions={
          <>
            <PlayActions trackIds={playlist.trackIds} context={context} />
            {playlist.isUser ? (
              <Menu
                label="Playlist options"
                align="start"
                items={[
                  { label: 'Edit details', icon: <Pencil />, onSelect: () => setEditing(true) },
                  {
                    label: 'Delete playlist',
                    icon: <Trash2 />,
                    danger: true,
                    divider: true,
                    onSelect: () => {
                      libraryActions.deletePlaylist(playlist.id);
                      ui.toast(`Deleted “${playlist.title}”`);
                      navigate('/library');
                    },
                  },
                ]}
                trigger={(props) => (
                  <button {...props} aria-label="Playlist options" className="grid h-12 w-12 place-items-center rounded-full text-muted hover:bg-fg/[0.07] hover:text-fg">
                    <MoreHorizontal className="h-6 w-6" />
                  </button>
                )}
              />
            ) : (
              <Button
                size="lg"
                variant="ghost"
                aria-pressed={saved}
                className={saved ? '!text-ember' : ''}
                onClick={() => libraryActions.toggleSavePlaylist(playlist.id)}
                icon={<Heart className="h-5 w-5" fill={saved ? 'currentColor' : 'none'} />}
              >
                {saved ? 'Saved' : 'Save'}
              </Button>
            )}
          </>
        }
      />
      {tracks.length === 0 ? (
        <EmptyState
          icon={<ListMusic className="h-7 w-7" />}
          title="This playlist is empty"
          action={
            <Button variant="primary" icon={<Search className="h-4 w-4" />} onClick={() => navigate('/search')}>
              Find songs
            </Button>
          }
        >
          Use “Add to playlist…” from any song’s ⋯ menu to fill it up.
        </EmptyState>
      ) : (
        <TrackList
          tracks={tracks}
          context={context}
          onRemove={
            playlist.isUser
              ? (i) => {
                  libraryActions.removeFromPlaylist(playlist.id, i);
                  ui.toast(`Removed from ${playlist.title}`);
                }
              : undefined
          }
        />
      )}
      {editing && userPlaylist && <EditPlaylistDialog id={userPlaylist.id} title={userPlaylist.title} description={userPlaylist.description} onClose={() => setEditing(false)} />}
    </div>
  );
}
