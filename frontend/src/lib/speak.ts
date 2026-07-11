/**
 * 发音工具：优先 Web Speech API（speechSynthesis），并用国内可访问的
 * 有道 TTS 音频作兜底，确保小米 / OPPO / 华为等自带浏览器也能发声。
 *
 * 设计要点：
 *  - 必须在「用户手势」内同步触发（点击/触摸回调里调用 speakWord/speakChinese），否则会被自动播放策略拦截。
 *  - 小米/OPPO/华为自带浏览器通常没有英文 TTS 引擎，speechSynthesis 即便存在也出不了声，
 *    因此：若无语音包 → 直接用有道音频；若有语音包但 800ms 内未真正开始发音（静默失败）→ 自动切音频兜底。
 *  - 有道音频用 <audio> 在用户手势里播放，规避自动播放限制，且国内可访问。
 *  - 首次手势解锁 iOS 的音频会话。
 */

let voices: SpeechSynthesisVoice[] = [];
let unlocked = false;

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices() || [];
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
  // 首次用户手势解锁 iOS 的音频会话（仅执行一次）
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function hasEnglishVoice(): boolean {
  return voices.some((v) => /^en/i.test(v.lang));
}

function hasChineseVoice(): boolean {
  return voices.some((v) => /^zh/i.test(v.lang));
}

/** 英文兜底：用有道 TTS 音频播放（国内可访问，type=2 为英文） */
function playYoudaoAudio(text: string) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.warn('[speak] 有道音频播放失败：', err);
    });
  } catch (err) {
    console.warn('[speak] 有道音频创建失败：', err);
  }
}

function buildEnglishUtterance(text: string): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.9;
  utter.volume = 1;
  utter.pitch = 1;
  const voice = voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
  if (voice) utter.voice = voice;
  return utter;
}

/**
 * 朗读单词。务必在用户点击/触摸的回调里调用。
 * 策略：有英文语音 → 用 speechSynthesis，并带「未开始发音则切音频兜底」的保护；
 *       无英文语音/不支持 → 直接用有道音频。
 */
export function speakWord(text: string) {
  if (typeof window === 'undefined') return;
  loadVoices();
  const synthOk = 'speechSynthesis' in window;

  if (synthOk && hasEnglishVoice()) {
    let fellBack = false;
    const utter = buildEnglishUtterance(text);
    const guard = window.setTimeout(() => {
      if (!fellBack) {
        fellBack = true;
        console.warn('[speak] 英文 speechSynthesis 未在限定时间内发声，切换有道音频');
        playYoudaoAudio(text);
      }
    }, 800);
    utter.onstart = () => {
      clearTimeout(guard);
      console.log('[speak] 开始英文朗读（speechSynthesis）：', text);
    };
    utter.onend = () => clearTimeout(guard);
    utter.onerror = (e) => {
      clearTimeout(guard);
      if (!fellBack) {
        fellBack = true;
        console.warn('[speak] 英文 speechSynthesis 出错：', e.error || e, '→ 切换有道音频');
        playYoudaoAudio(text);
      }
    };
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (err) {
      clearTimeout(guard);
      console.warn('[speak] 英文 speechSynthesis 抛出异常：', err, '→ 切换有道音频');
      playYoudaoAudio(text);
    }
  } else {
    console.log('[speak] 无英文语音包，使用有道音频：', text);
    playYoudaoAudio(text);
  }
}

/** 中文兜底：用有道 TTS 音频播放中文（不加 type，让其自动识别语言） */
function playYoudaoChineseAudio(text: string) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}`;
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.warn('[speak] 有道中文音频播放失败：', err);
    });
  } catch (err) {
    console.warn('[speak] 有道中文音频创建失败：', err);
  }
}

function buildChineseUtterance(text: string): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.9;
  utter.volume = 1;
  utter.pitch = 1;
  const voice =
    voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang));
  if (voice) utter.voice = voice;
  return utter;
}

/**
 * 朗读中文文本。策略与英文一致：优先 speechSynthesis，若 800ms 内未真正发声或出错，
 * 自动切到有道中文音频兜底，确保小米/OPPO/华为自带浏览器也能听到中文释义。
 */
export function speakChinese(text: string) {
  if (typeof window === 'undefined') return;
  loadVoices();
  const synthOk = 'speechSynthesis' in window;

  if (synthOk && hasChineseVoice()) {
    let fellBack = false;
    const utter = buildChineseUtterance(text);
    const guard = window.setTimeout(() => {
      if (!fellBack) {
        fellBack = true;
        console.warn('[speak] 中文 speechSynthesis 未在限定时间内发声，切换有道音频');
        playYoudaoChineseAudio(text);
      }
    }, 800);
    utter.onstart = () => {
      clearTimeout(guard);
      console.log('[speak] 开始中文朗读（speechSynthesis）：', text);
    };
    utter.onend = () => clearTimeout(guard);
    utter.onerror = (e) => {
      clearTimeout(guard);
      if (!fellBack) {
        fellBack = true;
        console.warn('[speak] 中文 speechSynthesis 出错：', e.error || e, '→ 切换有道音频');
        playYoudaoChineseAudio(text);
      }
    };
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (err) {
      clearTimeout(guard);
      console.warn('[speak] 中文 speechSynthesis 抛出异常：', err, '→ 切换有道音频');
      playYoudaoChineseAudio(text);
    }
  } else {
    console.log('[speak] 无中文语音包，使用有道中文音频：', text);
    playYoudaoChineseAudio(text);
  }
}

/** 是否有可用的中文语音引擎 */
export function chineseVoiceAvailable(): boolean {
  return hasChineseVoice();
}
