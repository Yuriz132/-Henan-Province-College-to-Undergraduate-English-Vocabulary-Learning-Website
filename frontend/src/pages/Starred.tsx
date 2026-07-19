import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Play, Trash2, Check, FileText } from 'lucide-react';
import { getWordById } from '@/lib/words-data';
import { useStarred, useKnown, useSavedArticles } from '@/hooks/use-storage';
import { WordCard } from '@/components/WordCard';
import { Flashcard } from '@/components/Flashcard';
import { FlyIn, Stagger } from '@/components/MotionPrimitives';

type Tab = 'starred' | 'known' | 'articles';

function formatDate(ts: number): string {
  try {
    const d = new Date(ts)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch {
    return ''
  }
}

export default function Starred() {
  const { starredIds, remove, clear, count } = useStarred();
  const { known, count: knownCount } = useKnown();
  const { articles, remove: removeArticle, clear: clearArticles, count: articleCount } = useSavedArticles();
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab')
  const tab: Tab = raw === 'known' ? 'known' : raw === 'articles' ? 'articles' : 'starred';

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
    setParams(t === 'starred' ? {} : { tab: t });
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
              已收藏 {count} 个 · 已掌握 {knownCount} 个 · 文章 {articleCount} 篇
            </p>
          </div>
          {tab !== 'articles' && words.length > 0 && (
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
          {tab === 'articles' && articleCount > 0 && (
            <button
              onClick={() => { if (window.confirm('确认清空所有已生成文章？')) clearArticles(); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> 清空
            </button>
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
          <button
            onClick={() => switchTab('articles')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
              tab === 'articles' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> 我的文章 ({articleCount})
          </button>
        </div>
      </FlyIn>

      {tab === 'articles' ? (
        articleCount === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground/70">
            还没有生成的文章。去首页点「AI 文章生成」，用你已掌握的单词写一篇英语短文，会自动存到这里～
          </p>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => {
              const isOpen = expanded === a.id
              return (
                <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-foreground">{a.title || '无标题'}</h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {a.theme} · 目标 {a.target} 词 · 覆盖 {a.usedWords.length} 个单词 · {formatDate(a.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => { if (window.confirm('删除这篇文章？')) removeArticle(a.id) }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    {isOpen ? '收起' : '查看正文'}
                  </button>
                  {isOpen && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{a.content}</p>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : words.length === 0 ? (
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
