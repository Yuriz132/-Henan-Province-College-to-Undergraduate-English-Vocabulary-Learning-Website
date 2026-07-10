import { useEffect, useState, useCallback } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { fetchComments, addComment, isAnonymousReady, type Comment } from '@/lib/cloudbase';
import { cn } from '@/lib/utils';

interface WordCommentsProps {
  wordId: number;
  wordText?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  emptyText?: string;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const date = new Date(ts);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 评论组件：支持单词短语 / 近义词，以及网站反馈建议 */
export function WordComments({
  wordId,
  wordText = '',
  title,
  subtitle,
  placeholder,
  emptyText,
}: WordCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = title ?? '大家的灵光一现';
  const headerSubtitle = subtitle ?? (wordText ? `关于 “${wordText}” 的短语 / 近义词 / 记忆口诀` : '');
  const inputPlaceholder = placeholder ?? '想到相关短语或近义词？写下来分享给大家…';
  const emptyMsg = emptyText ?? '还没有人评论，来做第一个分享的人吧～';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchComments(wordId);
      setComments(list);
    } catch (e) {
      console.error('[comments] 读取失败', e);
      setError('评论加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [wordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const value = text.trim();
    if (!value || posting) return;
    if (!isAnonymousReady()) {
      setError('评论服务未就绪，请刷新页面后重试');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await addComment(wordId, value);
      setText('');
      await load();
    } catch (e) {
      console.error('[comments] 发表失败', e);
      setError('发送失败，请稍后重试');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="liquid-glass liquid-glass-strong mt-6 w-full max-w-2xl rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span>{headerTitle}</span>
        {headerSubtitle && (
          <span className="text-xs text-muted-foreground/70">{headerSubtitle}</span>
        )}
      </div>

      {/* 评论列表 */}
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground/70">{emptyMsg}</p>
        ) : (
          comments.map((c) => (
            <div
              key={c._id}
              className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-foreground/90"
            >
              <div className="min-w-0 flex-1">
                <p className="leading-relaxed break-words">{c.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  {c.author} · {timeAgo(c.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {/* 输入区 */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          maxLength={200}
          placeholder={inputPlaceholder}
          className="liquid-glass h-10 flex-1 rounded-xl bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={submit}
          disabled={posting || !text.trim()}
          className={cn(
            'liquid-glass liquid-glass-shine flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm transition-all active:scale-95',
            text.trim() && !posting
              ? 'text-primary hover:text-foreground'
              : 'cursor-not-allowed text-muted-foreground/40'
          )}
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          发送
        </button>
      </div>
    </div>
  );
}
