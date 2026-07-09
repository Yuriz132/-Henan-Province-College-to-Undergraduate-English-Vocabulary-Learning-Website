import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, Check, RotateCcw, Shuffle, Languages } from 'lucide-react';
import type { Word } from '@/types/word';
import { cn } from '@/lib/utils';

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
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggleFlip, onClose]);

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
      <p className="relative z-[2] max-w-xl text-center text-lg leading-relaxed text-foreground" style={{ opacity: 0.9 }}>
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
    </>
  );

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
        className={cn('flip-card aspect-[3/2] w-full max-w-2xl', flipped && 'flipped')}
        onClick={toggleFlip}
      >
        <div className="flip-card-inner">
          {/* 正面 */}
          <div className="flip-card-face liquid-glass p-8" style={{ borderRadius: 'calc(var(--radius) + 12px)' }}>
            {frontContent}
            <p className="absolute bottom-4 z-[2] text-xs text-muted-foreground/60">点击翻面 (空格)</p>
          </div>
          {/* 背面 */}
          <div className="flip-card-face flip-card-back liquid-glass-accent liquid-glass p-8"
            style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
          >
            {backContent}
            <p className="absolute bottom-4 z-[2] text-xs text-muted-foreground/60">点击翻回</p>
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
    </div>
  );
}
