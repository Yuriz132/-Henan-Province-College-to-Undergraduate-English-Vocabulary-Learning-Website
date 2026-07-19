import { Link } from 'react-router-dom';
import { BookOpen, Search, Star, Layers, TrendingUp, MessageSquare, Target, Users, Activity, Sparkles, FileText, Brain, Play } from 'lucide-react';
import { allWords } from '@/lib/words-data';
import { useStarred, useKnown, useProgress } from '@/hooks/use-storage';
import { useDailyStats } from '@/hooks/use-daily-stats';
import { FlyIn, ExplodeIn } from '@/components/MotionPrimitives';
import { StudyPlans } from '@/components/StudyPlans';
import { StudyChart } from '@/components/StudyChart';
import { PersonalSummary } from '@/components/PersonalSummary';
import { ArticleGenerator } from '@/components/ArticleGenerator';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/api-client';
import { aiChat } from '@/lib/ai';

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

/** 根据学习进度取一个「状态」标签（0~100） */
function statusTag(pct: number, _streak: number): string {
  if (pct === 0) return '起步阶段';
  if (pct < 5) return '初识词汇';
  if (pct < 20) return '稳步前进';
  if (pct < 50) return '渐入佳境';
  if (pct < 80) return '轻车熟路';
  return '即将登顶';
}

export default function Index() {
  const { count: starredCount } = useStarred();
  const { count: knownCount } = useKnown();
  const { progress } = useProgress();
  const { streak, dailyAverage, last30days, recordDay } = useDailyStats();
  const [planOpen, setPlanOpen] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [chartOpen, setChartOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);
  const [motto, setMotto] = useState<string>('开启你的专升本词汇之旅，每一步都在靠近目标 ✨');

  const totalReviewed = Object.values(progress).reduce((sum, p) => sum + p.reviewed, 0);
  const totalProgress = allWords.length > 0 ? Math.round((totalReviewed / allWords.length) * 100) : 0;

  // 自动记录每日学习量
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

  // AI 动态生成「升本词汇」下的激励文案（按学习状态分类）
  useEffect(() => {
    const tag = statusTag(totalProgress, streak);
    const cacheKey = `liquid-words:motto:${tag}:${Math.floor(totalProgress / 5)}:${streak > 0 ? '1' : '0'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setMotto(cached);
      return;
    }
    const sys = `你是一位温暖、简短的升本英语学习鼓励者。请根据用户的"学习状态"输出一句30字以内、富有正能量的中文文案，不要使用感叹号堆砌、不要重复"加油"等陈词。只返回文案本身，不要加任何前缀、引号或解释。`;
    const user = `学习状态：${tag}（学习进度 ${totalProgress}%，已学 ${totalReviewed} 个单词，连续 ${streak} 天，日均 ${dailyAverage} 个）`;
    aiChat([
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { max_tokens: 120, temperature: 0.9 })
      .then((text) => {
        const clean = (text || '').replace(/^["「']|["」']$/g, '').trim() || `今天继续，${tag} 阶段稳扎稳打 ✨`;
        setMotto(clean);
        try { localStorage.setItem(cacheKey, clean); } catch {}
      })
      .catch(() => { /* 失败就保持默认 motto */ });
  }, [totalProgress, streak, totalReviewed, dailyAverage]);

  const scrollToFeedback = () => {
    document.getElementById('feedback-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto max-w-5xl px-3 py-5 sm:px-5 sm:py-6">
      {/* Hero — 缩小版 */}
      <ExplodeIn initialScale={0.4}>
        <div
          className="liquid-glass card-bounce mb-5 overflow-hidden p-5 text-center sm:p-7"
          style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
        >
          <h1
            className="font-bold text-gradient"
            style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.1 }}
          >
            升本词汇
          </h1>
          {/* AI 生成的动态文案（根据学习状态变化） */}
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground/80">
            <Sparkles className="h-3 w-3 text-primary/70" />
            <span>{motto}</span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 max-w-sm mx-auto">
            <Link
              to="/browse"
              className="liquid-glass-accent liquid-glass liquid-glass-shine card-bounce flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <BookOpen className="h-3.5 w-3.5" /> 开始浏览
            </Link>
            <Link
              to="/search"
              className="liquid-glass liquid-glass-shine card-bounce flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
            >
              <Search className="h-3.5 w-3.5" /> 搜索单词
            </Link>
            <button
              onClick={scrollToFeedback}
              className="liquid-glass liquid-glass-shine card-bounce flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
            >
              <MessageSquare className="h-3.5 w-3.5" /> 讨论建议
            </button>
            <button
              onClick={() => setPlanOpen(true)}
              className="liquid-glass liquid-glass-shine card-bounce flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground active:scale-95"
            >
              <Target className="h-3.5 w-3.5" /> 学习计划
            </button>
          </div>
          <div className="mt-3">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/25 hover:-translate-y-0.5 active:scale-95"
            >
              <Play className="h-3.5 w-3.5" /> 翻卡学习（闪记单词）
            </Link>
          </div>
        </div>
      </ExplodeIn>

      {/* 当前学习人数 */}
      <FlyIn delay={0.02}>
        <p className="mb-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
          <Users className="h-3 w-3" />
          当前已有 <span className="font-medium text-foreground/80">{totalUsers}</span> 位同学在学
        </p>
      </FlyIn>

      {/* 统计 — 4 张卡片（2列2排），分别跳转不同页面 */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          { label: '单词总数', value: allWords.length, icon: Layers, color: 'text-primary', to: '/browse' },
          { label: '已收藏', value: starredCount, icon: Star, color: 'text-warning', to: '/starred' },
          { label: '已掌握', value: knownCount, icon: TrendingUp, color: 'text-success', to: '/starred?tab=known' },
          {
            label: '学习情况',
            value: `${totalProgress}%`,
            icon: Activity,
            color: 'text-accent',
            extra: `${streak}天 · ${dailyAverage}/日`,
            action: () => setChartOpen(true),
          },
        ] as const).map((s, idx) => {
          const Icon = s.icon;
          const body = (
            <>
              <Icon className={`mb-1.5 h-4 w-4 ${s.color}`} />
              <div className="text-xl font-bold text-foreground">{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
              {('extra' in s && s.extra) && (
                <div className="mt-0.5 text-[10px] text-muted-foreground/70">{s.extra}</div>
              )}
            </>
          );
          const cardCls = 'liquid-glass card-bounce flex h-24 w-full flex-col justify-between p-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98]';
          return (
            <FlyIn key={s.label} delay={idx * 0.05}>
              {'to' in s && s.to ? (
                <Link
                  to={s.to}
                  className={cardCls}
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  {body}
                </Link>
              ) : (
                <button
                  onClick={s.action}
                  className={cardCls}
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  {body}
                </button>
              )}
            </FlyIn>
          );
        })}
      </div>

      {/* AI 快捷入口 */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => setSummaryOpen(true)}
          className="liquid-glass liquid-glass-shine flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs text-primary transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <Brain className="h-3.5 w-3.5" /> AI 个人总结
        </button>
        <button
          onClick={() => setArticleOpen(true)}
          className="liquid-glass liquid-glass-shine flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs text-primary transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <FileText className="h-3.5 w-3.5" /> AI 文章生成
        </button>
      </div>

      {/* 折线图弹窗 */}
      <StudyChart
        data={last30days}
        title="近30天学习趋势"
        open={chartOpen}
        onOpenChange={setChartOpen}
      />

      {/* AI 个人总结弹窗 */}
      <PersonalSummary open={summaryOpen} onOpenChange={setSummaryOpen} />

      {/* AI 文章生成弹窗 */}
      <ArticleGenerator open={articleOpen} onOpenChange={setArticleOpen} />

      {/* 学习计划 */}
      <FlyIn delay={0.08}>
        <div className="mt-5 w-full">
          <StudyPlans open={planOpen} onOpenChange={setPlanOpen} />
        </div>
      </FlyIn>

      {/* 学习进度备份 */}
      <FlyIn delay={0.1}>
        <div className="mt-5 w-full">
          <Suspense fallback={null}>
            <ProgressIO />
          </Suspense>
        </div>
      </FlyIn>

      {/* 网站反馈与建议 */}
      <FlyIn delay={0.12}>
        <div id="feedback-section" className="mt-5 w-full">
          <Suspense fallback={null}>
            <SiteFeedback />
          </Suspense>
        </div>
      </FlyIn>
    </div>
  );
}
