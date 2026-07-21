import { motion } from "./MotionPrimitives";

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  "slide-fade": {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  /** 鸿蒙7风格：右侧微缩滑入 + 弹性缓出 */
  harmony: {
    initial: { opacity: 0, x: 24, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -16, scale: 0.98 },
  },
  /** FadeThrough 淡入过渡：旧淡出 + 新淡入并轻微放大(0.92→1)，无位移 */
  fadethrough: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
};

type TransitionMode = keyof typeof variants;

interface PageTransitionProps {
  children: React.ReactNode;
  transition?: TransitionMode;
}

/**
 * PageTransition - 页面进入/退出动画包装器
 *
 * 支持模式：
 *   fade        — 纯淡入淡出（默认，最快）
 *   slide-up    — 向上滑入
 *   slide-fade  — 侧滑+淡入
 *   scale       — 缩放淡入
 *   harmony     — 鸿蒙7风格：右侧微缩滑入 + 弹性缓出（推荐）
 *
 * ⚠️ 重要：此组件只包裹页面内容区域，
 * Navbar/Header/Sidebar 必须在 AnimatedRoutes 外部，不要包在 PageTransition 里。
 */
const HARMONY_TRANSITION = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };
const FADETHROUGH_TRANSITION = { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };
const DEFAULT_TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const };

/**
 * 是否启用「路由切换页面动画」。
 * 用户要求取消切换时的页面动画，故设为 false：PageTransition 直接渲染内容，
 * 路由切换即时完成，不再有淡入/缩放过渡。
 */
const ENABLE_PAGE_TRANSITION = false;

export function PageTransition({ children, transition = "fade" }: PageTransitionProps) {
  if (!ENABLE_PAGE_TRANSITION) {
    return <div>{children}</div>;
  }

  const v = variants[transition];

  const transitionConfig =
    transition === 'harmony'
      ? HARMONY_TRANSITION
      : transition === 'fadethrough'
        ? FADETHROUGH_TRANSITION
        : DEFAULT_TRANSITION;

  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={transitionConfig}
      // 以顶部为缩放原点：整页微缩放从顶部展开，消除加载/切换时的整体上跳
      style={{ transformOrigin: 'top center' }}
    >
      {children}
    </motion.div>
  );
}
