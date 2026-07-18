import { useCallback, useState } from 'react';
import { pushToCloud } from '@/lib/progressSync';
import type { StudyPlan } from '@/lib/studyPlans';

const STARRED_KEY = 'liquid-words:starred';
const PROGRESS_KEY = 'liquid-words:progress';
const KNOWN_KEY = 'liquid-words:known';

function readSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function readProgress(): Record<string, { reviewed: number; total: number }> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeProgress(data: Record<string, { reviewed: number; total: number }>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

/** 生词本 */
export function useStarred() {
  const [starred, setStarred] = useState<Set<number>>(() => readSet(STARRED_KEY));

  const toggle = useCallback((id: number) => {
    const next = new Set(starred);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStarred(next);
    writeSet(STARRED_KEY, next);
    pushToCloud({ starred: [...next] });
  }, [starred]);

  const isStarred = useCallback((id: number) => starred.has(id), [starred]);

  const remove = useCallback((id: number) => {
    const next = new Set(starred);
    next.delete(id);
    setStarred(next);
    writeSet(STARRED_KEY, next);
    pushToCloud({ starred: [...next] });
  }, [starred]);

  const clear = useCallback(() => {
    setStarred(new Set());
    writeSet(STARRED_KEY, new Set());
  }, []);

  return { starred, starredIds: [...starred], toggle, isStarred, remove, clear, count: starred.size };
}

/** 已掌握单词 */
export function useKnown() {
  const [known, setKnown] = useState<Set<number>>(() => readSet(KNOWN_KEY));

  const toggle = useCallback((id: number) => {
    const next = new Set(known);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setKnown(next);
    writeSet(KNOWN_KEY, next);
    pushToCloud({ known: [...next] });
  }, [known]);

  const isKnown = useCallback((id: number) => known.has(id), [known]);

  return { known, knownIds: [...known], toggle, isKnown, count: known.size };
}

/** 学习进度 */
export function useProgress() {
  const [progress, setProgress] = useState<Record<string, { reviewed: number; total: number }>>(() => readProgress());

  const getListProgress = useCallback(
    (listKey: string) => progress[listKey] ?? { reviewed: 0, total: 0 },
    [progress]
  );

  const setListProgress = useCallback((listKey: string, reviewed: number, total: number) => {
    const next = { ...progress, [listKey]: { reviewed, total } };
    setProgress(next);
    writeProgress(next);
    pushToCloud({ progress: next });
  }, [progress]);

  const markReviewed = useCallback((listKey: string, reviewed: number, total: number) => {
    const existing = progress[listKey] ?? { reviewed: 0, total };
    const next = {
      ...progress,
      [listKey]: { reviewed: Math.max(existing.reviewed, reviewed), total },
    };
    setProgress(next);
    writeProgress(next);
    pushToCloud({ progress: next });
  }, [progress]);

  const clear = useCallback(() => {
    setProgress({});
    writeProgress({});
  }, []);

  return { progress, getListProgress, setListProgress, markReviewed, clear };
}

/** 学习计划：本地存储 + 登录后增量同步到云端 */
const PLANS_KEY = 'liquid-words:plans';

function readPlans(): StudyPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    return raw ? (JSON.parse(raw) as StudyPlan[]) : [];
  } catch {
    return [];
  }
}

function writePlans(plans: StudyPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  pushToCloud({ plans });
}

export function useStudyPlans() {
  const [plans, setPlans] = useState<StudyPlan[]>(() => readPlans());

  const addPlan = useCallback(
    (plan: StudyPlan) => {
      const next = [plan, ...plans];
      setPlans(next);
      writePlans(next);
    },
    [plans]
  );

  const removePlan = useCallback(
    (id: string) => {
      const next = plans.filter((p) => p.id !== id);
      setPlans(next);
      writePlans(next);
    },
    [plans]
  );

  const toggleTask = useCallback(
    (planId: string, taskId: string) => {
      const next = plans.map((p) =>
        p.id === planId
          ? { ...p, tasks: (p.tasks ?? []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
          : p
      );
      setPlans(next);
      writePlans(next);
    },
    [plans]
  );

  return { plans, addPlan, removePlan, toggleTask };
}
