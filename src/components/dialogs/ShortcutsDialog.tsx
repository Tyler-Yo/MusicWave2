import { Dialog } from '@/components/common/Dialog';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { useUI } from '@/hooks/usePlayer';
import { ui } from '@/state/uiStore';

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcutsOpen);
  return (
    <Dialog open={open} onClose={() => ui.setShortcutsOpen(false)} title="Keyboard shortcuts" description="Work anywhere outside text fields.">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        {SHORTCUTS.map(([key, action]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs font-semibold">{key}</kbd>
            </dt>
            <dd className="text-muted">{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
