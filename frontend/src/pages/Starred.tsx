import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Play, Trash2, Check } from 'lucide-react';
import { getWordById } from '@/lib/words-data';
import { useStarred, useKnown } from '@/hooks/use-storage';
import { WordCard } from '@/components/WordCard';
import { Flashcard } from '@/components/Flashcard';
import { FlyIn, Stagger } from '@/components/MotionPrimitives';

type Tab = 'starred' | 'known';

export default function Starred() {
  const { starredIds, remove, clear, count } = useStarred();
  const { known, count: knownCount } = useKnown();
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'known' ? 'known' : 'starred';

  const starredWords = useMemo(
    () => starredIds.map((id) => getWordById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getWordById>>[],
    [starredIds]
  );
  const knownWords = useMemo(
    () => Array.from(known).map((id) => getWordById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getWordById>>[],
    [known]
  );
  const words = tab === 'starred' ? starredWords : knownWords;
  const switchTab = (t: Tab) => {
    setParams(t === 'starred' ? {} : { tab: 'known' });
    setFlashcardMode(false);
  };

  if (flashcardMode && words.length > 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <Flashcard
          words={words}
          title={tab === 'starred' ? '生词本复习' : '已掌握复习'}
          isStarred={() => true}
          onStar={(id) => remove(id)}
          onClose={() => setFlashcardMode(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <FlyIn>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 flex items-center gap-2 font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
              <Star className="h-6 w-6 text-warning" /> 生词本
            </h1>
            <p className="text-muted-foreground">
              已收藏 {count} 个 · 已掌握 {knownCount} 个
            </p>
          </div>
          {words.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setFlashcardMode(true)}
                className="liquid-glass-accent liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-4 py-2 text-sm text-primary transition-all hover:-translate-y-0.5 active:scale-95"
              >
                <Play className="h-4 w-4" /> 翻卡复习
              </button>
              {tab === 'starred' && count > 0 && (
                <button
                  onClick={() => { if (window.confirm('确认清空所有收藏？')) clear(); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 清空
                </button>
              )}
            </div>
          )}
        </div>

        {/* 标签切换 */}
        <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
          <button
            onClick={() => switchTab('starred')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
              tab === 'starred' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="h-3.5 w-3.5" /> 已收藏 ({count})
          </button>
          <button
            onClick={() => switchTab('known')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
              tab === 'known' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Check className="h-3.5 w-3.5" /> 已掌握 ({knownCount})
          </button>
        </div>
      </FlyIn>

      {words.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground/70">
          {tab === 'starred' ? '还没有收藏单词，在浏览单词时点击星标即可收藏～' : '还没有标记为已掌握的单词，去测验或翻卡时点「认识」即可标记～'}
        </p>
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2" stagger={0.05}>
          {words.map((w) => (
            <WordCard
              key={w.id}
              word={w}
              starred={tab === 'starred'}
              onToggleStar={() => remove(w.id)}
            />
          ))}
        </Stagger>
      )}
    </div>
  );
}
