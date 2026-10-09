import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUI } from '@/hooks/usePlayer';
import { ui } from '@/state/uiStore';
import { cn } from '@/utils/cn';

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-28" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="glass pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line/60 px-4 py-3 text-sm shadow-card animate-fade-up"
        >
          {t.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          ) : t.tone === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 text-danger" />
          ) : (
            <Info className="h-4 w-4 shrink-0 text-accent" />
          )}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              className="rounded-full px-2 py-1 font-semibold text-primary hover:bg-primary/10"
              onClick={() => {
                t.action?.run();
                ui.dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button aria-label="Dismiss notification" className={cn('-mr-1 rounded-full p-1 text-subtle hover:text-fg')} onClick={() => ui.dismissToast(t.id)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
