import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Timer, Settings, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiquidGlass } from '@/components/LiquidGlass';

type Mode = 'focus' | 'short' | 'long';

interface PomodoroSettings {
  focus: number;
  short: number;
  long: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = { focus: 25, short: 5, long: 15 };
const STORAGE_KEY = 'liquid-words:pomodoro';

interface SavedState {
  settings: PomodoroSettings;
  completedFocus: number;
  cycleCount: number;
}

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { settings: DEFAULT_SETTINGS, completedFocus: 0, cycleCount: 0, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { settings: DEFAULT_SETTINGS, completedFocus: 0, cycleCount: 0 };
}

const MODE_LABEL: Record<Mode, string> = {
  focus: '专注',
  short: '短休息',
  long: '长休息',
};

const MODE_COLOR: Record<Mode, string> = {
  focus: 'oklch(0.65 0.18 240)',
  short: 'oklch(0.7 0.17 163)',
  long: 'oklch(0.6 0.22 340)',
};

export function PomodoroTimer() {
  const initial = useRef(loadState());
  const [settings, setSettings] = useState<PomodoroSettings>(initial.current.settings);
  const [completedFocus, setCompletedFocus] = useState(initial.current.completedFocus);
  const [cycleCount, setCycleCount] = useState(initial.current.cycleCount);

  const [mode, setMode] = useState<Mode>('focus');
  const [secondsLeft, setSecondsLeft] = useState(settings.focus * 60);
  const [running, setRunning] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef = useRef<number | null>(null);

  // 持久化
  useEffect(() => {
    const data: SavedState = { settings, completedFocus, cycleCount };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [settings, completedFocus, cycleCount]);

  // 计时器
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleCompleteRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const totalSeconds = settings[mode] * 60;

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      setSecondsLeft(settings[next] * 60);
      setRunning(true);
    },
    [settings]
  );

  const handleComplete = useCallback(() => {
    setRunning(false);
    if (mode === 'focus') {
      const nextCycle = cycleCount + 1;
      setCompletedFocus((c) => c + 1);
      setCycleCount(nextCycle);
      // 每 4 次专注后长休息
      if (nextCycle % 4 === 0) switchMode('long');
      else switchMode('short');
    } else {
      switchMode('focus');
    }
    // 提示音（可选）
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKx8ZBQAEABAAZGF0YQQAAAD//wEA/8A=');
      audio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }, [mode, cycleCount, switchMode]);

  // 始终调用最新版本的完成逻辑（自动计时下 interval 不重建，避免闭包过期）
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  const toggle = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(totalSeconds);
  };

  const skip = () => {
    setRunning(false);
    if (mode === 'focus') {
      const nextCycle = cycleCount + 1;
      setCycleCount(nextCycle);
      if (nextCycle % 4 === 0) switchMode('long');
      else switchMode('short');
    } else {
      switchMode('focus');
    }
  };

  const updateSetting = (key: keyof PomodoroSettings, value: number) => {
    const v = Math.max(1, Math.min(120, value));
    setSettings((s) => ({ ...s, [key]: v }));
    if (mode === key && !running) setSecondsLeft(v * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const color = MODE_COLOR[mode];
  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* 展开面板：外壳折射玻璃 + 内部毛玻璃文字层（兄弟并列，避免嵌套 backdrop-filter 失效） */}
      {expanded && (
        <div className="relative mb-3 w-72">
          {/* 折射玻璃外壳：仅边框/底色，纯液态玻璃折射（无模糊） */}
          <LiquidGlass as="div" className="liquid-glass absolute inset-0" style={{ borderRadius: 'calc(var(--radius) + 8px)' }} />
          {/* 文字内容区：独立毛玻璃模糊层（与外壳为兄弟非子级，可真实模糊） */}
          <div className="pomo-frost relative p-4">
          {!showSettings ? (
            <>
              {/* 模式切换 */}
              <div className="mb-3 flex gap-1.5">
                {(['focus', 'short', 'long'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-xs transition-all active:scale-95',
                      mode === m ? 'liquid-glass-accent text-primary' : 'text-muted-foreground hover:bg-white/5'
                    )}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>

              {/* 圆环进度 */}
              <div className="relative mx-auto mb-3 flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    fill="none"
                    stroke="oklch(1 0 0 / 0.1)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-3xl font-bold text-foreground">{mm}:{ss}</span>
                  <span className="text-xs" style={{ color }}>{MODE_LABEL[mode]}</span>
                </div>
              </div>

              {/* 控制按钮 */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={toggle}
                  className="liquid-glass liquid-glass-shine flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-all hover:-translate-y-0.5 active:scale-90"
                  aria-label={running ? '暂停' : '开始'}
                >
                  {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button
                  onClick={reset}
                  className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-90"
                  aria-label="重置"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={skip}
                  className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-90"
                  aria-label="跳过"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="liquid-glass flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-90"
                  aria-label="设置"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              {/* 统计 */}
              <div className="mt-3 text-center text-xs text-muted-foreground">
                已完成专注 <span className="font-semibold text-foreground">{completedFocus}</span> 次
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">时长设置</span>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="返回"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {(['focus', 'short', 'long'] as Mode[]).map((m) => (
                <div key={m} className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{MODE_LABEL[m]}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSetting(m, settings[m] - 1)}
                      className="liquid-glass h-8 w-8 rounded-full text-foreground transition-all active:scale-90"
                    >
                      −
                    </button>
                    <span className="w-12 text-center font-mono text-foreground">{settings[m]} 分</span>
                    <button
                      onClick={() => updateSetting(m, settings[m] + 1)}
                      className="liquid-glass h-8 w-8 rounded-full text-foreground transition-all active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowSettings(false)}
                className="liquid-glass-accent liquid-glass mt-1 w-full rounded-lg py-2 text-sm text-primary transition-all active:scale-95"
              >
                完成
              </button>
            </>
          )}
          </div>
        </div>
      )}

      {/* 悬浮触发按钮 */}
      <LiquidGlass
        as="button"
        onClick={() => setExpanded((e) => !e)}
        className="liquid-glass liquid-glass-shine flex items-center gap-2 rounded-full px-4 py-3 text-muted-foreground transition-all hover:text-foreground active:scale-95"
        style={{ borderRadius: 'calc(var(--radius) + 12px)' }}
        aria-label="番茄钟"
      >
        <Timer className="h-5 w-5" style={{ color }} />
        <span className="font-mono text-sm text-foreground">{mm}:{ss}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </LiquidGlass>
    </div>
  );
}
