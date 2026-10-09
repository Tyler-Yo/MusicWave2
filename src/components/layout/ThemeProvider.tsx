/** Applies the theme and motion preferences to <html>. */
import { useEffect } from 'react';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useSettings } from '@/hooks/usePlayer';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useResolvedTheme();
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = motion;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#090b14' : '#f5f6fb');
  }, [theme, motion]);
  return <>{children}</>;
}
