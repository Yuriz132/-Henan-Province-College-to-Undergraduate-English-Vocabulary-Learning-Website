import { motion, useReducedMotion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
  /** 预留兼容旧调用（harmony / fadethrough 等），当前统一走鸿蒙式错落切换 */
  transition?: string;
}

/**
 * PageTransition - 页面进入/退出动画包装器（鸿蒙 Tab 错落切换的 Web 移植）
 *
 * 架构（对应鸿蒙「父调度 + 子响应」）：
 *   - 本组件 = 父调度层：整页做方向无关的淡入淡出（覆盖退场/进场缝隙）。
 *   - 子块错落 = 由各页面里的 FlyIn / ExplodeIn 承担：
 *       入场：分块沿切换方向自上而下依次 spring 滑入（错落节奏由各自的 delay 决定）
 *       出场：分块沿切换方向同步 easeIn 滑出
 *     方向（left=前进/right=后退）由 AnimatedRoutes 在渲染阶段写入 navDirection。
 *
 * ⚠️ 此组件只包裹页面内容区域；
 * Navbar/Header/Sidebar 必须在 AnimatedRoutes 外部，不要包在 PageTransition 里。
 */
export function PageTransition({ children }: PageTransitionProps) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
      // 整页以顶部为缩放/淡入原点，消除切换时的整体上跳
      style={{ transformOrigin: "top center" }}
    >
      {children}
    </motion.div>
  );
}
