import { useState, useRef, useEffect, useCallback } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const hasStarted = useRef(false);

  // 收集学习上下文
  const { count: starredCount } = useStarred();
  const { known, count: knownCount } = useKnown();
  const { plans } = useStudyPlans();
  const { streak, dailyAverage, totalReviewed } = useDailyStats();

  const buildContext = useCallback(() => {
    const learnedWords = Array.from(known).map(id => allWords.find(w => w.id === id)?.word).filter(Boolean).slice(0, 30);
    const totalProgress = allWords.length > 0 ? Math.round((totalReviewed / allWords.length) * 100) : 0;
    return {
      totalWords: 3459,
      totalReviewed,
      progress: `${totalProgress}%`,
      starred: starredCount,
      known: knownCount,
      learnedSample: learnedWords.join(', ') || '暂无',
      streak,
      dailyAverage,
      plansCount: plans.length,
      plans: plans.map(p => `${p.title}(${p.type}目标${p.target})`).join(', ') || '暂无',
    };
  }, [known, starredCount, knownCount, totalReviewed, streak, dailyAverage, plans]);

  // 首次打开时，预热系统提示 + 发送上下文给 AI
  const initChat = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const ctx = buildContext();
    setMsgs([{ role: 'assistant', text: '你好！我是 AI 学习助手 🤓\n我可以帮你分析学习情况、推荐复习重点、解答英语问题。随时问我！' }]);
    // 后台悄悄获取 AI 个性化欢迎词
    try {
      const sys = `你是已加载用户学习数据的 AI 学习助手。根据以下上下文用 2-3 句话给出友好、有针对性的中文开场白（不要重复用户数据，用"你已经学了XX词"这样的自然语言）。只说欢迎语本身，不用道歉、不用提示。`;
      const res = await aiChat([
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(ctx) }
      ], { max_tokens: 200, temperature: 0.9 });
      setMsgs([{ role: 'assistant', text: (res || '你好！有什么可以帮你？').trim() }]);
    } catch {}
  }, [buildContext]);

  useEffect(() => { if (open) { initChat(); } }, [open, initChat]);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const ctx = buildContext();
      const sys = `你是河南专升本英语 AI 学习助手。语气温暖、鼓励。帮助用户分析学习情况、解答英语问题、推荐学习策略。
当前用户学习数据：
- 总词库：${ctx.totalWords} 词
- 已复习：${ctx.totalReviewed} 词（${ctx.progress}）
- 已收藏：${ctx.starred} 词
- 已掌握：${ctx.known} 词
- 已学单词举例：${ctx.learnedSample}
- 连续学习：${ctx.streak} 天
- 日均单词：${ctx.dailyAverage} 个
- 学习计划：${ctx.plans}
请基于以上数据给出个性化建议。如果用户问英语单词，请给出中文释义+例句+形近词+短语。回答简洁，300 字以内。`;
      const res = await aiChat([
        { role: 'system', content: sys },
        { role: 'user', content: userMsg }
      ], { max_tokens: 600, temperature: 0.8 });
      setMsgs(prev => [...prev, { role: 'assistant', text: res || '抱歉，请重试' }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', text: '网络出错了，请稍后重试' }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-all hover:scale-110 active:scale-95"
        aria-label="AI 学习助手"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <Bot className="h-6 w-6 text-white" />}
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[99] flex h-[420px] w-[340px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.18_0.03_270/0.96)] shadow-2xl backdrop-blur-xl">
          {/* 顶栏 */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI 学习助手</span>
            <span className="ml-auto text-[10px] text-muted-foreground">已学 {totalReviewed} 词</span>
          </div>

          {/* 消息列表 */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex gap-2'}>
                {m.role === 'assistant' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-white/8 text-foreground'
                }`}>
                  {m.text}
                </div>
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

          {/* 输入框 */}
          <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="问学习建议、查单词…"
              className="h-10 flex-1 rounded-xl bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-all active:scale-90 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
