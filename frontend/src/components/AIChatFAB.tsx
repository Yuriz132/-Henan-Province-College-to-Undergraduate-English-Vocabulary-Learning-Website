import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bot, X, Send, Loader2, Sparkles } from 'lucide-react';
import { LiquidGlass } from '@/components/LiquidGlass';
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
  const initialized = useRef(false);

  // ---- 学习数据：仅加载一次 ----
  const { count: starredCount } = useStarred();
  const { known, count: knownCount } = useKnown();
  const { plans } = useStudyPlans();
  const { streak, dailyAverage, totalReviewed } = useDailyStats();

  const sysPrompt = useMemo(() => {
    const learnedWords = Array.from(known).map(id => allWords.find(w => w.id === id)?.word).filter(Boolean).slice(0, 30);
    const totalProgress = allWords.length > 0 ? Math.round((totalReviewed / allWords.length) * 100) : 0;
    return `你是由菲哥（一位专升本开发者）创建的 AI 学习助手。语气温暖、鼓励。
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
  const initWelcome = useCallback(() => {
    if (initialized.current) return;
    initialized.current = true;
    // 离线模板欢迎语（不调 AI，秒出）
    const welcome = `你好！我是菲哥开发的 AI 学习助手 🤓\n\n我已加载你的学习数据：\n📚 已复习 ${totalReviewed} 词 · ⭐ 收藏 ${starredCount} · ✅ 掌握 ${knownCount}\n🔥 连续 ${streak} 天 · 📊 日均 ${dailyAverage} 词\n\n有什么学习问题直接问我！`;
    setMsgs([{ role: 'assistant', text: welcome }]);
  }, [totalReviewed, starredCount, knownCount, streak, dailyAverage]);

  useEffect(() => { if (open) initWelcome(); }, [open, initWelcome]);
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMsgs(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    // 先加一个空白的 AI 回复占位
    setMsgs(prev => [...prev, { role: 'assistant', text: '' }]);
    try {
      await aiChat([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userMsg }
      ], {
        max_tokens: 600, temperature: 0.8,
        onChunk(chunk) {
          setMsgs(prev => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, text: last.text + chunk };
            return copy;
          });
        }
      });
    } catch {
      setMsgs(prev => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && !last.text) copy[copy.length - 1] = { ...last, text: '网络出错了，请稍后重试' };
        return copy;
      });
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* 悬浮按钮 — 右下角固定（和第一版一样） */}
      <LiquidGlass
        as="button"
        onClick={() => setOpen(v => !v)}
        className="liquid-glass liquid-glass-shine bottom-6 right-6 z-[250] flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-primary active:scale-95"
        style={{
          position: 'fixed',
          borderRadius: '50%',
          boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 45%, transparent), 0 2px 10px color-mix(in oklch, var(--primary) 30%, transparent), 0 0 16px color-mix(in oklch, var(--primary) 50%, transparent)',
        }}
        aria-label="AI 学习助手"
      >
        {open ? <X className="h-5 w-5 text-primary" /> : <Bot className="h-5 w-5 text-primary" />}
      </LiquidGlass>

      {/* 聊天面板 — 右下角弹出 */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[200] flex h-[400px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden border border-white/15 bg-[oklch(0.22_0.04_270/0.96)] shadow-2xl backdrop-blur-xl"
          style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
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
