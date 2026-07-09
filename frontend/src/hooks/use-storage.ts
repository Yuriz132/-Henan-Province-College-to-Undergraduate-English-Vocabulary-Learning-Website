import { useCallback, useState } from 'react';

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
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(STARRED_KEY, next);
      return next;
    });
  }, []);

  const isStarred = useCallback((id: number) => starred.has(id), [starred]);

  const remove = useCallback((id: number) => {
    setStarred((prev) => {
      const next = new Set(prev);
      next.delete(id);
      writeSet(STARRED_KEY, next);
      return next;
    });
  }, []);

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
    setKnown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(KNOWN_KEY, next);
      return next;
    });
  }, []);

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
    setProgress((prev) => {
      const next = { ...prev, [listKey]: { reviewed, total } };
      writeProgress(next);
      return next;
    });
  }, []);

  const markReviewed = useCallback((listKey: string, reviewed: number, total: number) => {
    setProgress((prev) => {
      const existing = prev[listKey] ?? { reviewed: 0, total };
      const next = {
        ...prev,
        [listKey]: { reviewed: Math.max(existing.reviewed, reviewed), total },
      };
      writeProgress(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setProgress({});
    writeProgress({});
  }, []);

  return { progress, getListProgress, setListProgress, markReviewed, clear };
}
