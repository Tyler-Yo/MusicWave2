import { Suspense, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/common/Toaster';
import { AddToPlaylistDialog } from '@/components/dialogs/AddToPlaylistDialog';
import { ShortcutsDialog } from '@/components/dialogs/ShortcutsDialog';
import { NowPlaying } from '@/components/player/NowPlaying';
import { PlayerBar } from '@/components/player/PlayerBar';
import { QueueDrawer } from '@/components/player/QueueDrawer';
import { ShelfSkeleton } from '@/components/common/Skeleton';
import { useCurrentTrack, useUI } from '@/hooks/usePlayer';
import { useOffline } from '@/state/networkStore';
import { CloudOff, WifiOff } from 'lucide-react';
import { MobileNav } from './MobileNav';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

function LiveRegion() {
  const text = useUI((s) => s.announcement);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const hasTrack = Boolean(useCurrentTrack());
  const { offline, connected } = useOffline();
  const nowPlayingOpen = useUI((s) => s.nowPlayingOpen);
  // While the full-screen player is open, everything behind it is inert (not focusable or announced).
  const inert = nowPlayingOpen ? ({ inert: '' } as Record<string, string>) : {};

  // Scroll to top on navigation (but not when only the search query changes).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <a href="#main" className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="contents" {...inert}>
        <Sidebar />
      </div>
      <main {...inert} id="main" ref={mainRef} tabIndex={-1} className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden outline-none">
        <TopBar />
        {offline && (
          <div role="status" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-ember/15 px-4 py-2 text-center text-sm font-semibold text-ember">
            {connected ? <CloudOff className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connected ? 'Offline mode is on' : 'You’re offline'} — downloaded music still plays.
            <Link to="/downloads" className="underline underline-offset-2">
              Go to Downloads
            </Link>
          </div>
        )}
        <div key={location.pathname} className={`animate-fade-up px-4 pb-10 pt-6 sm:px-6 lg:px-8 ${hasTrack ? 'pb-44 md:pb-32' : 'pb-28 md:pb-12'}`}>
          <RouteErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<ShelfSkeleton />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </div>
      </main>
      <div className="contents" {...inert}>
        <QueueDrawer />
        <PlayerBar />
        <MobileNav />
      </div>
      <NowPlaying />
      <Toaster />
      <AddToPlaylistDialog />
      <ShortcutsDialog />
      <LiveRegion />
    </div>
  );
}
