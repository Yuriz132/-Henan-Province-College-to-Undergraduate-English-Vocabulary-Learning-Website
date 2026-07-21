import { Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { updateDirectionOnRender } from "@/lib/navDirection";

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

/**
 * AnimatedRoutes - 页面切换动画容器（鸿蒙 Tab 错落切换的父调度层）
 *
 * 使用 mode="popLayout" 而非 "wait"：
 * - "wait" 会等待退出动画完成才开始进入动画（总延迟 ~0.6s）
 * - "popLayout" 允许新页面立即进入，旧页面同时退出（更流畅）
 *
 * 渲染阶段同步写入切换方向（前进=left / 后退=right），供各页面内 FlyIn/ExplodeIn
 * 在动画时刻实时读取，保证「退场旧页」与「进场新页」方向一致。
 *
 * ⚠️ 重要：Navbar/Header/Sidebar 必须放在 AnimatedRoutes 外部，
 * 否则每次页面切换都会重新创建并参与动画。
 */
export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
  const location = useLocation();

  // 在渲染阶段写入方向（幂等：pathname 未变则不覆盖），确保子块错落方向正确
  updateDirectionOnRender(location.pathname);

  return (
    <AnimatePresence mode="popLayout">
      <Routes location={location} key={location.pathname}>
        {children}
      </Routes>
    </AnimatePresence>
  );
}
