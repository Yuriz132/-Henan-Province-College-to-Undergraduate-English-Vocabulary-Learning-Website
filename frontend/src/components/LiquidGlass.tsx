import { useEffect, useRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

/**
 * 液态玻璃容器 —— 真实折射由全局 SVG 滤镜 #liquidGlass 提供（见 LiquidGlassDefs）。
 *
 * 用法与旧版兼容：<LiquidGlass as="div|button|nav" className style radius blur onClick>…</LiquidGlass>
 *  - 组件本身不再注入内联滤镜，而是给元素加上 .liquid-glass 类，
 *    由 index.css 中的 `backdrop-filter: url(#liquidGlass) …` 统一实现折射 + 色散 + 磨砂。
 *  - elastic：开启「鼠标临近挤压」弹性（默认关闭，避免与顶栏隐藏等 transform 冲突）。
 *  - overLight：亮背景上压暗玻璃。
 */

type LiquidGlassProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 圆角半径(px)；不传则使用 style.borderRadius 或 CSS 默认 */
  radius?: number;
  /** 背景磨砂模糊(px)；传入则叠加在全局折射之上，覆盖默认 */
  blur?: number;
  /** 渲染标签，默认 div */
  as?: 'div' | 'button' | 'header' | 'section' | 'nav';
  /** 鼠标临近弹性挤压（仅用于无自身 transform 的元素，如 FAB） */
  elastic?: boolean;
  /** 亮背景上压暗玻璃 */
  overLight?: boolean;
};

export function LiquidGlass({
  children,
  className = '',
  style,
  radius,
  blur,
  as = 'div',
  elastic = false,
  overLight = false,
  ...rest
}: LiquidGlassProps) {
  const ref = useRef<HTMLElement>(null);

  // 鼠标临近弹性挤压：光标靠近时玻璃朝光标方向轻微拉伸 + 位移
  useEffect(() => {
    const el = ref.current;
    if (!el || !elastic) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const edge =
          Math.max(0, Math.abs(dx) - r.width / 2) + Math.max(0, Math.abs(dy) - r.height / 2);
        const zone = 160;
        if (edge > zone) {
          el.style.setProperty('--lg-elastic', '');
          return;
        }
        const f = 1 - edge / zone;
        const sx = 1 + Math.min(Math.abs(dx) / (r.width / 2), 1) * 0.06 * f;
        const sy = 1 + Math.min(Math.abs(dy) / (r.height / 2), 1) * 0.06 * f;
        const tx = dx * 0.04 * f;
        const ty = dy * 0.04 * f;
        el.style.setProperty('--lg-elastic', `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`);
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.setProperty('--lg-elastic', '');
    };
  }, [elastic]);

  const Tag: ElementType = as;

  const backdropUrl =
    blur != null
      ? {
          backdropFilter: `url(#liquidGlass) blur(${blur}px) saturate(1.6) brightness(1.05)`,
          WebkitBackdropFilter: `url(#liquidGlass) blur(${blur}px) saturate(1.6) brightness(1.05)`,
        }
      : {};

  const mergedStyle: CSSProperties = {
    ...style,
    borderRadius: radius != null ? `${radius}px` : style?.borderRadius,
    ...backdropUrl,
  };

  const cls = [
    'liquid-glass',
    elastic ? 'lg-elastic' : '',
    overLight ? 'liquid-glass-overlight' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag ref={ref as any} className={cls} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
}
