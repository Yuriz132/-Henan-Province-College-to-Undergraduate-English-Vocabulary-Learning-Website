import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Star, Check, RotateCcw, Shuffle, Languages, Volume2, Maximize2, Minimize2 } from 'lucide-react';
import type { Word } from '@/types/word';
import { cn } from '@/lib/utils';
import { speakWord } from '@/lib/speak';

// 评论区按需加载，避免 CloudBase SDK 拖慢首屏
const WordComments = lazy(() =>
  import('@/components/WordComments').then((m) => ({ default: m.WordComments }))
);

interface FlashcardProps {
  words: Word[];
  onStar?: (id: number) => void;
  onKnown?: (id: number, reviewedCount: number) => void;
  isStarred?: (id: number) => boolean;
  onClose?: () => void;
  title?: string;
}

type CardMode = 'en2cn' | 'cn2en';

/** 翻卡学习组件 — 全屏液态玻璃翻卡，支持英→中 / 中→英双向 */
export function Flashcard({ words, onStar, onKnown, isStarred, onClose, title }: FlashcardProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<CardMode>('en2cn');
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => words.map((_, i) => i));
  const [immersive, setImmersive] = useState(false);
  const touchStartY = useRef(0);
  // 果冻回弹交互状态
  const [pressed, setPressed] = useState(false);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [jellying, setJellying] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 当 words 变化时重置顺序
  useEffect(() => {
    setOrder(words.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [words]);

  const current = words[order[index]];

  // 打乱顺序
  const toggleShuffle = useCallback(() => {
    setShuffled((prev) => {
      const next = !prev;
      if (next) {
        const arr = words.map((_, i) => i);
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        setOrder(arr);
      } else {
        setOrder(words.map((_, i) => i));
      }
      setIndex(0);
      setFlipped(false);
      return next;
    });
  }, [words]);

  const next = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i + 1) % words.length);
  }, [words.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i - 1 + words.length) % words.length);
  }, [words.length]);

  const toggleFlip = useCallback(() => setFlipped((f) => !f), []);

  const speak = useCallback(() => {
    if (current) speakWord(current.word);
  }, [current]);

  // 进入 / 退出沉浸模式
  // 沉浸模式与翻卡学习共用同一个「当前单词」位置：
  //  - 进入时不重置进度，从当前单词开始；
  //  - 退出后停留在沉浸模式最后停留的单词（例如 head），再次进入也从该单词继续。
  const enterImmersive = useCallback(() => {
    setFlipped(false);
    setImmersive(true);
  }, []);

  const exitImmersive = useCallback(() => {
    setImmersive(false);
    // 退出后回到页面顶部，确保翻卡卡片（当前单词）进入视野
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 手机上下滑动切换单词：上滑→下一个，下滑→上一个
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > 50) {
      if (dy < 0) next();
      else prev();
    }
  };

  // 沉浸模式下，进入与每次切换单词时自动朗读
  useEffect(() => {
    if (immersive && current) speakWord(current.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, immersive]);

  // 果冻回弹：手指按住卡片时轻微挤压并跟随倾斜，松手后 Q 弹回弹
  const updateTilt = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    setTilt({ x: -dy * 8, y: dx * 8 });
  };
  const onCardPointerDown = (e: React.PointerEvent) => {
    setPressed(true);
    updateTilt(e);
  };
  const onCardPointerMove = (e: React.PointerEvent) => {
    if (pressed) updateTilt(e);
  };
  const onCardPointerUp = () => {
    if (!pressed) return;
    setPressed(false);
    setTilt({ x: 0, y: 0 });
    setJellying(true);
  };

  // 切换模式时翻回正面
  const toggleMode = useCallback(() => {
    setFlipped(false);
    setTimeout(() => {
      setMode((m) => (m === 'en2cn' ? 'cn2en' : 'en2cn'));
    }, 200);
  }, []);

  // 键盘控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (immersive) {
        // 沉浸模式下用 ↑/↓ 切换单词；退出仅允许点击「缩小」按钮
        if (e.key === 'ArrowUp') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); prev(); }
        return;
      }
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggleFlip, onClose, immersive, exitImmersive]);

  if (!current) return null;

  const starred = isStarred?.(current.id);

  // 根据模式决定正反面内容
  const frontIsEn = mode === 'en2cn';
  const frontLabel = frontIsEn ? 'Word' : '释义';
  const backLabel = frontIsEn ? '释义' : 'Word';

  const frontContent = frontIsEn ? (
    <>
      <div className="relative z-[2] mb-3 text-xs uppercase tracking-widest text-muted-foreground">{frontLabel}</div>
      <h2 className="relative z-[2] text-center font-bold text-foreground text-gradient"
        style={{ fontSize: 'var(--font-size-display)' }}
      >
        {current.word}
      </h2>
      {current.phonetic && (
        <p className="relative z-[2] mt-3 text-center font-mono text-lg text-muted-foreground">{current.phonetic}</p>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); speak(); }}
        className="liquid-glass liquid-glass-shine relative z-[2] mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
      >
        <Volume2 className="h-4 w-4" /> 发音
      </button>
    </>
  ) : (
    <>
      <div className="relative z-[2] mb-3 text-xs uppercase tracking-widest text-muted-foreground">{frontLabel}</div>
      <p className="relative z-[2] max-w-xl text-center text-xl leading-relaxed text-foreground" style={{ opacity: 0.95 }}>
        {current.meaning}
      </p>
    </>
  );

  const backContent = frontIsEn ? (
    <>
      <div className="relative z-[2] mb-3 text-xs uppercase tracking-widest text-muted-foreground">{backLabel}</div>
      <h3 className="relative z-[2] mb-2 text-center text-2xl font-bold text-foreground">{current.word}</h3>
      {current.phonetic && (
        <p className="relative z-[2] mb-3 text-center font-mono text-base text-muted-foreground">{current.phonetic}</p>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); speak(); }}
        className="liquid-glass liquid-glass-shine relative z-[2] mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
      >
        <Volume2 className="h-4 w-4" /> 发音
      </button>
      <p className="relative z-[2] mt-4 max-w-xl text-center text-lg leading-relaxed text-foreground" style={{ opacity: 0.9 }}>
        {current.meaning}
      </p>
    </>
  ) : (
    <>
      <div className="relative z-[2] mb-3 text-xs uppercase tracking-widest text-muted-foreground">{backLabel}</div>
      <h2 className="relative z-[2] text-center font-bold text-foreground text-gradient"
        style={{ fontSize: 'var(--font-size-display)' }}
      >
        {current.word}
      </h2>
      {current.phonetic && (
        <p className="relative z-[2] mt-3 text-center font-mono text-lg text-muted-foreground">{current.phonetic}</p>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); speak(); }}
        className="liquid-glass liquid-glass-shine relative z-[2] mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
      >
        <Volume2 className="h-4 w-4" /> 发音
      </button>
    </>
  );

  // 沉浸模式：极简界面，仅保留单词、音标、发音与「缩小」退出按钮。
  // 用 fixed 铺满整屏并禁用页面滚动，确保正好一屏，上下滑动切换单词更顺滑。
  if (immersive) {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[oklch(0.15_0.03_270/0.45)] px-6 py-10 backdrop-blur-xl"
        style={{ touchAction: 'none' }} /* 禁止页面滚动，纵向滑动完全用于切换单词 */
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* 唯一的退出方式：固定在屏幕右上角的小号缩小按钮 */}
        <button
          onClick={exitImmersive}
          title="退出沉浸模式"
          aria-label="退出沉浸模式"
          className="fixed right-4 top-16 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-muted-foreground shadow-lg backdrop-blur-xl transition-all hover:text-primary active:scale-90"
          style={{ position: 'fixed' }}
        >
          <Minimize2 className="h-4 w-4" />
        </button>

        {/* 提示文字 */}
        <div className="mb-5 text-xs uppercase tracking-[0.3em] text-muted-foreground/60">
          沉浸模式 · 上下滑动切换
        </div>

        {/* 单词 */}
        <h2
          className="relative z-[2] text-center font-bold text-foreground text-gradient"
          style={{ fontSize: 'calc(var(--font-size-display) * 1.3)', lineHeight: 1.1 }}
        >
          {current.word}
        </h2>

        {/* 音标 */}
        {current.phonetic && (
          <p className="relative z-[2] mt-4 text-center font-mono text-xl text-muted-foreground">
            {current.phonetic}
          </p>
        )}

        {/* 发音按钮 */}
        <button
          onClick={() => speak()}
          className="liquid-glass liquid-glass-shine relative z-[2] mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base text-muted-foreground transition-all hover:text-primary active:scale-95"
        >
          <Volume2 className="h-5 w-5" /> 发音
        </button>

        {/* 操作提示 */}
        <p className="mt-12 text-center text-xs text-muted-foreground/50">
          上滑 → 下一个　·　下滑 → 上一个
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center px-4 py-6">
      {/* 顶部信息 + 模式切换 */}
      <div className="mb-4 flex w-full max-w-2xl items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {title && <span className="mr-2">{title}</span>}
          <span className="font-mono">{index + 1} / {words.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 模式切换按钮 */}
          <button
            onClick={toggleMode}
            className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
            title={frontIsEn ? '当前：英→中，点击切换' : '当前：中→英，点击切换'}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{frontIsEn ? '英→中' : '中→英'}</span>
          </button>
          {/* 打乱按钮 */}
          <button
            onClick={toggleShuffle}
            className={cn(
              'liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all active:scale-95',
              shuffled ? 'liquid-glass-accent text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            title="打乱顺序"
          >
            <Shuffle className="h-4 w-4" />
            <span className="hidden sm:inline">乱序</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="liquid-glass rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all hover:text-foreground active:scale-95"
            >
              退出
            </button>
          )}
          <button
            onClick={enterImmersive}
            className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
            title="进入沉浸模式（上下滑动切换单词）"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">沉浸</span>
          </button>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-6 h-1 w-full max-w-2xl overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${((index + 1) / words.length) * 100}%`,
            transitionDuration: 'var(--duration-normal)',
          }}
        />
      </div>

      {/* 翻卡 */}
      <div
        ref={cardRef}
        className={cn('flip-card aspect-[3/2] w-full max-w-2xl', flipped && 'flipped', jellying && 'card-jelly')}
        style={{
          transform: pressed
            ? `perspective(800px) scale(0.95) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
            : undefined,
          transition: pressed ? 'transform 120ms ease-out' : undefined,
          touchAction: 'pan-y',
        }}
        onClick={toggleFlip}
        onPointerDown={onCardPointerDown}
        onPointerMove={onCardPointerMove}
        onPointerUp={onCardPointerUp}
        onPointerLeave={onCardPointerUp}
        onPointerCancel={onCardPointerUp}
        onAnimationEnd={() => setJellying(false)}
      >
        <div className="flip-card-inner">
          {/* 正面 */}
          <div className="flip-card-face liquid-glass flex flex-col p-8" style={{ borderRadius: 'calc(var(--radius) + 12px)' }}>
            <div className="flex w-full flex-1 flex-col items-center justify-center text-center">{frontContent}</div>
            <p className="pt-4 text-center text-xs text-muted-foreground/60">点击翻面 (空格)</p>
          </div>
          {/* 背面 */}
          <div className="flip-card-face flip-card-back liquid-glass-accent liquid-glass flex flex-col p-8"
            style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
          >
            <div className="flex w-full flex-1 flex-col items-center justify-center text-center">{backContent}</div>
            <p className="pt-4 text-center text-xs text-muted-foreground/60">点击翻回</p>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={prev}
          className="liquid-glass liquid-glass-shine flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-90"
          aria-label="上一个"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {onStar && (
          <button
            onClick={() => onStar(current.id)}
            className={cn(
              'liquid-glass liquid-glass-shine flex h-12 items-center gap-2 rounded-full px-5 transition-all hover:-translate-y-0.5 active:scale-95',
              starred && 'liquid-glass-accent'
            )}
          >
            <Star className={cn('h-5 w-5 transition-transform', starred ? 'fill-warning text-warning scale-110' : 'text-muted-foreground')} />
            <span className={cn('text-sm transition-colors', starred ? 'text-warning' : 'text-muted-foreground')}>{starred ? '已收藏' : '收藏'}</span>
          </button>
        )}

        {onKnown && (
          <button
            onClick={() => { onKnown?.(current.id, index + 1); next(); }}
            className="liquid-glass liquid-glass-shine flex h-12 items-center gap-2 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-success active:scale-95"
          >
            <Check className="h-5 w-5 text-success" />
            <span className="text-sm text-muted-foreground">认识</span>
          </button>
        )}

        <button
          onClick={() => { setFlipped(false); }}
          className="liquid-glass liquid-glass-shine flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-90"
          aria-label="重置"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          onClick={next}
          className="liquid-glass liquid-glass-shine flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-90"
          aria-label="下一个"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 评论区：翻到当前单词时可记录短语 / 近义词，所有访客共享可见 */}
      <Suspense fallback={null}>
        <WordComments wordId={current.id} wordText={current.word} />
      </Suspense>
    </div>
  );
}
