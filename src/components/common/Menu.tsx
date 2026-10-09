/**
 * Dropdown menu with roving keyboard focus (↑/↓/Home/End/Esc), outside-click
 * dismissal and viewport-aware positioning. Rendered in a portal.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Renders a divider above this item. */
  divider?: boolean;
  checked?: boolean;
}

export function Menu({
  trigger,
  items,
  label,
  align = 'end',
}: {
  trigger: (props: { onClick: (e: React.MouseEvent<HTMLElement>) => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; ref: (el: HTMLElement | null) => void }) => ReactNode;
  items: MenuItem[];
  label: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    let left = align === 'end' ? r.right - m.width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    let top = r.bottom + 6;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 6);
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') els[(i + 1) % els.length]?.focus();
    else if (e.key === 'ArrowUp') els[(i - 1 + els.length) % els.length]?.focus();
    else if (e.key === 'Home') els[0]?.focus();
    else if (e.key === 'End') els[els.length - 1]?.focus();
    else if (e.key === 'Escape' || e.key === 'Tab') close(e.key === 'Escape');
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          e.preventDefault();
          setPos(null);
          setOpen((o) => !o);
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        ref: (el) => {
          triggerRef.current = el;
        },
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="glass fixed z-[95] min-w-[220px] max-w-[300px] rounded-2xl border border-line/70 p-1.5 shadow-2xl animate-scale-in"
          >
            {items.map((item, i) => (
              <div key={`${item.label}-${i}`}>
                {item.divider && <div className="my-1 h-px bg-line/70" role="separator" />}
                <button
                  role="menuitem"
                  aria-disabled={item.disabled || undefined}
                  tabIndex={-1}
                  onClick={() => {
                    if (item.disabled) return;
                    close();
                    item.onSelect?.();
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors',
                    'hover:bg-fg/[0.07] focus-visible:bg-fg/[0.09] focus-visible:outline-none',
                    item.danger ? 'text-danger' : 'text-fg',
                    item.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="grid h-4 w-4 place-items-center text-muted [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.checked && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="selected" />}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
