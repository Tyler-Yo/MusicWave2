import { NavLink } from 'react-router-dom';
import { Compass, Home, Library, PenLine } from 'lucide-react';
import { cn } from '@/utils/cn';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Browse', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/studio', label: 'Studio', icon: PenLine },
];

export function MobileNav() {
  return (
    <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line/50 pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-primary' : 'text-muted')}
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
