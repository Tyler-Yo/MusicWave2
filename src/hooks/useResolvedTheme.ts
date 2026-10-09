import { useMediaQuery } from './useMediaQuery';
import { useSettings } from './usePlayer';

/** The theme actually in effect ("system" resolved via prefers-color-scheme). */
export function useResolvedTheme(): 'dark' | 'light' {
  const pref = useSettings((s) => s.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
}
