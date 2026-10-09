import { useState } from 'react';
import { ListMusic, Plus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { useLibrary, useUI } from '@/hooks/usePlayer';
import { libraryActions } from '@/state/libraryStore';
import { ui } from '@/state/uiStore';
import { plural } from '@/utils/format';

export function AddToPlaylistDialog() {
  const target = useUI((s) => s.addToPlaylist);
  const playlists = useLibrary((s) => s.playlists);
  const [name, setName] = useState('');

  const close = () => {
    setName('');
    ui.closeAddToPlaylist();
  };
  if (!target) return null;
  const count = target.trackIds.length;

  const addTo = (id: string, title: string) => {
    const added = libraryActions.addToPlaylist(id, target.trackIds);
    ui.toast(added ? `Added ${plural(added, 'song')} to ${title}` : `Already in ${title}`, added ? 'success' : 'info');
    close();
  };

  return (
    <Dialog open onClose={close} title="Add to playlist" description={`${plural(count, 'song')} selected`}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const p = libraryActions.createPlaylist(name || 'New Playlist', target.trackIds);
          ui.toast(`Created “${p.title}”`, 'success');
          close();
        }}
      >
        <input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name"
          aria-label="New playlist name"
          className="h-10 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-primary"
        />
        <Button type="submit" variant="primary" icon={<Plus className="h-4 w-4" />}>
          Create
        </Button>
      </form>
      {playlists.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">You don’t have any playlists yet — create one above.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {playlists.map((p) => (
            <li key={p.id}>
              <button onClick={() => addTo(p.id, p.title)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-fg/[0.06]">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30">
                  <ListMusic className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.title}</span>
                  <span className="block text-xs text-muted">{plural(p.trackIds.length, 'song')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
