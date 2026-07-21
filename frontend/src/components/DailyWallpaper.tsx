import { useEffect, useState } from 'react';

/**
 * 每日壁纸：深色柔和渐变背景，纯 CSS、无外部图片依赖。
 * 8 套配色按「天数」轮换，每天稳定一致。
 */
const PALETTES: [string, string, string][] = [
  ['#1a1a2e', '#16213e', '#0f3460'],
  ['#2b1055', '#3a1c71', '#1f1147'],
  ['#0b486b', '#10545b', '#08374a'],
  ['#3a1c1c', '#5a2a2a', '#2a1414'],
  ['#1f2a44', '#2c3e50', '#16222a'],
  ['#2d1b4e', '#44318d', '#1b1035'],
  ['#0f2027', '#203a43', '#2c5364'],
  ['#4b1248', '#6a1b4d', '#2d0a2e'],
];

export function DailyWallpaper() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // 以「天」为单位轮换，保证当天内稳定
    const day = Math.floor(Date.now() / 86_400_000);
    setIdx(((day % PALETTES.length) + PALETTES.length) % PALETTES.length);
  }, []);

  const [a, b, c] = PALETTES[idx];

  return (
    <div
      className="daily-wallpaper"
      aria-hidden="true"
      style={{ background: `linear-gradient(135deg, ${a} 0%, ${b} 52%, ${c} 100%)` }}
    >
      <div className="daily-wallpaper-dots" />
    </div>
  );
}

export default DailyWallpaper;
