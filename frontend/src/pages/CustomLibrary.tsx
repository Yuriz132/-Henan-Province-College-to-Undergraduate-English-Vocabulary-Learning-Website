import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, BookMarked, Pencil, Trash2, Play, Volume2, X, ChevronRight } from 'lucide-react';
import { useCustomWords } from '@/hooks/use-custom-words';
import { speakWord } from '@/lib/speak';
import { FadeIn, Stagger } from '@/components/MotionPrimitives';

export default function CustomLibrary() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { lists, createList, renameList, deleteList, addWord, updateWord, removeWord, getList } = useCustomWords();

  const [newListName, setNewListName] = useState('');
  const [adding, setAdding] = useState(false);

  const active = listId ? getList(listId) : undefined;

  if (active) {
    return (
      <ListDetail
        list={active}
        onBack={() => navigate('/custom')}
        onRename={(name) => renameList(active.id, name)}
        onDelete={() => {
          if (window.confirm(`删除词库「${active.name}」？此操作不可恢复`)) {
            deleteList(active.id);
            navigate('/custom');
          }
        }}
        onAddWord={(w) => addWord(active.id, w)}
        onUpdateWord={(i, w) => updateWord(active.id, i, w)}
        onRemoveWord={(i) => removeWord(active.id, i)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <FadeIn>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
              自定义词库
            </h1>
            <p className="mt-1 text-muted-foreground">创建你自己的单词本，可翻卡学习、听音写词</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="liquid-glass-accent liquid-glass liquid-glass-shine flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="h-4 w-4" /> 新建词库
          </button>
        </div>
      </FadeIn>

      {adding && (
        <div className="liquid-glass mb-6 flex items-center gap-2 rounded-xl p-3">
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newListName.trim()) {
                const id = createList(newListName);
                setNewListName('');
                setAdding(false);
                navigate(`/custom/${id}`);
              }
            }}
            placeholder="词库名称，如「高频考点」"
            className="liquid-glass h-10 flex-1 rounded-lg bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => {
              if (newListName.trim()) {
                const id = createList(newListName);
                setNewListName('');
                setAdding(false);
                navigate(`/custom/${id}`);
              }
            }}
            className="liquid-glass liquid-glass-shine flex h-10 items-center rounded-lg px-4 text-sm text-primary transition-all active:scale-95"
          >
            创建
          </button>
          <button
            onClick={() => { setAdding(false); setNewListName(''); }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/5 active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {lists.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground/70">
          还没有词库，点击右上角「新建词库」开始添加你自己的单词吧～
        </p>
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => navigate(`/custom/${l.id}`)}
              className="liquid-glass liquid-glass-shine group flex flex-col items-start p-5 text-left transition-all hover:-translate-y-1 active:scale-[0.98]"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <div className="mb-2 flex w-full items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <BookMarked className="h-4 w-4 text-primary" />
                  {l.name}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="text-sm text-muted-foreground">{l.words.length} 个单词</div>
            </button>
          ))}
        </Stagger>
      )}
    </div>
  );
}

interface ListDetailProps {
  list: { id: string; name: string; words: { word: string; phonetic?: string; meaning: string }[] };
  onBack: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddWord: (w: { word: string; phonetic?: string; meaning: string }) => void;
  onUpdateWord: (i: number, w: { word: string; phonetic?: string; meaning: string }) => void;
  onRemoveWord: (i: number) => void;
}

function ListDetail({ list, onBack, onRename, onDelete, onAddWord, onUpdateWord, onRemoveWord }: ListDetailProps) {
  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [meaning, setMeaning] = useState('');
  const [editing, setEditing] = useState<number | null>(null);

  const submit = () => {
    if (!word.trim()) return;
    const w = { word: word.trim(), phonetic: phonetic.trim() || undefined, meaning: meaning.trim() };
    if (editing !== null) {
      onUpdateWord(editing, w);
      setEditing(null);
    } else {
      onAddWord(w);
    }
    setWord('');
    setPhonetic('');
    setMeaning('');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground">词库</button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{list.name}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          defaultValue={list.name}
          onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== list.name) onRename(e.target.value); }}
          className="liquid-glass h-9 rounded-lg bg-white/5 px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Link
          to={`/flashcards/custom/${list.id}`}
          className="liquid-glass-accent liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <Play className="h-4 w-4" /> 翻卡学习
        </Link>
        <Link
          to={`/quiz?source=custom&id=${list.id}`}
          className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
        >
          <Volume2 className="h-4 w-4" /> 听音写词
        </Link>
        <button
          onClick={onDelete}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-95"
        >
          <Trash2 className="h-4 w-4" /> 删除词库
        </button>
      </div>

      {/* 添加 / 编辑单词 */}
      <div className="liquid-glass mb-6 rounded-2xl p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="英文单词"
            className="liquid-glass h-10 rounded-lg bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
            placeholder="音标（可选）"
            className="liquid-glass h-10 rounded-lg bg-white/5 px-3 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="中文释义"
            className="liquid-glass h-10 rounded-lg bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={submit}
            className="liquid-glass liquid-glass-shine flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm text-primary transition-all active:scale-95"
          >
            {editing !== null ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing !== null ? '保存' : '添加'}
          </button>
        </div>
      </div>

      {list.words.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/70">还没有单词，在上方添加吧～</p>
      ) : (
        <div className="space-y-2">
          {list.words.map((w, i) => (
            <div
              key={i}
              className="liquid-glass flex items-center gap-3 rounded-xl px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{w.word}</span>
                  {w.phonetic && <span className="font-mono text-xs text-muted-foreground">{w.phonetic}</span>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{w.meaning}</p>
              </div>
              <button
                onClick={() => speakWord(w.word)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-primary active:scale-90"
                aria-label="发音"
              >
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setWord(w.word);
                  setPhonetic(w.phonetic ?? '');
                  setMeaning(w.meaning);
                  setEditing(i);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-90"
                aria-label="编辑"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onRemoveWord(i)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
