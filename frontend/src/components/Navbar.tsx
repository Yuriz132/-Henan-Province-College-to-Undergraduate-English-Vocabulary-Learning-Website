import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, Star, LayoutGrid, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: '概览', icon: LayoutGrid },
  { to: '/browse', label: '浏览', icon: BookOpen },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/starred', label: '生词本', icon: Star },
];

export function Navbar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="liquid-glass mx-auto mt-3 flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6"
        style={{ borderRadius: 'calc(var(--radius) + 8px)' }}
      >
        <Link to="/" className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80 active:scale-95">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight" style={{ fontSize: 'var(--font-size-title)' }}>
            Liquid Words
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all active:scale-95',
                  active
                    ? 'liquid-glass-accent text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
