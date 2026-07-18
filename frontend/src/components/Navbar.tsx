import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, Star, LayoutGrid, BookMarked, GitCompareArrows, AudioLines } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiquidGlass } from '@/components/LiquidGlass';

const navItems = [
  { to: '/', label: '概览', icon: LayoutGrid },
  { to: '/browse', label: '浏览', icon: BookOpen },
  { to: '/custom', label: '词库', icon: BookMarked },
  { to: '/quiz', label: '测验', icon: AudioLines },
  { to: '/confusables', label: '辨析', icon: GitCompareArrows },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/starred', label: '生词本', icon: Star },
];

// 空闲多久后自动上滑隐藏（ms）
const IDLE_HIDE_MS = 2000;

export function Navbar() {
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const hideTimer = useRef<number | null>(null);

  // 不滑动 / 不操作超过 6s → 顶栏上滑隐藏；任意操作 → 立即弹出并重置计时
  useEffect(() => {
    const wake = () => {
      setHidden(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setHidden(true), IDLE_HIDE_MS);
    };
    wake(); // 启动首次计时

    const events = ['scroll', 'mousemove', 'touchstart', 'touchmove', 'pointerdown', 'click', 'keydown', 'wheel'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full">
      <LiquidGlass
        as="div"
        className={cn(
          'liquid-glass lg-imm-bar mx-auto mt-3 flex max-w-5xl items-center justify-center gap-1 px-4 py-2.5 sm:px-6',
          hidden ? 'lg-imm-hidden' : 'lg-imm-visible'
        )}
        style={{ borderRadius: 'calc(var(--radius) + 8px)' }}
      >
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
      </LiquidGlass>
    </header>
  );
}
