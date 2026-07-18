import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiLogin, apiRegister, apiGetProgress, apiSaveProgress, type CloudProgress } from '@/lib/authApi'
import { setCloudUploader } from '@/lib/progressSync'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

// 与 use-storage 保持一致的三组本地键
const STARRED_KEY = 'liquid-words:starred'
const KNOWN_KEY = 'liquid-words:known'
const PROGRESS_KEY = 'liquid-words:progress'

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
}

function localSnapshot(): CloudProgress {
  return {
    starred: readArr(STARRED_KEY),
    known: readArr(KNOWN_KEY),
    progress: readProgress(),
  }
}

interface AuthContextValue {
  user: string | null
  isAuthed: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  /** 把本地学习进度推送到云端（导入） */
  importLocalToCloud: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem(USER_KEY))

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
    setCloudUploader(null)
    setUser(null)
  }

  const importLocalToCloud = async () => {
    await apiSaveProgress(localSnapshot())
  }

  return (
    <AuthContext.Provider value={{ user, isAuthed: !!user, login, register, logout, importLocalToCloud }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
