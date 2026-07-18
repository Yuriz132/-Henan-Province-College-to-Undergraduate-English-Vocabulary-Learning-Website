import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Star, LayoutGrid, BookMarked, GitCompareArrows, AudioLines } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiquidGlass } from '@/components/LiquidGlass';
import { AccountMenu } from '@/components/AccountMenu';

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
const IDLE_HIDE_MS = 4500;
// 左右滑动切换页面的阈值（px）
const SWIPE_THRESHOLD = 45;

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const hideTimer = useRef<number | null>(null);

  // 滑动高亮指示层的位置/尺寸
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // 根据当前路由计算高亮层坐标（相对 nav 容器）
  const calcIndicator = () => {
    const idx = navItems.findIndex((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    );
    const el = idx >= 0 ? linkRefs.current[idx] : null;
    if (el && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ left: elRect.left - navRect.left, width: elRect.width, ready: true });
    }
  };

  // 路由变化时平滑移动高亮层
  useLayoutEffect(() => {
    calcIndicator();
  }, [location.pathname]);

  // 尺寸变化（响应式显示文字等）重新对齐
  useEffect(() => {
    const onResize = () => calcIndicator();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 不滑动 / 不操作超过 2s → 顶栏上滑隐藏；任意操作 → 立即弹出并重置计时
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

  // 左右滑动切换页面：触摸滑动 / 触控板双指(滚轮 deltaX) / 鼠标拖拽 统一处理
  const lastNav = useRef(0);
  const pathRef = useRef(location.pathname);
  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const findIdx = () =>
      navItems.findIndex((item) =>
        item.to === '/' ? pathRef.current === '/' : pathRef.current.startsWith(item.to)
      );
    const go = (dir: number) => {
      const now = Date.now();
      if (now - lastNav.current < 600) return; // 冷却，避免一次滑动连续翻页
      const idx = findIdx();
      if (idx === -1) return;
      const next = idx + dir;
      if (next >= 0 && next < navItems.length) {
        lastNav.current = now;
        navigate(navItems[next].to);
      }
    };

    // 触控板双指横向滑动：wheel 事件的 deltaX 主导
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > SWIPE_THRESHOLD) {
        go(e.deltaX < 0 ? 1 : -1);
      }
    };

    // 鼠标拖拽 / 触摸滑动：pointer 事件，水平位移且大于垂直、超过阈值才触发
    let sx = 0;
    let sy = 0;
    let tracking = false;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      // 在输入框/按钮/链接/弹窗上不起始，避免误触与干扰点击
      if (t && t.closest('input,textarea,select,button,a,[role="dialog"]')) return;
      sx = e.clientX;
      sy = e.clientY;
      tracking = true;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        go(dx > 0 ? -1 : 1);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [navigate]);

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
        <nav ref={navRef} className="relative flex items-center gap-1">
          {/* 滑动高亮指示层：选中项之间平移移动（视觉上的"滑过去"） */}
          {indicator.ready && (
            <span
              aria-hidden="true"
              className="nav-indicator"
              style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
            />
          )}
          {navItems.map((item, i) => {
            const active = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                ref={(el) => { linkRefs.current[i] = el; }}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors duration-300',
                  active
                    ? 'nav-item-active'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 transition-transform', active && 'nav-icon-bounce')} />
                <span className={cn('hidden sm:inline', active && 'nav-label-pop')}>{item.label}</span>
              </Link>
            );
          })}
          <AccountMenu />
        </nav>
      </LiquidGlass>
    </header>
  );
}
