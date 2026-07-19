import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Calendar, Crown, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface Entry {
  username: string;
  knownCount: number;
  todayReviewed: number;
  weekReviewed: number;
  totalReviewed: number;
  lastActive: number;
}

interface Board {
  totalWords: number;
  today: Entry[];
  week: Entry[];
  allTime: Entry[];
}

type Tab = 'today' | 'week' | 'allTime';

export function Leaderboard() {
  const { user: me } = useAuth();
  const [data, setData] = useState<Board | null>(null);
  const [tab, setTab] = useState<Tab>('allTime');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    const i = setInterval(() => {
      fetch('/api/leaderboard').then((r) => r.json()).then((d) => setData(d)).catch(() => {});
    }, 60_000);
    return () => clearInterval(i);
  }, []);

  if (loading) {
    return <div className="liquid-glass rounded-2xl p-6 text-center text-sm text-muted-foreground">加载排行榜…</div>;
  }
  if (!data) {
    return <div className="liquid-glass rounded-2xl p-6 text-center text-sm text-muted-foreground">暂无数据</div>;
  }

  const tabs: { key: Tab; label: string; icon: any; sub: (e: Entry) => number; unit: string }[] = [
    { key: 'today', label: '今日', icon: Calendar, sub: (e) => e.todayReviewed, unit: '词' },
    { key: 'week', label: '本周', icon: TrendingUp, sub: (e) => e.weekReviewed, unit: '词' },
    { key: 'allTime', label: '全部', icon: Trophy, sub: (e) => e.knownCount, unit: '词' },
  ];
  const list = tab === 'today' ? data.today : tab === 'week' ? data.week : data.allTime;
  const t = tabs.find((x) => x.key === tab)!;

  return (
    <div className="liquid-glass rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Trophy className="h-4 w-4 text-primary" />
        学习进度排行榜
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">共 {data.totalWords} 词</span>
      </div>

      {/* 切换 */}
      <div className="mb-3 flex gap-1 rounded-full bg-white/5 p-1 text-xs">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 transition-all',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* 排名列表 */}
      {list.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground/70">暂无排名</p>
      ) : (
        <ol className="space-y-1.5">
          {list.slice(0, 15).map((e, i) => {
            const isMe = me === e.username;
            const rank = i + 1;
            const TopIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Medal : null;
            const color = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-zinc-300' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground';
            return (
              <li
                key={e.username}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                  isMe ? 'bg-primary/15 ring-1 ring-primary/30' : 'bg-white/[0.03]'
                )}
              >
                <span className={cn('w-6 shrink-0 text-center text-xs font-bold tabular-nums', color)}>
                  {TopIcon ? <TopIcon className={cn('mx-auto h-4 w-4', color)} /> : rank}
                </span>
                <span className={cn('flex-1 truncate', isMe ? 'text-primary font-semibold' : 'text-foreground')}>
                  {e.username}{isMe && '（我）'}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t.sub(e)} <span className="text-[10px] opacity-70">{t.unit}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
