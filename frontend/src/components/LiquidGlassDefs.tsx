import { useState } from 'react';

/**
 * 全局「液态玻璃」SVG 位移滤镜定义 —— 移植自 liquid-glass-react（https://github.com/shuding/liquid-glass）。
 *
 * 关键思路：
 *  - 用 canvas 依「内缩后的圆角矩形 SDF」生成位移贴图(R=x 位移, G=B=y 位移)，喂给 <feImage>。
 *  - <feDisplacementMap> 对背后内容(SourceGraphic = backdrop)做真实折射；
 *    红/绿/蓝三通道用略微不同的 scale 位移后 screen 混合，得到边缘的彩色色散(chromatic aberration)。
 *  - 折射集中在圆角/边缘处，呈透镜感；中心保持清晰。
 *  - 该滤镜只定义一次，所有 .liquid-glass 元素通过 `backdrop-filter: url(#liquidGlass)` 引用，
 *    即可获得统一且低开销的真实液态玻璃效果（Chrome / Chromium / 微信 X5 内核均支持）。
 *
 * 色散强度由 feDisplacementMap 的 scale 与 feComponentTransfer 的 tableValues 控制，可按观感微调。
 */

function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

// 有符号距离场：点 (x,y) 到圆角矩形的距离（内部为负，外部为正）
function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number): number {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

const SIZE = 256;
const MAP_ID = 'liquidGlassMap';

// 生成位移贴图（R=x 位移, G=B=y 位移），编码为 0.5 居中，便于 feDisplacementMap 直接按像素位移
function buildDisplacementURL(): string {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const margin = SIZE * 0.1;
  const halfW = SIZE / 2 - margin;
  const halfH = SIZE / 2 - margin;
  const stadium = Math.min(halfW, halfH); // 全圆角 stadium
  const rShape = stadium;
  const yBoost = 2.0; // 垂直(上下)折射增强，顶栏很扁时更有透镜感
  const data = ctx.createImageData(SIZE, SIZE);
  let idx = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x - SIZE / 2;
      const py = y - SIZE / 2;
      const d = roundedRectSDF(px, py, halfW, halfH, rShape);
      const dn = d / SIZE;
      // 折射带收紧到边缘：dn<0.05 才开始折射
      const displacement = smoothStep(0.7, 0, dn - 0.05);
      const scaled = smoothStep(0, 1, displacement);
      const lx = px * (scaled - 1);
      const ly = py * (scaled - 1) * yBoost;
      // 编码：C = lx/SIZE + 0.5 → feDisplacementMap scale=S 时位移 = S*(C-0.5) = S*lx/SIZE
      data.data[idx++] = Math.max(0, Math.min(255, (lx / SIZE + 0.5) * 255));
      data.data[idx++] = Math.max(0, Math.min(255, (ly / SIZE + 0.5) * 255));
      data.data[idx++] = Math.max(0, Math.min(255, (ly / SIZE + 0.5) * 255));
      data.data[idx++] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL();
}

export function LiquidGlassDefs() {
  // 在首次渲染时生成贴图，避免滤镜在 href 就绪前把背景渲染成透明/黑
  const [mapUrl] = useState(buildDisplacementURL);

  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: -1 }}
    >
      <defs>
        <filter id="liquidGlass" x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
          <feImage
            id={MAP_ID}
            x="0"
            y="0"
            width="100%"
            height="100%"
            result="DISPLACEMENT_MAP"
            href={mapUrl}
            preserveAspectRatio="xMidYMid slice"
          />

          {/* 由位移贴图自身生成边缘遮罩（仅边缘有色散） */}
          <feColorMatrix
            in="DISPLACEMENT_MAP"
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0 0 0 1 0"
            result="EDGE_INTENSITY"
          />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues="0 0.1 1" />
          </feComponentTransfer>

          {/* 中心原始（未位移）内容 */}
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

          {/* 红通道位移 */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale="-110"
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />

          {/* 绿通道位移（略弱） */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale="-99"
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />

          {/* 蓝通道位移（更弱） */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale="-88"
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />

          {/* 三通道 screen 混合 → 色散 */}
          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />

          {/* 轻微模糊柔化色散 */}
          <feGaussianBlur in="RGB_COMBINED" stdDeviation="0.3" result="ABERRATED_BLURRED" />

          {/* 仅在边缘应用色散 */}
          <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />

          {/* 中心保持清晰 */}
          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />

          {/* 边缘色散叠加在清晰中心之上 */}
          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
