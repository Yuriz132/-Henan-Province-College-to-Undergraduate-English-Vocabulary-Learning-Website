/**
 * 简单的管理员模式：在评论区输入口令即可进入，用于删除评论。
 * 口令仅做前端“开关”判断；真正的校验在云函数 deleteComment 内（code 必须正确才删除），
 * 因此即使绕过前端，没有正确口令云函数也不会执行删除。
 */
import { useState, useEffect } from 'react';

const KEY = 'liquid-words:admin';
const EVENT = 'liquid-words:admin-change';
export const ADMIN_CODE = '20051226';

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(v: boolean) {
  try {
    sessionStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
  // 通知所有评论组件（单词评论 + 反馈建议共用一个管理员状态）
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function tryEnableAdmin(code: string): boolean {
  if (code.trim() === ADMIN_CODE) {
    write(true);
    return true;
  }
  return false;
}

export function disableAdmin() {
  write(false);
}

/** 跨组件共享的管理员状态（sessionStorage 持久，刷新仍有效） */
export function useAdmin(): boolean {
  const [v, setV] = useState(read());
  useEffect(() => {
    const handler = () => setV(read());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return v;
}
