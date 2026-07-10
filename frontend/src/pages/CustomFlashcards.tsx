import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Word } from '@/types/word';
import { useCustomWords } from '@/hooks/use-custom-words';
import { Flashcard } from '@/components/Flashcard';
import { NotFoundFallback } from './NotFound';

export default function CustomFlashcards() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { getList } = useCustomWords();

  const list = getList(listId);

  // 把自定义单词映射成 Flashcard 需要的 Word 结构（用负 id 避免与内置词冲突）
  const words = useMemo<Word[]>(() => {
    if (!list) return [];
    return list.words.map((w, i) => ({
      id: -1 - i,
      part: list.name,
      list: list.name,
      word: w.word,
      phonetic: w.phonetic ?? '',
      meaning: w.meaning,
    }));
  }, [list]);

  if (!list || words.length === 0) return <NotFoundFallback />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Flashcard words={words} title={list.name} onClose={() => navigate(-1)} />
      <div className="mt-4 text-center">
        <Link to={`/custom/${list.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回词库
        </Link>
      </div>
    </div>
  );
}
