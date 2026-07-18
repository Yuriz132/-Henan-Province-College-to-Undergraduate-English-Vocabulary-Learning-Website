import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

// 透明 + 折射的「液体玻璃」效果
// 思路（移植自 Shu Ding 的 liquid-glass）：用 canvas 依据圆角矩形 SDF 生成一张
// 位移贴图，喂给 SVG <feDisplacementMap>，再让元素的 backdrop-filter 引用该 SVG
// 滤镜，从而对「元素背后的内容」做真实折射。折射集中在圆角处，呈透镜感。

function smoothStep(a: number, b: number, t: number) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function length(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

// 有符号距离场：返回点 (x,y) 到圆角矩形的距离（内部为负，外部为正）
function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number) {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

interface LiquidGlassProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 圆角半径(px)，控制折射透镜的位置与大小 */
  radius?: number;
  /** 背景模糊(px)，与折射叠加产生磨砂感 */
  blur?: number;
}

export function LiquidGlass({
  children,
  className = '',
  style,
  radius = 28,
  blur = 0.25,
}: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 不支持 backdrop-filter 时（如部分 Firefox）直接降级为纯 CSS 磨砂
    const supportsBackdrop =
      typeof (el.style as any).backdropFilter !== 'undefined' ||
      typeof (el.style as any).webkitBackdropFilter !== 'undefined';
    if (!supportsBackdrop) return;

    const id = 'lg-' + Math.random().toString(36).slice(2, 9);
    const svgns = 'http://www.w3.org/2000/svg';
    const xlink = 'http://www.w3.org/1999/xlink';

    // 1) 注入 SVG 滤镜（位移贴图）
    const svg = document.createElementNS(svgns, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:9998;';

    const defs = document.createElementNS(svgns, 'defs');
    const filter = document.createElementNS(svgns, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('colorInterpolationFilters', 'sRGB');

    const feImage = document.createElementNS(svgns, 'feImage');
    feImage.setAttribute('id', id + '_map');
    feImage.setAttribute('width', '10');
    feImage.setAttribute('height', '10');

    const feDisp = document.createElementNS(svgns, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', id + '_map');
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(feImage);
    filter.appendChild(feDisp);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    // 2) 隐藏 canvas：用来画位移贴图
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const applyBackdrop = (scale: number) => {
      const f = `url(#${id}) blur(${blur}px) contrast(1.2) brightness(1.05) saturate(1.1)`;
      (el.style as any).backdropFilter = f;
      (el.style as any).webkitBackdropFilter = f;
      void scale;
    };

    // 3) 依据元素尺寸生成位移贴图
    const update = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h || !ctx) return;
      canvas.width = w;
      canvas.height = h;
      feImage.setAttribute('width', String(w));
      feImage.setAttribute('height', String(h));
      filter.setAttribute('width', String(w));
      filter.setAttribute('height', String(h));

      const data = new Uint8ClampedArray(w * h * 4);
      let maxScale = 0;
      const raw: number[] = [];
      // 用高度归一化圆角，使透镜集中在圆角处
      const rNorm = Math.min(0.5, radius / h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ix = x / w - 0.5;
          const iy = y / h - 0.5;
          const d = roundedRectSDF(ix, iy, 0.5, 0.5, rNorm);
          const displacement = smoothStep(0.8, 0, d - 0.15);
          const scaled = smoothStep(0, 1, displacement);
          const tx = ix * scaled + 0.5;
          const ty = iy * scaled + 0.5;
          const dx = tx * w - x;
          const dy = ty * h - y;
          maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
          raw.push(dx, dy);
        }
      }
      maxScale *= 0.5;
      if (maxScale === 0) maxScale = 1;

      let idx = 0;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((raw[idx++] / maxScale) + 0.5) * 255;
        data[i + 1] = ((raw[idx++] / maxScale) + 0.5) * 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      ctx.putImageData(new ImageData(data, w, h), 0, 0);
      const url = canvas.toDataURL();
      feImage.setAttribute('href', url);
      feImage.setAttributeNS(xlink, 'href', url);
      feDisp.setAttribute('scale', String(maxScale));
      applyBackdrop(maxScale);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      svg.remove();
      canvas.remove();
    };
  }, [radius, blur]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
