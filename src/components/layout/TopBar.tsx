import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Keyboard, Moon, Search, Sun, X } from 'lucide-react';
import { Logo } from '@/components/art/Logo';
import { useSettings } from '@/hooks/usePlayer';
import { settingsActions } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

export function SearchInput({ autoFocus = false, className = '' }: { autoFocus?: boolean; className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearch = location.pathname === '/search';
  const [value, setValue] = useState(onSearch ? (params.get('q') ?? '') : '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onSearch) setValue(params.get('q') ?? '');
  }, [onSearch, params]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const update = (q: string) => {
    setValue(q);
    const url = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
    navigate(url, { replace: onSearch });
  };

  return (
    <div className={`relative ${className}`} role="search">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        ref={ref}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && update('')}
        placeholder="Songs, artists, albums, lyrics…"
        aria-label="Search songs, artists, albums, playlists and lyrics"
        className="h-10 w-full rounded-full border border-transparent bg-fg/[0.07] pl-10 pr-10 text-sm font-medium outline-none transition placeholder:text-subtle focus:border-primary/60 focus:bg-fg/[0.04] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button aria-label="Clear search" onClick={() => update('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-subtle hover:text-fg">
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[10px] font-semibold text-subtle lg:block">/</kbd>
      )}
    </div>
  );
}

export function TopBar() {
  const navigate = useNavigate();
  const userName = useSettings((s) => s.userName);
  const theme = useResolvedTheme();
  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/40 px-4 sm:px-6 lg:px-8">
      <Link to="/" className="rounded-xl md:hidden" aria-label="MusicWave home">
        <Logo compact />
      </Link>
      <div className="hidden items-center gap-1 md:flex">
        <button aria-label="Go back" onClick={() => navigate(-1)} className="grid h-8 w-8 place-items-center rounded-full bg-fg/[0.06] text-muted hover:text-fg">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button aria-label="Go forward" onClick={() => navigate(1)} className="grid h-8 w-8 place-items-center rounded-full bg-fg/[0.06] text-muted hover:text-fg">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <SearchInput className="hidden max-w-md flex-1 md:block" />
      <div className="ml-auto flex items-center gap-1">
        <button
          aria-label="Keyboard shortcuts"
          onClick={() => ui.setShortcutsOpen(true)}
          className="hidden h-9 w-9 place-items-center rounded-full text-muted hover:bg-fg/[0.07] hover:text-fg sm:grid"
        >
          <Keyboard className="h-[18px] w-[18px]" />
        </button>
        <button
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => settingsActions.set('theme', theme === 'dark' ? 'light' : 'dark')}
          className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-fg/[0.07] hover:text-fg"
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <Link
          to="/settings"
          aria-label={`Profile and settings for ${userName}`}
          className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-extrabold text-white shadow-glow"
        >
          {initials || '♪'}
        </Link>
      </div>
    </header>
  );
}
