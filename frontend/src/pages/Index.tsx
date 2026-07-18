import { Link } from 'react-router-dom';
import { BookOpen, Search, Star, Layers, TrendingUp, ArrowRight, MessageSquare, Target, Users, Flame, BarChart3 } from 'lucide-react';
import { allWords, partStructure, getListKey } from '@/lib/words-data';
import { useStarred, useKnown, useProgress } from '@/hooks/use-storage';
import { useDailyStats } from '@/hooks/use-daily-stats';
import { FlyIn, ExplodeIn } from '@/components/MotionPrimitives';
import { StudyPlans } from '@/components/StudyPlans';
import { StudyChart } from '@/components/StudyChart';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/api-client';

const SiteFeedback = lazy(() =>
  import('@/components/WordComments').then((m) => ({
    default: function SiteFeedbackWrapper() {
      return (
        <m.WordComments
          wordId={-2}
          title="反馈与建议"
          subtitle="遇到问题、有新想法或想鼓励作者，都可以写在这里"
          placeholder="写下你的反馈或建议…"
          emptyText="还没有反馈，来做第一个提建议的人吧～"
        />
      );
    },
  }))
);

const ProgressIO = lazy(() =>
  import('@/components/ProgressIO').then((m) => ({ default: m.ProgressIO }))
);

export default function Index() {
  const { count: starredCount } = useStarred();
  const { count: knownCount } = useKnown();
  const { progress } = useProgress();
  const { streak, dailyAverage, last30days, recordDay } = useDailyStats();
  const [planOpen, setPlanOpen] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);

  const totalReviewed = Object.values(progress).reduce((sum, p) => sum + p.reviewed, 0);
  const totalProgress = allWords.length > 0 ? Math.round((totalReviewed / allWords.length) * 100) : 0;

  // 自动记录每日学习量（进度变化时累计）
  const prevReviewedRef = useRef(totalReviewed);
  useEffect(() => {
    if (totalReviewed > (prevReviewedRef.current ?? 0)) {
      recordDay(totalReviewed - (prevReviewedRef.current ?? 0));
      prevReviewedRef.current = totalReviewed;
    }
  }, [totalReviewed]);

  useEffect(() => {
    apiClient.get<{ totalUsers: number }>('/stats')
      .then((res) => setTotalUsers(res.data.totalUsers ?? 0))
      .catch(() => {});
  }, []);

  const scrollToFeedback = () => {
    document.getElementById('feedback-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stats = [
    { label: '单词总数', value: allWords.length, icon: Layers, color: 'text-primary' },
    { label: '已收藏', value: starredCount, icon: Star, color: 'text-warning' },
    { label: '已掌握', value: knownCount, icon: TrendingUp, color: 'text-success' },
    { label: '学习进度', value: `${totalProgress}%`, icon: BookOpen, color: 'text-accent' },
    { label: '连续天数', value: streak, icon: Flame, color: 'text-orange-400' },
    { label: '日均单词', value: dailyAverage, icon: BarChart3, color: 'text-cyan-400' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Hero — 开屏从中心聚拢飞入 */}
      <ExplodeIn initialScale={0.4}>
        <div className="liquid-glass card-bounce mb-8 overflow-hidden p-8 text-center sm:p-12"
          style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
        >
          <h1 className="font-bold text-gradient"
            style={{ fontSize: 'clamp(2.2rem, 8vw, 2.8rem)', lineHeight: 1.1 }}
          >
            升本词汇
          </h1>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/browse"
              className="liquid-glass-accent liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-6 py-2.5 font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <BookOpen className="h-4 w-4" /> 开始浏览
            </Link>
            <Link
              to="/search"
              className="liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-6 py-2.5 text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
            >
              <Search className="h-4 w-4" /> 搜索单词
            </Link>
            <button
              onClick={scrollToFeedback}
              className="liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-6 py-2.5 text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
            >
              <MessageSquare className="h-4 w-4" /> 讨论建议
            </button>
            <button
              onClick={() => setPlanOpen(true)}
              className="liquid-glass liquid-glass-shine card-bounce flex items-center gap-2 rounded-full px-6 py-2.5 text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
            >
              <Target className="h-4 w-4" /> 学习计划
            </button>
          </div>
        </div>
      </ExplodeIn>

      {/* 当前学习人数 */}
      <FlyIn delay={0.02}>
        <p className="mb-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <Users className="h-3.5 w-3.5" />
          当前已有 <span className="font-medium text-foreground/80">{totalUsers}</span> 位同学在学
          <span className="mx-1">·</span>
          收录 <span className="font-medium text-foreground/80">{allWords.length.toLocaleString()}</span> 个专升本核心词汇
        </p>
      </FlyIn>

      {/* 统计 — 6张卡片 3列布局，点击弹出折线图 */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <FlyIn key={s.label} delay={idx * 0.05}>
              <button
                onClick={() => setChartOpen(true)}
                className="liquid-glass card-bounce w-full p-4 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                <Icon className={`mb-2 h-5 w-5 ${s.color}`} />
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </button>
            </FlyIn>
          );
        })}
      </div>

      {/* 折线图弹窗 */}
      <StudyChart
        data={last30days}
        title="近30天学习趋势"
        open={chartOpen}
        onOpenChange={setChartOpen}
      />

      {/* Part 导航标题 */}
      <FlyIn delay={0.05}>
        <h2 className="mb-4 font-semibold text-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
          单词分组
        </h2>
      </FlyIn>

      {/* Part 导航卡片 — flyIn 增强飞入（手动包裹避免 Stagger childVariant 破坏 Link 布局） */}
      <div className="grid gap-3 sm:grid-cols-2">
        {partStructure.map((part, idx) => {
          const partReviewed = part.lists.reduce((sum, l) => {
            const p = progress[getListKey(part.name, l.name)];
            return sum + (p?.reviewed ?? 0);
          }, 0);
          const pct = part.total > 0 ? Math.round((partReviewed / part.total) * 100) : 0;
          return (
            <FlyIn key={part.name} delay={idx * 0.06}>
              <Link
                to={`/browse/${encodeURIComponent(part.name)}`}
                className="liquid-glass liquid-glass-shine card-bounce group block p-5 transition-all hover:-translate-y-1 active:scale-[0.98]"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{part.name}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{part.lists.length} 个 List</span>
                <span>·</span>
                <span>{part.total} 词</span>
              </div>
              {/* 进度条 */}
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%`, transitionDuration: 'var(--duration-slow)' }}
                />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{pct}% 已学习</div>
              </Link>
            </FlyIn>
          );
        })}
      </div>

      {/* 学习计划 */}
      <FlyIn delay={0.08}>
        <div className="mt-8 w-full">
          <StudyPlans open={planOpen} onOpenChange={setPlanOpen} />
        </div>
      </FlyIn>

      {/* 学习进度备份 */}
      <FlyIn delay={0.1}>
        <div className="mt-8 w-full">
          <Suspense fallback={null}>
            <ProgressIO />
          </Suspense>
        </div>
      </FlyIn>

      {/* 网站反馈与建议 */}
      <FlyIn delay={0.12}>
        <div id="feedback-section" className="mt-8 w-full">
          <Suspense fallback={null}>
            <SiteFeedback />
          </Suspense>
        </div>
      </FlyIn>
    </div>
  );
}
