/** Horizontal, snap-scrolling carousel with arrow buttons and an optional "See all" link. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Shelf({
  title,
  subtitle,
  seeAllHref,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const headingId = `shelf-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className={cn('group/shelf relative', className)} aria-labelledby={headingId}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {seeAllHref && (
            <Link to={seeAllHref} className="mr-2 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-fg/5 hover:text-fg">
              See all
            </Link>
          )}
          <button
            aria-label={`Scroll ${title} left`}
            disabled={edges.start}
            onClick={() => scroll(-1)}
            className="hidden h-8 w-8 place-items-center rounded-full bg-fg/[0.06] text-fg transition hover:bg-fg/10 disabled:opacity-30 sm:grid"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label={`Scroll ${title} right`}
            disabled={edges.end}
            onClick={() => scroll(1)}
            className="hidden h-8 w-8 place-items-center rounded-full bg-fg/[0.06] text-fg transition hover:bg-fg/10 disabled:opacity-30 sm:grid"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        onScroll={update}
        role="list"
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-5 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
      >
        {children}
      </div>
    </section>
  );
}
