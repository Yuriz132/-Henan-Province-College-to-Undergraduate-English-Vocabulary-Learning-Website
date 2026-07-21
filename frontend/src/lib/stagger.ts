import type { Variants } from 'framer-motion';
import { getNavDirection } from './navDirection';

/**
 * stagger — 页面错落入场/出场共享变体（移植自鸿蒙 Tab 错落切换）
 *
 * 对应鸿蒙：
 *   - 容器 STAGGER_CONTAINER  ≈ 父组件统一调度（staggerChildren 编排子项节奏）
 *   - 子项 staggerItemV        ≈ 子页面 playEnterAnimation / playExitAnimation
 *       · 入场：spring 弹性回弹，分块自上而下依次滑入（staggerChildren 控制间隔）
 *       · 出场：easeIn 加速，x 方向跟随切换方向同步滑出
 *
 * 子项变体用「函数形式」在动画时刻实时读取 getNavDirection()，
 * 因此退场的旧页与进入的新页会采用同一个切换方向（避免旧页反向滑出）。
 */

/** 错落位移距离(px)：对应鸿蒙 ±350vp，Web 端取适中值，既有层次又不夸张 */
export const STAGGER_DISTANCE = 48;

/** 入场相邻子项间隔、首延迟 */
export const STAGGER_STEP = 0.06;
export const STAGGER_DELAY = 0.04;

/** 容器：仅负责编排子项节奏 + 整页淡入淡出（自身不做位移） */
export const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.25,
      staggerChildren: STAGGER_STEP,
      delayChildren: STAGGER_DELAY,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

/** 子项：错落入场(spring) + 同步出场(easeIn)，方向实时读取 */
export const staggerItemV: Variants = {
  hidden: () => {
    const d = getNavDirection();
    return { opacity: 0, x: d === 'left' ? STAGGER_DISTANCE : -STAGGER_DISTANCE };
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  },
  exit: () => {
    const d = getNavDirection();
    return {
      opacity: 0,
      x: d === 'left' ? -STAGGER_DISTANCE : STAGGER_DISTANCE,
      transition: { duration: 0.22, ease: 'easeIn' },
    };
  },
};
