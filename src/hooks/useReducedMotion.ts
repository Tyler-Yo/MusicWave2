import { useMediaQuery } from './useMediaQuery';
import { useSettings } from './usePlayer';

export function useReducedMotion(): boolean {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const pref = useSettings((s) => s.motion);
  return pref === 'reduce' || (pref === 'system' && system);
}
