/**
 * navDirection — 路由切换方向判断（对应鸿蒙 Tabs.onAnimationStart 的 newIdx/oldIdx 对比）
 *
 * 思路：以「路由一级路径的顺序」模拟 Tab 索引。导航时由父组件(AnimatedRoutes)在渲染阶段
 * 调用 updateDirectionOnRender(pathname) 写入方向；子项(StaggerItem)在动画时刻通过
 * getNavDirection() 实时读取，保证「进入的新页」与「退场的旧页」使用同一个切换方向。
 *
 *   dir = 'left'  → 前进（目标索引 > 当前）：旧页向左滑出，新页从右侧滑入
 *   dir = 'right' → 后退（目标索引 < 当前）：旧页向右滑出，新页从左侧滑入
 */

export type NavDir = 'left' | 'right';

/** 一级路由的「顺序」，用于判断前进/后退。越靠后越「深」。 */
const ROUTE_ORDER = [
  '/',
  '/browse',
  '/flashcards',
  '/review',
  '/custom',
  '/quiz',
  '/search',
  '/starred',
  '/login',
  '/account',
];

function baseOf(path: string): string {
  const seg = path.split('/').filter(Boolean)[0];
  return seg ? '/' + seg : '/';
}

let _last = '/';
let _dir: NavDir = 'left';

/** 读取当前切换方向（动画时刻调用，保证新旧页一致） */
export function getNavDirection(): NavDir {
  return _dir;
}

/**
 * 在父组件渲染阶段调用：仅当 pathname 真正变化时重算方向。
 * 幂等（重复 render 不会覆盖），strict-mode 双调用也安全。
 */
export function updateDirectionOnRender(pathname: string): void {
  if (pathname === _last) return;
  const prev = baseOf(_last);
  const next = baseOf(pathname);
  const pi = ROUTE_ORDER.indexOf(prev);
  const ni = ROUTE_ORDER.indexOf(next);
  if (pi !== -1 && ni !== -1) {
    _dir = ni > pi ? 'left' : ni < pi ? 'right' : 'left';
  } else {
    _dir = 'left'; // 未知路径默认前进
  }
  _last = pathname;
}
