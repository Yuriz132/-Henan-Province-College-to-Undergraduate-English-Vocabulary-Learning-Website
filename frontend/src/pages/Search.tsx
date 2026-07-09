import { useState, useMemo } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { searchWords } from '@/lib/words-data';
import { useStarred } from '@/hooks/use-storage';
import { WordCard } from '@/components/WordCard';
import { FadeIn, Stagger } from '@/components/MotionPrimitives';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { isStarred, toggle: toggleStar } = useStarred();

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    return searchWords(query).slice(0, 100);
  }, [query]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <FadeIn>
        <h1 className="mb-2 font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
          搜索单词
        </h1>
        <p className="mb-6 text-muted-foreground">输入单词、音标或释义内容进行搜索</p>
      </FadeIn>

      {/* 搜索框 */}
      <FadeIn delay={0.05}>
        <div className="liquid-glass mb-6 flex items-center gap-3 px-4 py-3"
          style={{ borderRadius: 'calc(var(--radius) + 8px)' }}
        >
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入搜索内容..."
            autoFocus
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
            style={{ fontSize: 'var(--font-size-body)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="rounded-md p-1 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-90">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </FadeIn>

      {/* 结果 */}
      {query.trim() && (
        <div className="mb-4 text-sm text-muted-foreground">
          找到 {results.length} 个结果{results.length === 100 && '（仅显示前 100 个）'}
        </div>
      )}
      {results.length > 0 ? (
        <Stagger className="grid gap-3 sm:grid-cols-2">
          {results.map((w) => (
            <WordCard key={w.id} word={w} starred={isStarred(w.id)} onToggleStar={toggleStar} />
          ))}
        </Stagger>
      ) : (
        query.trim() && (
          <div className="liquid-glass p-8 text-center text-muted-foreground" style={{ borderRadius: 'var(--radius-lg)' }}>
            未找到匹配的单词
          </div>
        )
      )}
    </div>
  );
}
