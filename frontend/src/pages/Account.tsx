import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogOut, Shield, AlertCircle, UploadCloud, Check, Image as ImageIcon, X, Palette } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiChangePassword } from '@/lib/authApi';
import { FlyIn } from '@/components/MotionPrimitives';
import { Leaderboard } from '@/components/Leaderboard';

const WP_KEY = 'liquid-words:wallpaper';

/** 压缩壁纸到合理大小（最长边 1920，JPEG 0.75） */
async function compressWallpaper(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1920;
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round((height * max) / width); width = max; }
        else { width = Math.round((width * max) / height); height = max; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL('image/jpeg', 0.75)); } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function applyWallpaper(url: string) {
  if (url) {
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    document.body.style.backgroundRepeat = '';
  }
}

export default function Account() {
  const { user, isAuthed, isAdmin, logout, importLocalToCloud } = useAuth();
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  // 壁纸
  const [wp, setWp] = useState<string>('');
  const wpFileRef = useRef<HTMLInputElement>(null);
  // 字体颜色
  const FC_KEY = 'liquid-words:fontColor';
  const [fontColor, setFontColor] = useState<string>(() => localStorage.getItem(FC_KEY) || '#ffffff');

  // 挂载时恢复壁纸和字体颜色
  useEffect(() => {
    const saved = localStorage.getItem(WP_KEY) || '';
    setWp(saved);
    applyWallpaper(saved);
    // 字体颜色
    const fc = localStorage.getItem(FC_KEY) || '#ffffff';
    document.documentElement.style.setProperty('--user-font-color', fc);
  }, []);

  const handleFontColor = (color: string) => {
    setFontColor(color);
    document.documentElement.style.setProperty('--user-font-color', color);
    localStorage.setItem(FC_KEY, color);
  };

  const handleWpFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('壁纸文件不能超过 8MB'); return; }
    const data = await compressWallpaper(file);
    setWp(data);
    applyWallpaper(data);
    try { localStorage.setItem(WP_KEY, data); } catch { /* localStorage 满 */ }
  };

  const removeWallpaper = () => {
    setWp('');
    applyWallpaper('');
    try { localStorage.removeItem(WP_KEY); } catch {}
    if (wpFileRef.current) wpFileRef.current.value = '';
  };

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
        <div className="mb-4">
          <Leaderboard />
        </div>
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

        {/* 自定义壁纸 */}
        <div className="liquid-glass mb-3 rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <ImageIcon className="h-4 w-4 text-primary" /> 自定义壁纸
            <span className="text-xs font-normal text-muted-foreground/70">背景图会覆盖全站（cover 适应）</span>
          </div>
          {wp ? (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-lg border border-white/10">
                <img src={wp} alt="壁纸预览" className="h-28 w-full object-cover" />
                <button
                  onClick={removeWallpaper}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-black/80"
                  aria-label="移除壁纸"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => wpFileRef.current?.click()}
                className="liquid-glass liquid-glass-shine flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs text-muted-foreground transition-all hover:text-foreground active:scale-95"
              >
                <UploadCloud className="h-3.5 w-3.5" /> 更换壁纸
              </button>
            </div>
          ) : (
            <button
              onClick={() => wpFileRef.current?.click()}
              className="liquid-glass liquid-glass-shine flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs text-primary transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <UploadCloud className="h-3.5 w-3.5" /> 上传图片作为壁纸
            </button>
          )}
          <input
            ref={wpFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleWpFile(e.target.files[0])}
          />
        </div>

        {/* 字体颜色 */}
        <div className="liquid-glass mb-3 rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Palette className="h-4 w-4 text-primary" /> 字体颜色
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={fontColor}
              onChange={(e) => handleFontColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-lg border border-white/10 bg-white/5"
            />
            <span className="text-xs text-muted-foreground">{fontColor}</span>
            <button
              onClick={() => handleFontColor('#ffffff')}
              className="rounded-full bg-white/10 px-3 py-1 text-xs text-muted-foreground hover:bg-white/20"
            >
              恢复默认
            </button>
          </div>
        </div>

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
