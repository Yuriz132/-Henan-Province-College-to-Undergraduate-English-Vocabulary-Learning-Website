import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, CalendarCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudyPlans, useProgress } from '@/hooks/use-storage';
import { partStructure, getListKey } from '@/lib/words-data';
import { PLAN_TYPE_LABEL, type PlanType, type StudyPlan } from '@/lib/studyPlans';

interface StudyPlansProps {
  /** Dialog 开关（由首页 hero 按钮或区块内按钮统一控制） */
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** 当前进度：章节/单词从学习记录自动推导；自定义取已勾选子任务数 */
function computeCurrent(
  plan: StudyPlan,
  progress: Record<string, { reviewed: number; total: number }>
): number {
  if (plan.type === 'custom') return (plan.tasks ?? []).filter((t) => t.done).length;
  if (plan.type === 'chapters') {
    return partStructure.filter((part) => {
      const reviewed = part.lists.reduce(
        (s, l) => s + (progress[getListKey(part.name, l.name)]?.reviewed ?? 0),
        0
      );
      return part.total > 0 && reviewed >= part.total;
    }).length;
  }
  // words：累计已复习单词数
  return Object.values(progress).reduce((s, p) => s + p.reviewed, 0);
}

/** 与运行环境无关的 UUID 生成器（crypto.randomUUID 仅在安全上下文可用，HTTP 下会 undefined） */
const uuid = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const EMPTY_TASK = () => ({ id: uuid(), text: '' });

export function StudyPlans({ open, onOpenChange }: StudyPlansProps) {
  const { plans, addPlan, removePlan, toggleTask } = useStudyPlans();
  const { progress } = useProgress();

  const [type, setType] = useState<PlanType>('chapters');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(5);
  const [tasks, setTasks] = useState<{ id: string; text: string }[]>([EMPTY_TASK()]);

  // 每次打开弹窗重置表单
  useEffect(() => {
    if (open) {
      setType('chapters');
      setTitle('');
      setTarget(5);
      setTasks([EMPTY_TASK()]);
    }
  }, [open]);

  const validTasks = tasks.filter((t) => t.text.trim().length > 0);

  const onCreate = () => {
    const plan: StudyPlan = {
      id: uuid(),
      type,
      title: title.trim() || PLAN_TYPE_LABEL[type],
      target:
        type === 'custom'
          ? Math.max(1, validTasks.length)
          : Math.max(1, Math.floor(target) || 1),
      tasks:
        type === 'custom'
          ? validTasks.map((t) => ({ id: t.id, text: t.text.trim(), done: false }))
          : undefined,
      createdAt: Date.now(),
    };
    addPlan(plan);
    onOpenChange(false);
  };

  return (
    <>
      <div className="liquid-glass p-5" style={{ borderRadius: 'calc(var(--radius) + 8px)' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Target className="h-4 w-4 text-primary" />
            <span>学习计划</span>
            <span className="text-xs text-muted-foreground/70">
              自定义目标，进度自动记录（登录后保存在云端）
            </span>
          </div>
          <button
            onClick={() => onOpenChange(true)}
            className="liquid-glass liquid-glass-shine flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-muted-foreground transition-all hover:text-primary active:scale-95"
          >
            <Plus className="h-4 w-4" /> 添加计划
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            还没有学习计划，点「添加计划」制定第一个目标吧～
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const current = computeCurrent(plan, progress);
              const pct = plan.target > 0 ? Math.min(100, Math.round((current / plan.target) * 100)) : 0;
              const done = current >= plan.target;
              return (
                <div
                  key={plan.id}
                  className="liquid-glass-shine relative rounded-xl border border-white/10 p-4"
                >
                  <button
                    onClick={() => removePlan(plan.id)}
                    className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-destructive"
                    aria-label="删除计划"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      {PLAN_TYPE_LABEL[plan.type]}
                    </span>
                    {done && (
                      <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        <CalendarCheck className="h-3 w-3" /> 已完成
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-semibold text-foreground">{plan.title}</div>

                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {current} / {plan.target}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%`, transitionDuration: 'var(--duration-slow)' }}
                    />
                  </div>

                  {/* 自定义任务：可勾选 */}
                  {plan.type === 'custom' && plan.tasks && plan.tasks.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {plan.tasks.map((t) => (
                        <li key={t.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() => toggleTask(plan.id, t.id)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className={t.done ? 'text-muted-foreground line-through' : ''}>
                              {t.text}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>制定学习计划</DialogTitle>
            <DialogDescription>选择目标类型并设定数值，进度会根据你的学习记录自动累计。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Tabs value={type} onValueChange={(v) => setType(v as PlanType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chapters">完成章节</TabsTrigger>
                <TabsTrigger value="words">累计单词</TabsTrigger>
                <TabsTrigger value="custom">自定义</TabsTrigger>
              </TabsList>

              <TabsContent value="chapters" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">全站共 {partStructure.length} 个章节，完成一个章节（该章所有单词都已学习）即计 1。</p>
              </TabsContent>
              <TabsContent value="words" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">累计已复习的单词总数达到目标即完成。</p>
              </TabsContent>
              <TabsContent value="custom" className="space-y-2 pt-3">
                <p className="text-xs text-muted-foreground">自行添加若干子任务，勾选完成即累计进度。</p>
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="plan-title">计划名称</Label>
              <Input
                id="plan-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`例如：${PLAN_TYPE_LABEL[type]}计划`}
              />
            </div>

            {type !== 'custom' ? (
              <div className="space-y-1.5">
                <Label htmlFor="plan-target">
                  目标{type === 'chapters' ? '章节数' : '单词数'}
                </Label>
                <Input
                  id="plan-target"
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>子任务</Label>
                {tasks.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Input
                      value={t.text}
                      onChange={(e) => {
                        const next = tasks.slice();
                        next[i] = { ...t, text: e.target.value };
                        setTasks(next);
                      }}
                      placeholder={`任务 ${i + 1}`}
                    />
                    <button
                      onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-destructive"
                      aria-label="删除任务"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setTasks([...tasks, EMPTY_TASK()])}
                >
                  <Plus className="h-4 w-4" /> 添加任务
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={onCreate} disabled={type === 'custom' && validTasks.length === 0}>
              创建计划
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
