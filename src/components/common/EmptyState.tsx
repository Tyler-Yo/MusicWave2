import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center animate-fade-up', className)}>
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
