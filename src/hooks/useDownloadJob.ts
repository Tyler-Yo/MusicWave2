import { downloadsStore } from '@/services/downloads';
import { useStore } from '@/state/createStore';

/** The in-progress (or failed) download of a track, if any. */
export function useDownloadJob(trackId: string) {
  return useStore(downloadsStore, (s) => s.jobs[trackId]);
}
