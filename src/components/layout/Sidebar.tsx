import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowDownCircle, Compass, Heart, Home, Library, ListMusic, PenLine, Plus, Settings } from 'lucide-react';
import { Logo } from '@/components/art/Logo';
import { useLibrary } from '@/hooks/usePlayer';
import { libraryActions } from '@/state/libraryStore';
import { cn } from '@/utils/cn';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Browse', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/downloads', label: 'Downloads', icon: ArrowDownCircle },
  { to: '/studio', label: 'Lyrics Studio', icon: PenLine },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
    isActive ? 'bg-fg/[0.08] text-fg' : 'text-muted hover:bg-fg/[0.05] hover:text-fg',
  );

export function Sidebar() {
  const playlists = useLibrary((s) => s.playlists);
  const likedCount = useLibrary((s) => Object.keys(s.likedTracks).length);
  const navigate = useNavigate();
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line/50 bg-elevated/40 md:flex" aria-label="Sidebar">
      <div className="px-5 pb-4 pt-6">
        <NavLink to="/" aria-label="MusicWave home" className="inline-block rounded-xl">
          <Logo />
        </NavLink>
      </div>
      <nav aria-label="Main" className="space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 flex items-center justify-between px-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-subtle">Your playlists</h2>
        <button
          aria-label="Create playlist"
          className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-fg/[0.07] hover:text-fg"
          onClick={() => {
            const p = libraryActions.createPlaylist(`My Playlist #${playlists.length + 1}`);
            navigate(`/playlist/${p.id}`);
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <nav aria-label="Playlists" className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-28">
        <NavLink to="/library?tab=songs" className={linkClass}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-ember to-accent text-white">
            <Heart className="h-4 w-4" fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1 truncate">Liked Songs</span>
          <span className="text-xs text-subtle">{likedCount}</span>
        </NavLink>
        {playlists.map((p) => (
          <NavLink key={p.id} to={`/playlist/${p.id}`} className={linkClass}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-fg/[0.07]">
              <ListMusic className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
