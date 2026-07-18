import { motion, type Variants, type HTMLMotionProps, useReducedMotion } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import React from 'react';

// ── Shared easing & duration tokens ──
const ease = [0.25, 0.46, 0.45, 0.94] as const;
/** 鸿蒙风格弹性缓出曲线（类 spring，用于页面切换和卡片飞入） */
const harmonyEase = [0.22, 1, 0.36, 1] as const;
const springBounce = { type: 'spring', damping: 20, stiffness: 300 } as const;
/** 开屏飞入物理弹簧参数 */
const explodeSpring = { type: 'spring' as const, damping: 18, stiffness: 280 };

// ── Variant factories ──
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease } },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease } },
};

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(12px)' },
  visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.6, ease } },
};

/**
 * flyIn — 增强版飞入：缩放 + 上移 + 模糊淡出
 * 替代 fadeUp 用于卡片滚动进入视口的过渡效果
 */
export const flyIn: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 36, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: harmonyEase },
  },
};

/**
 * explodeIn — 开屏飞入基础变体（仅 scale + opacity）
 * 实际位置偏移由 ExplodeIn 组件通过 ref 测量动态计算
 */
export const explodeIn: Variants = {
  hidden: { opacity: 0, scale: 0.35 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: explodeSpring,
  },
};

// ── Stagger container ──
export const staggerContainer = (stagger = 0.1, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
});

// ── Generic viewport-triggered wrapper (FadeIn) ──
interface FadeInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variants?: Variants;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, variants = fadeUp, delay = 0, duration, className, once = true, amount = 0.2, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      transition={delay || duration ? { delay, ...(duration ? { duration } : {}) } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
FadeIn.displayName = 'FadeIn';

// ── FlyIn: 视口触发的增强飞入组件 ──
interface FlyInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** 动画变体（默认 flyIn） */
  variants?: Variants;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: number;
  /** 'view' = 滚入视口触发(默认), 'mount' = 挂载即触发(开屏飞入) */
  mode?: 'view' | 'mount';
}

export const FlyIn = forwardRef<HTMLDivElement, FlyInProps>(
  ({ children, variants = flyIn, delay = 0, className, once = true, amount = 0.15, mode = 'view', ...props }, ref) => {
    const prefersReduced = useReducedMotion();
    if (prefersReduced) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }

    const shared = {
      ref,
      variants,
      initial: 'hidden' as const,
      className,
      ...props,
    };

    if (mode === 'mount') {
      return (
        <motion.div {...shared} animate="visible" transition={delay ? { delay } : undefined}>
          {children}
        </motion.div>
      );
    }

    return (
      <motion.div
        {...shared}
        whileInView="visible"
        viewport={{ once, amount }}
        transition={delay ? { delay } : undefined}
      >
        {children}
      </motion.div>
    );
  },
);
FlyIn.displayName = 'FlyIn';

// ── ExplodeIn: HarmonyOS 开屏飞入（固定动画，无布局测量，稳定可靠） ──
interface ExplodeInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** 初始缩放比例，默认 0.5 */
  initialScale?: number;
}

export const ExplodeIn = forwardRef<HTMLDivElement, ExplodeInProps>(
  ({ children, delay = 0, className, initialScale = 0.5, ...props }, ref) => {
    const prefersReduced = useReducedMotion();

    if (prefersReduced) {
      return <div ref={ref} className={className} {...(props as Record<string, unknown>)}>{children}</div>;
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: initialScale, y: 36 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ...explodeSpring, delay: delay || undefined }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
ExplodeIn.displayName = 'ExplodeIn';

// ── Stagger parent (triggers children) ──
interface StaggerProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: number;
  /**
   * 子项默认使用的动画变体。
   * 设为 'flyIn' 则子项自动获得缩放+模糊+弹性的飞入效果。
   * 不传则子项需自行声明 variants（向后兼容）。
   */
  childVariant?: 'flyIn' | 'fadeUp';
}

export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(
  ({ children, stagger = 0.08, delay = 0, className, once = true, amount = 0.12, childVariant, ...props }, ref) => {
    const prefersReduced = useReducedMotion();

    // 根据childVariant选择子项默认variants
    const childVariants = childVariant === 'flyIn' ? flyIn : fadeUp;

    return (
      <motion.div
        ref={ref}
        variants={staggerContainer(stagger, delay)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once, amount }}
        className={className}
        {...props}
      >
        {/* 为每个没有自带 variants 的直接子元素包裹 motion */}
        {prefersReduced ? (
          children
        ) : (
          <>
            {React.Children.map(children, (child, i) => {
              if (!React.isValidElement(child)) return child;
              // 每个子元素都用 motion.div 包裹以获得 flyIn/fadeUp 动画
              return (
                <motion.div key={i} variants={childVariants}>
                  {child}
                </motion.div>
              );
            })}
          </>
        )}
      </motion.div>
    );
  },
);
Stagger.displayName = 'Stagger';

// ── Hover-lift card wrapper ──
interface HoverLiftProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  lift?: number;
}

export const HoverLift = forwardRef<HTMLDivElement, HoverLiftProps>(
  ({ children, className, lift = -4, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={fadeUp}
      whileHover={{ y: lift, transition: { duration: 0.25, ease: 'easeOut' } }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
HoverLift.displayName = 'HoverLift';

// Re-export motion & new components for convenience
export { motion, springBounce };
