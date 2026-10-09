import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/common/Toaster';
import { AddToPlaylistDialog } from '@/components/dialogs/AddToPlaylistDialog';
import { ShortcutsDialog } from '@/components/dialogs/ShortcutsDialog';
import { NowPlaying } from '@/components/player/NowPlaying';
import { PlayerBar } from '@/components/player/PlayerBar';
import { QueueDrawer } from '@/components/player/QueueDrawer';
import { ShelfSkeleton } from '@/components/common/Skeleton';
import { useCurrentTrack, useSettings, useUI } from '@/hooks/usePlayer';
import { CloudOff } from 'lucide-react';
import { MobileNav } from './MobileNav';
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
  const offline = useSettings((s) => s.offlineMode);

  // Scroll to top on navigation (but not when only the search query changes).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <a href="#main" className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Sidebar />
      <main id="main" ref={mainRef} tabIndex={-1} className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden outline-none">
        <TopBar />
        {offline && (
          <div className="flex items-center justify-center gap-2 bg-ember/15 px-4 py-2 text-center text-sm font-semibold text-ember">
            <CloudOff className="h-4 w-4" /> Offline mode — only downloaded and uploaded tracks can play.
          </div>
        )}
        <div key={location.pathname} className={`animate-fade-up px-4 pb-10 pt-6 sm:px-6 lg:px-8 ${hasTrack ? 'pb-44 md:pb-32' : 'pb-28 md:pb-12'}`}>
          <Suspense fallback={<ShelfSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <QueueDrawer />
      <PlayerBar />
      <MobileNav />
      <NowPlaying />
      <Toaster />
      <AddToPlaylistDialog />
      <ShortcutsDialog />
      <LiveRegion />
    </div>
  );
}
