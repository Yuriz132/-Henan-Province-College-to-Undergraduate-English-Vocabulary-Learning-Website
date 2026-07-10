/**
 * 本地隐藏的评论 ID（管理员在自己浏览器里“删除”的评论）。
 *
 * 说明：本项目的 CloudBase 为“体验版”环境，匿名用户无法调用云函数做真正的全局删除，
 * 因此管理员删除采用“本地隐藏”作为可靠兜底——删除后该评论在管理员本人的浏览器中不再显示。
 * 若将来环境支持云函数公开调用，cloudbase.deleteComment 会同时做真正的全局删除。
 */
import { useState, useEffect } from 'react';

const KEY = 'liquid-words:hidden-comments';
const EVENT = 'liquid-words:hidden-comments';

let cache: Set<string> | null = null;

function load(): Set<string> {
  if (!cache) {
    try {
      cache = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
    } catch {
      cache = new Set();
    }
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...load()]));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function isCommentHidden(id: string): boolean {
  return load().has(id);
}

export function hideComment(id: string): void {
  load().add(id);
  persist();
}

/** 跨组件共享的本地隐藏集合（刷新仍有效） */
export function useHiddenComments(): Set<string> {
  const [set, setSet] = useState(() => new Set(load()));
  useEffect(() => {
    const handler = () => setSet(new Set(load()));
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return set;
}

