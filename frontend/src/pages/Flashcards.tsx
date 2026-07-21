import { useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { getWordsByList, allWords } from '@/lib/words-data';
import { useStarred, useKnown, useProgress, useReviews } from '@/hooks/use-storage';
import { Flashcard } from '@/components/Flashcard';
import { NotFoundFallback } from './NotFound';

export default function Flashcards() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const reviewMode = location.pathname === '/review';

  const part = params.part ? decodeURIComponent(params.part) : '';
  const list = params.list ? decodeURIComponent(params.list) : '';

  const { isStarred, toggle: toggleStar } = useStarred();
  const { toggle: toggleKnown } = useKnown();
  const { markReviewed } = useProgress();
  const { scheduleReview, getDueIds } = useReviews();

  // 复习模式：只取「今天到期需要复习」的词（跨全部词库）
  const words = useMemo(() => {
    if (reviewMode) {
      const now = Date.now();
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const dueIds = new Set(getDueIds(allWords.map((w) => w.id), endOfToday.getTime()));
      return allWords.filter((w) => dueIds.has(w.id));
    }
    return getWordsByList(part, list);
  }, [reviewMode, part, list, getDueIds]);

  if (words.length === 0) {
    if (reviewMode) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="liquid-glass card-bounce mx-auto max-w-md p-8" style={{ borderRadius: 'calc(var(--radius) + 12px)' }}>
            <div className="text-4xl">🎉</div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">今天没有需要复习的单词</h2>
            <p className="mt-1 text-sm text-muted-foreground">按时复习能牢牢记住，去学点新词吧～</p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-5 py-1.5 text-sm font-semibold text-primary transition-all hover:bg-primary/25 active:scale-95"
            >
              返回首页
            </Link>
          </div>
        </div>
      );
    }
    return <NotFoundFallback />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Flashcard
        words={words}
        title={reviewMode ? '待复习' : `${part} · ${list}`}
        isStarred={isStarred}
        onStar={toggleStar}
        onKnown={(id, reviewedCount) => {
          toggleKnown(id);
          if (!reviewMode) markReviewed(`${part}::${list}`, reviewedCount, words.length);
        }}
        onReview={(id, grade) => scheduleReview(id, grade)}
        onClose={() => navigate(-1)}
      />
      <div className="mt-4 text-center">
        {reviewMode ? (
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回首页
          </Link>
        ) : (
          <Link to={`/browse/${encodeURIComponent(part)}/${encodeURIComponent(list)}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← 返回单词列表
          </Link>
        )}
      </div>
    </div>
  );
}
