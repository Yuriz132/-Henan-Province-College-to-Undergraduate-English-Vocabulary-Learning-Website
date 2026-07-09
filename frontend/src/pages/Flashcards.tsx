import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getWordsByList } from '@/lib/words-data';
import { useStarred, useKnown, useProgress } from '@/hooks/use-storage';
import { Flashcard } from '@/components/Flashcard';
import { NotFoundFallback } from './NotFound';

export default function Flashcards() {
  const params = useParams();
  const navigate = useNavigate();
  const part = params.part ? decodeURIComponent(params.part) : '';
  const list = params.list ? decodeURIComponent(params.list) : '';

  // 用 useMemo 固定 words 引用，避免父组件重渲染时触发 Flashcard 内部重置
  const words = useMemo(() => getWordsByList(part, list), [part, list]);
  const { isStarred, toggle: toggleStar } = useStarred();
  const { toggle: toggleKnown } = useKnown();
  const { markReviewed } = useProgress();

  if (words.length === 0) return <NotFoundFallback />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Flashcard
        words={words}
        title={`${part} · ${list}`}
        isStarred={isStarred}
        onStar={toggleStar}
        onKnown={(id, reviewedCount) => {
          toggleKnown(id);
          markReviewed(`${part}::${list}`, reviewedCount, words.length);
        }}
        onClose={() => navigate(-1)}
      />
      <div className="mt-4 text-center">
        <Link to={`/browse/${encodeURIComponent(part)}/${encodeURIComponent(list)}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回单词列表
        </Link>
      </div>
    </div>
  );
}
