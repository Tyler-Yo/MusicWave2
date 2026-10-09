/** Desktop side drawer showing the queue while browsing. */
import { X } from 'lucide-react';
import { useUI } from '@/hooks/usePlayer';
import { ui } from '@/state/uiStore';
import { QueuePanel } from './QueuePanel';

export function QueueDrawer() {
  const open = useUI((s) => s.queueDrawerOpen);
  if (!open) return null;
  return (
    <aside
      aria-label="Queue"
      className="glass fixed bottom-[5.5rem] right-0 top-0 z-30 hidden w-[380px] flex-col border-l border-line/60 p-4 shadow-2xl animate-fade-in md:flex"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Queue</h2>
        <button aria-label="Close queue" onClick={() => ui.toggleQueueDrawer(false)} className="rounded-full p-2 text-muted hover:bg-fg/5 hover:text-fg">
          <X className="h-5 w-5" />
        </button>
      </div>
      <QueuePanel tone="panel" className="min-h-0 flex-1" />
    </aside>
  );
}
