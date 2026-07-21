import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiLogin, apiRegister, apiGetProgress, apiSaveProgress, type CloudProgress, type SavedArticle } from '@/lib/authApi'
import { setCloudUploader } from '@/lib/progressSync'
import type { StudyPlan } from '@/lib/studyPlans'
import type { ReviewRecord } from '@/lib/reviews'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

// 与 use-storage 保持一致的三组本地键
const STARRED_KEY = 'liquid-words:starred'
const KNOWN_KEY = 'liquid-words:known'
const PROGRESS_KEY = 'liquid-words:progress'
const REVIEWS_KEY = 'liquid-words:reviews'
const PLANS_KEY = 'liquid-words:plans'
const SAVED_ARTICLES_KEY = 'liquid-words:saved-articles'

function readPlans(): StudyPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY)
    return raw ? (JSON.parse(raw) as StudyPlan[]) : []
  } catch {
    return []
  }
}
function writePlans(v: StudyPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(v))
}
/** 云端进度合并回本地：计划按 id 并集，冲突时云端优先 */
function mergePlansById(local: StudyPlan[], cloud: StudyPlan[]): StudyPlan[] {
  const map = new Map<string, StudyPlan>()
  for (const p of local) map.set(p.id, p)
  for (const p of cloud) map.set(p.id, p)
  return Array.from(map.values())
}

type ProgressMap = Record<string, { reviewed: number; total: number }>

function readArr(key: string): number[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}
function writeArr(key: string, v: number[]) {
  localStorage.setItem(key, JSON.stringify(v))
}
function readProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as ProgressMap) : {}
  } catch {
    return {}
  }
}
function writeProgress(v: ProgressMap) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(v))
}
function readSavedArticles(): SavedArticle[] {
  try {
    const raw = localStorage.getItem(SAVED_ARTICLES_KEY)
    return raw ? (JSON.parse(raw) as SavedArticle[]) : []
  } catch {
    return []
  }
}
function writeSavedArticles(v: SavedArticle[]) {
  localStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(v))
}
function readReviews(): Record<number, ReviewRecord> {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY)
    return raw ? (JSON.parse(raw) as Record<number, ReviewRecord>) : {}
  } catch {
    return {}
  }
}
function writeReviews(v: Record<number, ReviewRecord>) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(v))
}
/** 已生成文章：按 id 去重，最新在前 */
function mergeSavedArticles(local: SavedArticle[], cloud: SavedArticle[]): SavedArticle[] {
  const map = new Map<string, SavedArticle>()
  for (const a of local) map.set(a.id, a)
  for (const a of cloud) map.set(a.id, a)
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
}

/** 云端进度合并回本地：集合取并集，进度按列表取最大值（不丢数据） */
function mergeCloudIntoLocal(cloud: CloudProgress) {
  const starred = Array.from(new Set([...readArr(STARRED_KEY), ...(cloud.starred ?? [])]))
  const known = Array.from(new Set([...readArr(KNOWN_KEY), ...(cloud.known ?? [])]))
  const localP = readProgress()
  const cloudP = cloud.progress ?? {}
  const merged: ProgressMap = { ...localP }
  for (const [k, v] of Object.entries(cloudP)) {
    const cur = merged[k] ?? { reviewed: 0, total: v.total }
    merged[k] = { reviewed: Math.max(cur.reviewed, v.reviewed), total: Math.max(cur.total, v.total) }
  }
  writeArr(STARRED_KEY, starred)
  writeArr(KNOWN_KEY, known)
  writeProgress(merged)
  writePlans(mergePlansById(readPlans(), cloud.plans ?? []))
  writeSavedArticles(mergeSavedArticles(readSavedArticles(), cloud.savedArticles ?? []))
  // 复习安排：按 wordId 覆盖合并（同一词以云端为准，避免丢数据）
  writeReviews({ ...readReviews(), ...(cloud.reviews ?? {}) })
}

function localSnapshot(): CloudProgress {
  return {
    starred: readArr(STARRED_KEY),
    known: readArr(KNOWN_KEY),
    progress: readProgress(),
    plans: readPlans(),
    savedArticles: readSavedArticles(),
    reviews: readReviews(),
  }
}

interface AuthContextValue {
  user: string | null
  isAuthed: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  /** 把本地学习进度推送到云端（导入） */
  importLocalToCloud: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ADMIN_KEY = 'auth_admin'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem(USER_KEY))
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem(ADMIN_KEY) === '1')

  // 已登录则注册云端上传器（各进度 hook 改动时自动同步）
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) {
      setCloudUploader(async (slice) => {
        await apiSaveProgress(slice)
      })
      setUser(localStorage.getItem(USER_KEY))
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, res.username)
    setUser(res.username)
    const admin = res.role === 'admin'
    localStorage.setItem(ADMIN_KEY, admin ? '1' : '0')
    setIsAdmin(admin)
    setCloudUploader(async (slice) => {
      await apiSaveProgress(slice)
    })
    // 把云端进度合并回本地，再刷新让各页面重新读取
    try {
      const cloud = await apiGetProgress()
      mergeCloudIntoLocal(cloud)
    } catch {
      /* 云端不可用时直接用本地 */
    }
    window.location.href = '/'
  }

  const register = async (username: string, password: string) => {
    const res = await apiRegister(username, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, res.username)
    setUser(res.username)
    const admin = res.role === 'admin'
    localStorage.setItem(ADMIN_KEY, admin ? '1' : '0')
    setIsAdmin(admin)
    setCloudUploader(async (slice) => {
      await apiSaveProgress(slice)
    })
    try {
      const cloud = await apiGetProgress()
      mergeCloudIntoLocal(cloud)
    } catch {
      /* ignore */
    }
    window.location.href = '/'
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ADMIN_KEY)
    setCloudUploader(null)
    setUser(null)
    setIsAdmin(false)
  }

  const importLocalToCloud = async () => {
    await apiSaveProgress(localSnapshot())
  }

  return (
    <AuthContext.Provider value={{ user, isAuthed: !!user, isAdmin, login, register, logout, importLocalToCloud }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
