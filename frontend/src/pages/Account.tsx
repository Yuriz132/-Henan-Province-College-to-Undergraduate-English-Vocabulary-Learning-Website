import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogOut, Shield, AlertCircle, UploadCloud, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiChangePassword } from '@/lib/authApi';
import { FlyIn } from '@/components/MotionPrimitives';

export default function Account() {
  const { user, isAuthed, isAdmin, logout, importLocalToCloud } = useAuth();
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const handleChangePassword = async () => {
    setMsg(null);
    if (!oldPw || !newPw) {
      setMsg({ type: 'error', text: '请填写旧密码和新密码' });
      return;
    }
    setChanging(true);
    try {
      const res = await apiChangePassword(oldPw, newPw);
      localStorage.setItem('auth_token', res.token);
      setMsg({ type: 'success', text: res.message });
      setOldPw('');
      setNewPw('');
    } catch (err: any) {
      const text = err?.response?.data?.message || '修改失败，请重试';
      setMsg({ type: 'error', text });
    } finally {
      setChanging(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    setImportMsg('导入中…');
    try {
      await importLocalToCloud();
      setImportMsg('已导入到云端');
    } catch {
      setImportMsg('导入失败，请重试');
    } finally {
      setImporting(false);
      setTimeout(() => setImportMsg(''), 1800);
    }
  };

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <FlyIn>
        <div className="liquid-glass mb-6 rounded-2xl p-6">
          {/* 用户信息 */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{user}</h2>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                    <Shield className="h-3 w-3" /> 管理员
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">账号设置</p>
            </div>
          </div>

          {/* 修改密码 */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Lock className="h-4 w-4 text-primary" /> 修改密码
            </div>
            <input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              placeholder="旧密码"
              className="liquid-glass h-10 w-full rounded-xl bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="新密码（至少6位）"
              className="liquid-glass h-10 w-full rounded-xl bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50"
            />
            {msg && (
              <p className={`flex items-center gap-1 text-xs ${msg.type === 'success' ? 'text-success' : 'text-destructive'}`}>
                <AlertCircle className="h-3 w-3" />
                {msg.text}
              </p>
            )}
            <button
              onClick={handleChangePassword}
              disabled={changing}
              className="liquid-glass liquid-glass-shine w-full rounded-xl py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
            >
              {changing ? '修改中…' : '修改密码'}
            </button>
          </div>
        </div>

        {/* 导入本地进度 */}
        <button
          onClick={handleImport}
          disabled={importing}
          className="liquid-glass liquid-glass-shine mb-3 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm text-primary transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
        >
          <UploadCloud className="h-4 w-4" /> {importing ? '导入中…' : '导入本地进度到云端'}
        </button>
        {importMsg && (
          <p className="mb-3 flex items-center justify-center gap-1 text-xs text-primary">
            <Check className="h-3 w-3" /> {importMsg}
          </p>
        )}

        {/* 退出登录 */}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="liquid-glass liquid-glass-shine flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm text-destructive transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <LogOut className="h-4 w-4" /> 退出登录
        </button>
      </FlyIn>
    </div>
  );
}
