import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bot, X, Send, Loader2, Sparkles } from 'lucide-react';
import { aiChat } from '@/lib/ai';
import { useStarred, useKnown, useStudyPlans } from '@/hooks/use-storage';
import { useDailyStats } from '@/hooks/use-daily-stats';
import { allWords } from '@/lib/words-data';

interface ChatMsg { role: 'user' | 'assistant'; text: string }

export function AIChatFAB() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 拖拽位置：初始在右边距顶部 1/3 处
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const fabRef = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);

  // 初始化位置（右边，顶部 1/3）
  useEffect(() => {
    const h = window.innerHeight;
    setPos({ x: window.innerWidth - 64, y: Math.round(h / 3) });
  }, []);

  // ---- 拖拽逻辑 ----
  const onTouchStart = (e: React.TouchEvent) => {
    if (open) return; // 面板打开时不拖拽
    dragging.current = true;
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, posX: pos.x, posY: pos.y };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    setPos({ x: dragStart.current.posX + dx, y: dragStart.current.posY + dy });
  };
  const onTouchEnd = () => { dragging.current = false; };
  const onMouseDown = (e: React.MouseEvent) => {
    if (open) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: dragStart.current.posX + ev.clientX - dragStart.current.x, y: dragStart.current.posY + ev.clientY - dragStart.current.y });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- 学习数据：仅加载一次 ----
  const { count: starredCount } = useStarred();
  const { known, count: knownCount } = useKnown();
  const { plans } = useStudyPlans();
  const { streak, dailyAverage, totalReviewed } = useDailyStats();

  const sysPrompt = useMemo(() => {
    const learnedWords = Array.from(known).map(id => allWords.find(w => w.id === id)?.word).filter(Boolean).slice(0, 30);
    const totalProgress = allWords.length > 0 ? Math.round((totalReviewed / allWords.length) * 100) : 0;
    return `你是河南专升本英语 AI 学习助手。语气温暖、鼓励。
当前用户学习数据（已在页面加载时获取，对话过程中不会更新）：
- 总词库：3459 词
- 已复习：${totalReviewed} 词（${totalProgress}%）
- 已收藏：${starredCount} 词
- 已掌握：${knownCount} 词
- 已学单词举例：${learnedWords.join(', ') || '暂无'}
- 连续学习：${streak} 天
- 日均单词：${dailyAverage} 个
- 学习计划：${plans.map(p => `${p.title}(${p.type}目标${p.target})`).join(', ') || '暂无'}
请基于以上数据给出个性化建议。如果用户问英语单词，给出中文释义+例句+形近词+短语。回答简洁，200 字以内。`;
  }, [known, starredCount, knownCount, totalReviewed, streak, dailyAverage, plans]);

  // 首次打开：只用预热的一次性欢迎消息
  const initWelcome = useCallback(async () => {
    if (initialized.current || msgs.length > 0) return;
    initialized.current = true;
    setMsgs([{ role: 'assistant', text: '你好！我是 AI 学习助手 🤓\n我已了解你的学习数据。直接问我吧！' }]);
    // 后台不阻塞地用 AI 生成个性化欢迎词
    try {
      const res = await aiChat([
        { role: 'system', content: '用 2 句话给出友好中文开场白，提及用户数据时使用自然语言（如"你已经学了XX词"）。只说欢迎语本身。' },
        { role: 'user', content: sysPrompt.slice(0, 400) }
      ], { max_tokens: 150, temperature: 0.9 });
      if (res) setMsgs([{ role: 'assistant', text: res.trim() }]);
    } catch {}
  }, [sysPrompt, msgs.length]);

  useEffect(() => { if (open) initWelcome(); }, [open, initWelcome]);
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await aiChat([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userMsg }
      ], { max_tokens: 600, temperature: 0.8 });
      setMsgs(prev => [...prev, { role: 'assistant', text: res || '抱歉，请重试' }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', text: '网络出错了，请稍后重试' }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* 悬浮按钮 — 可拖动 */}
      <button
        ref={fabRef}
        onClick={() => { if (!dragging.current) setOpen(v => !v); }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        className="fixed z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-transform active:scale-95"
        style={{ left: pos.x, top: pos.y }}
        aria-label="AI 学习助手"
      >
        {open ? <X className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
      </button>

      {/* 聊天面板 — 紧随按钮位置 */}
      {open && (
        <div
          className="fixed z-[99] flex h-[400px] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.18_0.03_270/0.96)] shadow-2xl backdrop-blur-xl"
          style={{ left: Math.max(8, Math.min(pos.x - 280, window.innerWidth - 336)), top: Math.max(8, Math.min(pos.y + 0, window.innerHeight - 416)) }}
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI 学习助手</span>
            <span className="ml-auto text-[10px] text-muted-foreground">已学 {totalReviewed} 词</span>
          </div>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex gap-2'}>
                {m.role === 'assistant' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-primary text-white' : 'bg-white/8 text-foreground'
                }`}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
                <div className="rounded-xl bg-white/8 px-3 py-2 text-sm text-muted-foreground">正在思考…</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="问学习建议、查单词…"
              className="h-10 flex-1 rounded-xl bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-all active:scale-90 disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
