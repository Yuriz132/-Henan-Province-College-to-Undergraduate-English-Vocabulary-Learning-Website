import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, Star, LayoutGrid, Sparkles, ShieldCheck, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdmin, tryEnableAdmin, disableAdmin } from '@/lib/admin';

const navItems = [
  { to: '/', label: '概览', icon: LayoutGrid },
  { to: '/browse', label: '浏览', icon: BookOpen },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/starred', label: '生词本', icon: Star },
];

export function Navbar() {
  const location = useLocation();
  const isDev = useAdmin();

  // 连续点击左上角“升本词汇”若干次 → 弹出验证码输入，输入正确即进入开发者模式
  const [clicks, setClicks] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  const lastClick = useRef(0);

  const onBrandClick = () => {
    if (isDev) return; // 已是开发者模式则不再计数
    const now = Date.now();
    if (now - lastClick.current > 2000) setClicks(0); // 超过 2 秒重置计数
    lastClick.current = now;
    const next = clicks + 1;
    setClicks(next);
    if (next >= 5) {
      setClicks(0);
      setShowCode(true);
    }
  };

  const submitCode = () => {
    if (tryEnableAdmin(code)) {
      setCode('');
      setShowCode(false);
    } else {
      setCode('');
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="liquid-glass mx-auto mt-3 flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6"
        style={{ borderRadius: 'calc(var(--radius) + 8px)' }}
      >
        <div className="relative">
          <Link
            to="/"
            onClick={onBrandClick}
            className={cn(
              'flex items-center gap-2 text-foreground transition-opacity hover:opacity-80 active:scale-95',
              shake && 'animate-pulse'
            )}
            title="连续点击 5 次可进入开发者模式"
          >
            <Sparkles className={cn('h-5 w-5', isDev ? 'text-success' : 'text-primary')} />
            <span className="font-bold tracking-tight" style={{ fontSize: 'var(--font-size-title)' }}>
              升本词汇
            </span>
            {isDev && <ShieldCheck className="h-3.5 w-3.5 text-success" />}
          </Link>

          {/* 开发者模式验证码输入 */}
          {showCode && (
            <div className="absolute left-0 top-full z-50 mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-2 shadow-lg backdrop-blur-xl">
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCode();
                  if (e.key === 'Escape') { setShowCode(false); setCode(''); }
                }}
                type="password"
                placeholder="验证码"
                className="h-8 w-28 rounded-lg bg-white/5 px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={submitCode}
                className="flex h-8 items-center rounded-lg px-2 text-xs text-primary transition-all hover:bg-white/5 active:scale-95"
              >
                进入
              </button>
              <button
                onClick={() => { setShowCode(false); setCode(''); }}
                className="flex h-8 items-center rounded-lg px-2 text-xs text-muted-foreground transition-all hover:bg-white/5 active:scale-95"
              >
                取消
              </button>
            </div>
          )}
        </div>

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
          {isDev && (
            <button
              onClick={() => disableAdmin()}
              title="退出开发者模式"
              className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-success transition-all active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
