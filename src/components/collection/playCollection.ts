import { player, playerStore } from '@/state/playerStore';
import type { PlayContext } from '@/types/music';

/** Plays a collection, or toggles play/pause if it is already the active context. */
export function playCollection(trackIds: string[], context: PlayContext, opts: { shuffle?: boolean } = {}): void {
  const s = playerStore.get();
  if (!opts.shuffle && s.context?.type === context.type && s.context?.id === context.id && s.index >= 0) {
    player.toggle();
    return;
  }
  player.playTracks(trackIds, opts.shuffle ? -1 : 0, context, opts);
}
