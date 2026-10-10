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

/** Plays an online album / playlist / recording, loading its track list first if needed. */
export async function playRemoteCollection(id: string, context: PlayContext, opts: { shuffle?: boolean } = {}): Promise<void> {
  const s = playerStore.get();
  if (!opts.shuffle && s.context?.type === context.type && s.context?.id === context.id && s.index >= 0) {
    player.toggle();
    return;
  }
  const { onlineCatalog } = await import('@/services/onlineCatalog');
  const { ui } = await import('@/state/uiStore');
  try {
    const data = onlineCatalog.cachedCollection(id) ?? (await onlineCatalog.collection(id));
    if (!data || data.tracks.length === 0) {
      ui.toast('Nothing playable in this collection', 'error');
      return;
    }
    player.playTracks(
      data.tracks.map((t) => t.id),
      opts.shuffle ? -1 : 0,
      context,
      opts,
    );
  } catch (err) {
    ui.toast(err instanceof Error ? `Couldn’t load it: ${err.message}` : 'Couldn’t load it', 'error');
  }
}
