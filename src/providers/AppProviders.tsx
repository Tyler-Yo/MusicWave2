/**
 * Top-level providers: theme, the player ↔ audio engine binding, global keyboard
 * shortcuts and OS media controls.
 */
import { useEffect, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMediaSession } from '@/hooks/useMediaSession';
import { initOnline } from '@/services/online';
import { initPlayer } from '@/state/playerStore';

function PlayerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPlayer();
    initOnline();
  }, []);
  useKeyboardShortcuts();
  useMediaSession();
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PlayerProvider>{children}</PlayerProvider>
    </ThemeProvider>
  );
}
