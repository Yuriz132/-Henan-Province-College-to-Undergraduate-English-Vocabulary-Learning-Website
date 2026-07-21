import { useState, useCallback, useEffect, useRef, lazy, Suspense, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Star, Check, RotateCcw, Shuffle, Languages, Volume2, Maximize2, Minimize2, Sparkles, Loader2, X, Meh, Undo2 } from 'lucide-react';
import type { Word } from '@/types/word';
import { cn } from '@/lib/utils';
import { speakWord } from '@/lib/speak';
import { aiExplainWord, type WordAIDetail, type ExampleSentence } from '@/lib/ai';
import type { ReviewGrade } from '@/lib/reviews';
import DailyWallpaper from '@/components/DailyWallpaper';
import { useExamples } from '@/hooks/use-examples';

// 评论区按需加载，避免 CloudBase SDK 拖慢首屏
const WordComments = lazy(() =>
  import('@/components/WordComments').then((m) => ({ default: m.WordComments }))
);

/** 在例句中高亮目标单词（忽略大小写，整词匹配） */
function highlightWord(sentence: string, word?: string): ReactNode {
  if (!word) return sentence;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
  const parts = sentence.split(re);
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === word.toLowerCase()
          ? <span key={i} className="bbdc-hl">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

interface FlashcardProps {
  words: Word[];
  onStar?: (id: number) => void;
  onKnown?: (id: number, reviewedCount: number) => void;
  onReview?: (id: number, grade: ReviewGrade) => void;
  isStarred?: (id: number) => boolean;
  onClose?: () => void;
  title?: string;
}

type CardMode = 'en2cn' | 'cn2en';

/** 翻卡学习组件 — 全屏液态玻璃翻卡，支持英→中 / 中→英双向 */
export function Flashcard({ words, onStar, onKnown, onReview, isStarred, onClose, title }: FlashcardProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<CardMode>('en2cn');
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => words.map((_, i) => i));
  const [immersive, setImmersive] = useState(false);
  const [cardExit, setCardExit] = useState(false); // 卡片切换动画
  const [slideDir, setSlideDir] = useState<'up' | 'down' | 'left' | 'right'>('left');
  const [cardEnter, setCardEnter] = useState(false); // 新卡片入场动画
  const [wordKey, setWordKey] = useState(0); // 单词切换 key（触发文字动画）
  // AI 单词解析
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDetail, setAiDetail] = useState<WordAIDetail | null>(null);
  const [aiError, setAiError] = useState('');
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

  // 例句（不背单词：AI 生成地道例句，缓存到 localStorage）
  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  const { getExamples, regenerate, loading: exLoading, error: exError } = useExamples();

  const loadExamples = useCallback(async () => {
    if (!current) return;
    const list = await getExamples(current);
    setExamples(list);
  }, [current, getExamples]);

  const regen = useCallback(async () => {
    if (!current) return;
    const list = await regenerate(current);
    setExamples(list);
  }, [current, regenerate]);

  useEffect(() => {
    setExamples([]);
    void loadExamples();
    // 仅在单词切换时重新加载例句
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const renderExamples = (): ReactNode => {
    if (exLoading && examples.length === 0) {
      return (
        <div className="bbdc-examples">
          <div className="bbdc-loading flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" /> AI 正在生成例句…
          </div>
        </div>
      );
    }
    if (exError && examples.length === 0) {
      return (
        <div className="bbdc-examples">
          <div className="bbdc-error text-sm text-white/60">{exError}</div>
        </div>
      );
    }
    if (examples.length === 0) return null;
    return (
      <div className="bbdc-examples">
        {examples.map((s, i) => (
          <div key={i} className="bbdc-sentence">
            <p className="bbdc-en">
              {highlightWord(s.en, current?.word)}
              <button
                type="button"
                className="bbdc-speak-sm"
                onClick={(e) => { e.stopPropagation(); speakWord(s.en); }}
                aria-label="播放例句"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </p>
            <p className="bbdc-zh">{s.zh}</p>
          </div>
        ))}
        <button
          type="button"
          className="bbdc-regen"
          onClick={(e) => { e.stopPropagation(); void regen(); }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> 换一批例句
        </button>
      </div>
    );
  };

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
    const dir = immersive ? 'up' : 'left';
    setSlideDir(dir);
    setCardExit(true);
    setTimeout(() => {
      setFlipped(false);
      setIndex((i) => (i + 1) % words.length);
      setWordKey((k) => k + 1);
      setCardExit(false);
      setCardEnter(true);
      setTimeout(() => setCardEnter(false), 200);
    }, 200);
  }, [words.length, immersive]);

  const prev = useCallback(() => {
    const dir = immersive ? 'down' : 'right';
    setSlideDir(dir);
    setCardExit(true);
    setTimeout(() => {
      setFlipped(false);
      setIndex((i) => (i - 1 + words.length) % words.length);
      setCardExit(false);
      setCardEnter(true);
      setTimeout(() => setCardEnter(false), 200);
    }, 200);
  }, [words.length, immersive]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
    try { navigator?.vibrate?.([20, 40, 20]); } catch {} // 震动两下
  }, []);

  const speak = useCallback(() => {
    if (current) speakWord(current.word);
  }, [current]);

  // 间隔复习三级评级：认识/模糊/忘记。认识同时标记「已掌握」。
  const handleReview = useCallback(
    (grade: ReviewGrade) => {
      if (!current) return;
      onReview?.(current.id, grade);
      if (grade === 'good') onKnown?.(current.id, index + 1);
      next();
    },
    [current, onReview, onKnown, index, next]
  );

  // 进入 / 退出沉浸模式
  // 沉浸模式与翻卡学习共用同一个「当前单词」位置：
  //  - 进入时不重置进度，从当前单词开始；
  //  - 退出后停留在沉浸模式最后停留的单词（例如 head），再次进入也从该单词继续。
  const enterImmersive = useCallback(() => {
    setFlipped(false);
    setImmersive(true);
    document.body.setAttribute('data-immersive', 'true');
  }, []);

  const exitImmersive = useCallback(() => {
    setImmersive(false);
    document.body.removeAttribute('data-immersive');
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

  const AiDetailView = () => {
    if (!aiDetail && !aiLoading) return null;
    return (
      <div
        className="relative z-[2] mt-4 w-full max-w-2xl"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="liquid-glass max-h-48 overflow-y-auto rounded-xl border border-white/10 p-4 text-sm">
          {aiLoading ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> AI 正在解析…
            </div>
          ) : aiDetail ? (
            <div className="space-y-3">
              {aiDetail.cnMeaning && (
                <div>
                  <div className="text-xs font-medium text-primary">中文释义</div>
                  <p className="mt-0.5 text-base font-semibold text-foreground">{aiDetail.cnMeaning}</p>
                </div>
              )}
              {aiDetail.enDef && (
                <div>
                  <div className="text-xs font-medium text-primary">英文</div>
                  <p className="mt-0.5 text-sm italic text-foreground/80">{aiDetail.enDef}</p>
                </div>
              )}
              {aiDetail.example && (
                <div>
                  <div className="text-xs font-medium text-primary">例句</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{aiDetail.example}</p>
                </div>
              )}
              {aiDetail.similarWords?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-primary">形近词（河南专升本常考）</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {aiDetail.similarWords.map((s, i) => (
                      <span key={i} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        {s.word}<span className="ml-1 text-foreground/60">{s.cn}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {aiDetail.phrases?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-primary">常用短语</div>
                  <div className="mt-1 space-y-0.5">
                    {aiDetail.phrases.map((p, i) => (
                      <div key={i} className="text-xs text-foreground/80">
                        <span className="text-foreground">{p.en}</span>
                        <span className="ml-1.5 text-muted-foreground">/ {p.cn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {aiDetail.tenses?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-primary">时态变形</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {aiDetail.tenses.map((t, i) => (
                      <span key={i} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-xs text-accent">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setAiDetail(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> 收起
              </button>
            </div>
          ) : (
            <p className="text-xs text-destructive">{aiError || '解析失败'}</p>
          )}
        </div>
      </div>
    );
  };

  if (!current) return null;

  const starred = isStarred?.(current.id);

  // 根据模式决定正反面内容
  const frontIsEn = mode === 'en2cn';
  const frontLabel = frontIsEn ? 'Word' : '释义';
  const backLabel = frontIsEn ? '释义' : 'Word';

  // 正面：固定为「单词面」（大字号单词 + 音标 + 发音 + 提示）
  const frontContent = (
    <>
      <div className="bbdc-label">{frontLabel}</div>
      <h2 className="bbdc-word" style={{ fontSize: 'var(--font-size-display)' }}>
        {current.word}
      </h2>
      <div className="bbdc-phon-row">
        {current.phonetic && <span className="bbdc-phon">{current.phonetic}</span>}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); speak(); }}
          className="bbdc-speaker"
          aria-label="发音"
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>
      <p className="bbdc-hint">点击查看释义与例句</p>
    </>
  );

  // 反面：固定为「释义 + 例句面」
  const backContent = (
    <>
      <div className="bbdc-label">{backLabel}</div>
      <h2 className="bbdc-word" style={{ fontSize: 'var(--font-size-display)' }}>{current.word}</h2>
      {current.phonetic && <p className="bbdc-phon bbdc-phon-center">{current.phonetic}</p>}
      <p className="bbdc-meaning">{current.meaning}</p>
      {renderExamples()}
    </>
  );

  // 沉浸模式：极简界面，仅保留单词、音标、发音与「缩小」退出按钮。
  // 用 fixed 铺满整屏并禁用页面滚动，确保正好一屏，上下滑动切换单词更顺滑。
  if (immersive) {
    return (
      <div
        className="bbdc-immersive fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 py-10"
        style={{ touchAction: 'none' }} /* 禁止页面滚动，纵向滑动完全用于切换单词 */
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <DailyWallpaper />
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

        {/* 单词 + 音标 + 释义 — 切换时文字动画 */}
        <div key={wordKey} className="word-animate flex flex-col items-center px-2 w-full max-w-full">
          <h2
            className="relative z-[2] max-w-full text-center font-bold text-foreground text-gradient whitespace-nowrap"
            style={{ fontSize: `calc(var(--font-size-display) * ${current.word.length > 12 ? 0.65 : current.word.length > 9 ? 0.88 : current.word.length > 6 ? 1.0 : 1.3})`, lineHeight: 1.1 }}
          >
            {current.word}
          </h2>

          {current.phonetic && (
            <div className="relative z-[2] mt-4 flex items-center gap-2">
              <p className="text-center font-mono text-xl text-muted-foreground">
                {current.phonetic}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); speak(); }}
                className="liquid-glass liquid-glass-shine inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-primary active:scale-90"
                aria-label="发音"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <p className="relative z-[2] mt-3 text-center text-lg text-muted-foreground font-medium">
            {current.meaning}
          </p>
          {renderExamples()}
        </div>

        {/* 认识 / 模糊 / 忘记 / 收藏 / AI 按钮 */}
        <div className="relative z-[2] mt-6 flex items-center gap-3">
          {onReview && (
            <>
              <button
                onClick={() => handleReview('good')}
                className="liquid-glass liquid-glass-shine flex h-11 items-center gap-1.5 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-success active:scale-95"
                title="认识：已掌握，按遗忘曲线安排下次复习"
              >
                <Check className="h-4 w-4 text-success" />
                <span className="text-sm text-success">认识</span>
              </button>
              <button
                onClick={() => handleReview('vague')}
                className="liquid-glass liquid-glass-shine flex h-11 items-center gap-1.5 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-warning active:scale-95"
                title="模糊：有点印象，明天再复习"
              >
                <Meh className="h-4 w-4 text-warning" />
                <span className="text-sm text-warning">模糊</span>
              </button>
              <button
                onClick={() => handleReview('forget')}
                className="liquid-glass liquid-glass-shine flex h-11 items-center gap-1.5 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-destructive active:scale-95"
                title="忘记：立即重学"
              >
                <Undo2 className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">忘记</span>
              </button>
            </>
          )}
          {onStar && (
            <button
              onClick={() => onStar(current.id)}
              className={cn('liquid-glass liquid-glass-shine flex h-11 items-center gap-1.5 rounded-full px-5 transition-all hover:-translate-y-0.5 active:scale-95', starred && 'liquid-glass-accent')}
            >
              <Star className={cn('h-4 w-4 transition-transform', starred ? 'fill-warning text-warning scale-110' : 'text-muted-foreground')} />
              <span className={cn('text-sm', starred ? 'text-warning' : 'text-muted-foreground')}>{starred ? '已收藏' : '收藏'}</span>
            </button>
          )}
          <button
            onClick={async () => {
              if (aiLoading) return;
              setAiLoading(true); setAiError(''); setAiDetail(null);
              try {
                const detail = await aiExplainWord(current.word, current.meaning);
                setAiDetail(detail);
              } catch { setAiError('AI 解析失败'); }
              finally { setAiLoading(false); }
            }}
            className="liquid-glass liquid-glass-shine flex h-11 items-center gap-1.5 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-primary active:scale-95"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="text-sm text-muted-foreground">AI</span>
          </button>
        </div>

        <AiDetailView />

        {/* 操作提示 */}
        <p className="mt-12 text-center text-xs text-muted-foreground/50">
          上滑 → 下一个　·　下滑 → 上一个
        </p>
      </div>
    );
  }

  return (
    <div className="bbdc-study relative flex min-h-[calc(100vh-100px)] flex-col items-center justify-center px-4 py-6">
      <DailyWallpaper />
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
          <button
            onClick={async () => {
              if (aiLoading) return;
              setAiLoading(true); setAiError(''); setAiDetail(null);
              try {
                const detail = await aiExplainWord(current.word, current.meaning);
                setAiDetail(detail);
              } catch { setAiError('AI 解析失败'); }
              finally { setAiLoading(false); }
            }}
            className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
            title="AI 解析单词（简单英文释义、形近词、短语、时态）"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">AI 解析</span>
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
        className={cn('flip-card aspect-[3/2] w-full max-w-2xl', flipped && 'flipped', jellying && 'card-jelly', cardExit && `flashcard-exit-${slideDir}`, cardEnter && `flashcard-enter-${slideDir}`)}
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
          <div className="flip-card-face bbdc-face flex flex-col p-8" style={{ borderRadius: 'calc(var(--radius) + 12px)' }}>
            <div className="flex w-full flex-1 flex-col items-center justify-center text-center">{frontContent}</div>
            <p className="pt-4 text-center text-xs text-muted-foreground/60">点击翻面 (空格)</p>
          </div>
          {/* 背面 */}
          <div className="flip-card-face flip-card-back bbdc-face flex flex-col p-8"
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

        {onReview && (
          <>
            <button
              onClick={() => handleReview('good')}
              className="liquid-glass liquid-glass-shine flex h-12 items-center gap-2 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-success active:scale-95"
              title="认识：已掌握，按遗忘曲线安排下次复习"
            >
              <Check className="h-5 w-5 text-success" />
              <span className="text-sm text-success">认识</span>
            </button>
            <button
              onClick={() => handleReview('vague')}
              className="liquid-glass liquid-glass-shine flex h-12 items-center gap-2 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-warning active:scale-95"
              title="模糊：有点印象，明天再复习"
            >
              <Meh className="h-5 w-5 text-warning" />
              <span className="text-sm text-warning">模糊</span>
            </button>
            <button
              onClick={() => handleReview('forget')}
              className="liquid-glass liquid-glass-shine flex h-12 items-center gap-2 rounded-full px-5 transition-all hover:-translate-y-0.5 hover:text-destructive active:scale-95"
              title="忘记：立即重学"
            >
              <Undo2 className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive">忘记</span>
            </button>
          </>
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

      {/* AI 单词解析结果 */}
      <AiDetailView />

      {/* 评论区：翻到当前单词时可记录短语 / 近义词，所有访客共享可见 */}
      <Suspense fallback={null}>
        <WordComments wordId={current.id} wordText={current.word} />
      </Suspense>
    </div>
  );
}
