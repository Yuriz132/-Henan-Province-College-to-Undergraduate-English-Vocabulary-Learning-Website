import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock } from 'lucide-react'
import { LiquidGlass } from '@/components/LiquidGlass'
import { ExplodeIn, FlyIn } from '@/components/MotionPrimitives'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const name = username.trim()
    if (name.length < 3) return setError('用户名至少 3 个字符（字母/数字/下划线）')
    if (password.length < 6) return setError('密码至少 6 位')
    setBusy(true)
    try {
      if (mode === 'login') await login(name, password)
      else await register(name, password)
      // login/register 内部会合并云端进度并跳转到首页
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '操作失败，请稍后重试'
      setError(msg)
      setBusy(false)
    }
  }

  const skip = () => navigate('/')

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
      <ExplodeIn initialScale={0.75}>
        <LiquidGlass
          as="div"
          className="liquid-glass card-bounce w-full p-8 text-center"
          style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
        >
          <h1 className="font-bold text-gradient" style={{ fontSize: 'var(--font-size-display)' }}>
            升本词汇
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">登录后，学习进度自动保存到云端</p>

          <div className="mt-6 flex gap-2">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm transition-all active:scale-95',
                  mode === m ? 'liquid-glass-accent text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3 text-left">
            <label className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="liquid-glass-accent liquid-glass liquid-glass-shine w-full rounded-lg py-3 font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
            </button>
          </form>

          <button
            type="button"
            onClick={skip}
            className="mt-4 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            跳过登录，仅本机保存
          </button>
        </LiquidGlass>
      </ExplodeIn>

      <FlyIn delay={0.12}>
        <p className="mt-4 px-6 text-center text-xs text-muted-foreground">
          跳过登录：学习记录仅保存在本机浏览器；登录后可跨设备同步。
        </p>
      </FlyIn>
    </div>
  )
}
