import { useState, useMemo } from 'react';
import { Star, Play, Trash2 } from 'lucide-react';
import { getWordById } from '@/lib/words-data';
import { useStarred } from '@/hooks/use-storage';
import { WordCard } from '@/components/WordCard';
import { Flashcard } from '@/components/Flashcard';
import { FadeIn, FlyIn, Stagger } from '@/components/MotionPrimitives';

export default function Starred() {
  const { starredIds, remove, clear, count } = useStarred();
  const [flashcardMode, setFlashcardMode] = useState(false);

  const words = useMemo(
    () => starredIds.map((id) => getWordById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getWordById>>[],
    [starredIds]
  );

  if (flashcardMode && words.length > 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <Flashcard
          words={words}
          title="生词本复习"
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
            <p className="text-muted-foreground">{count} 个已收藏单词</p>
          </div>
          {count > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => setFlashcardMode(true)}
                className="liquid-glass-accent liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-4 py-2 text-sm text-primary transition-all hover:-translate-y-0.5 active:scale-95"
              >
                <Play className="h-4 w-4" /> 翻卡复习
              </button>
              <button
                onClick={clear}
                className="liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-destructive active:scale-95"
              >
                <Trash2 className="h-4 w-4" /> 清空
              </button>
            </div>
          )}
        </div>
      </FlyIn>

      {count === 0 ? (
        <FadeIn>
          <div className="liquid-glass p-12 text-center" style={{ borderRadius: 'var(--radius-lg)' }}>
            <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">还没有收藏的单词</p>
            <p className="mt-1 text-sm text-muted-foreground/70">在浏览或翻卡时点击星标即可收藏</p>
          </div>
        </FadeIn>
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06} childVariant="flyIn">
          {words.map((w) => (
            <WordCard key={w.id} word={w} starred onToggleStar={remove} />
          ))}
        </Stagger>
      )}
    </div>
  );
}
