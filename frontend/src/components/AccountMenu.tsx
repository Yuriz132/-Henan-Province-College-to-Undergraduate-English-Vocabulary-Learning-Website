import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, UploadCloud, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function AccountMenu() {
  const { user, isAuthed, logout, importLocalToCloud } = useAuth()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const onImport = async () => {
    if (busy) return
    setBusy(true)
    setMsg('导入中…')
    try {
      await importLocalToCloud()
      setMsg('已导入到云端')
    } catch {
      setMsg('导入失败，请重试')
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 1800)
    }
  }

  if (!isAuthed) {
    return (
      <a
        href="/login"
        onClick={(e) => {
          e.preventDefault()
          navigate('/login')
        }}
        className="relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">登录</span>
      </a>
    )
  }

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm nav-item-active transition-colors"
      >
        <User className="h-4 w-4" />
        <span className="hidden max-w-[8rem] truncate sm:inline">{user}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-white/10 bg-[oklch(0.2_0.03_270/0.94)] p-2 shadow-2xl backdrop-blur-xl">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            已登录：<span className="text-foreground">{user}</span>
          </div>
          <button
            type="button"
            onClick={onImport}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4 text-primary" />
            导入本地进度到云端
          </button>
          {msg && (
            <div className="flex items-center gap-1 px-3 py-1 text-xs text-primary">
              <Check className="h-3 w-3" />
              {msg}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
