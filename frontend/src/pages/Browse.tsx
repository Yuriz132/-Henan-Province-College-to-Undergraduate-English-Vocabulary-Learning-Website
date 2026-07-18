import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Layers, BookOpen, Play } from 'lucide-react';
import { partStructure, getWordsByList, getListKey } from '@/lib/words-data';
import { useStarred, useProgress } from '@/hooks/use-storage';
import { WordCard } from '@/components/WordCard';
import { FlyIn, Stagger } from '@/components/MotionPrimitives';

export default function Browse() {
  const params = useParams();
  const partParam = params.part ? decodeURIComponent(params.part) : undefined;
  const listParam = params.list ? decodeURIComponent(params.list) : undefined;

  const [selectedPart, setSelectedPart] = useState<string | undefined>(partParam);
  const [selectedList, setSelectedList] = useState<string | undefined>(listParam);

  useEffect(() => {
    setSelectedPart(partParam);
    setSelectedList(listParam);
  }, [partParam, listParam]);

  const { isStarred, toggle: toggleStar } = useStarred();
  const { getListProgress } = useProgress();

  // 当前展示的单词
  const currentWords = useMemo(() => {
    if (selectedPart && selectedList) return getWordsByList(selectedPart, selectedList);
    return [];
  }, [selectedPart, selectedList]);

  // 单层：只有 part 参数 → 显示 List 列表
  if (selectedPart && !selectedList) {
    const part = partStructure.find((p) => p.name === selectedPart);
    if (!part) return null;
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <FlyIn>
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/browse" className="hover:text-foreground">浏览</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{part.name}</span>
          </div>
          <h1 className="mb-2 font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
            {part.name}
          </h1>
          <p className="mb-6 text-muted-foreground">{part.lists.length} 个 List · {part.total} 个单词</p>
        </FlyIn>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07} childVariant="flyIn">
          {part.lists.map((list) => {
            const listKey = getListKey(part.name, list.name);
            const prog = getListProgress(listKey);
            const pct = list.total > 0 ? Math.round((prog.reviewed / list.total) * 100) : 0;
            return (
              <Link
                key={list.name}
                to={`/browse/${encodeURIComponent(part.name)}/${encodeURIComponent(list.name)}`}
                className="liquid-glass liquid-glass-shine card-bounce group p-4 transition-all hover:-translate-y-1 active:scale-[0.98]"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-foreground">{list.name}</span>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mb-2 text-sm text-muted-foreground">{list.total} 个单词</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
              </Link>
            );
          })}
        </Stagger>
      </div>
    );
  }

  // 双层：有 part + list → 显示单词
  if (selectedPart && selectedList) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <FlyIn>
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/browse" className="hover:text-foreground">浏览</Link>
            <ChevronRight className="h-4 w-4" />
            <Link to={`/browse/${encodeURIComponent(selectedPart)}`} className="hover:text-foreground">{selectedPart}</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{selectedList}</span>
          </div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
                {selectedList}
              </h1>
              <p className="text-muted-foreground">{currentWords.length} 个单词</p>
            </div>
            <Link
              to={`/flashcards/${encodeURIComponent(selectedPart)}/${encodeURIComponent(selectedList)}`}
              className="liquid-glass-accent liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <Play className="h-4 w-4" /> 翻卡学习
            </Link>
          </div>
        </FlyIn>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06} childVariant="flyIn">
          {currentWords.map((w) => (
            <WordCard
              key={w.id}
              word={w}
              starred={isStarred(w.id)}
              onToggleStar={toggleStar}
            />
          ))}
        </Stagger>
      </div>
    );
  }

  // 默认：显示 Part 列表
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <FlyIn>
        <h1 className="mb-2 font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
          单词浏览
        </h1>
        <p className="mb-6 text-muted-foreground">选择一个 Part 开始学习</p>
      </FlyIn>
      <Stagger className="grid gap-3 sm:grid-cols-2" stagger={0.08} childVariant="flyIn">
        {partStructure.map((part) => (
          <Link
            key={part.name}
            to={`/browse/${encodeURIComponent(part.name)}`}
            className="liquid-glass liquid-glass-shine card-bounce group flex items-center justify-between p-5 transition-all hover:-translate-y-1 active:scale-[0.98]"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            <div>
              <h3 className="font-semibold text-foreground">{part.name}</h3>
              <p className="text-sm text-muted-foreground">{part.lists.length} List · {part.total} 词</p>
            </div>
            <BookOpen className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </Stagger>
    </div>
  );
}
