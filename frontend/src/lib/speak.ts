import { callTTS } from '@/lib/cloudbase';

/**
 * 发音工具：优先 Web Speech API（speechSynthesis），并用国内可访问的
 * 音频 TTS 作兜底，确保小米 / OPPO / 华为等自带浏览器也能发声。
 *
 * 设计要点：
 *  - 必须在「用户手势」内同步触发（点击/触摸回调里调用 speakWord/speakChinese），否则会被自动播放策略拦截。
 *  - 小米/OPPO/华为自带浏览器通常没有英文 TTS 引擎，speechSynthesis 即便存在也出不了声，
 *    因此：若无语音包 → 直接用音频兜底；若有语音包但超时未真正开始发音（静默失败）→ 自动切音频兜底。
 *  - 英文兜底用有道 TTS（type=2，国内可访问）；中文兜底用百度翻译 TTS（有道对中文返回 500，不可用）。
 *  - 音频用 <audio> 在用户手势里播放，规避自动播放限制。
 *  - 首次手势解锁 iOS 的音频会话。
 *
 * 中文发音策略（重点）：
 *  - 不依赖 hasChineseVoice() 检查 — 很多浏览器实际有中文语音但加载有延迟，直接尝试 speak。
 *  - 清理中文文本中的词性前缀（n. v. adj. 等）和标点，只朗读纯中文释义。
 *  - 多重重试：第一次超时 → 重新加载语音列表再试一次 → 仍失败则切百度翻译音频兜底。
 */

let voices: SpeechSynthesisVoice[] = [];
let unlocked = false;
let voiceLoadAttempted = false;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices() || [];
    if (existing.length > 0) {
      voices = existing;
      resolve(existing);
      return;
    }
    // 等待 voiceschanged 事件
    let resolved = false;
    const handler = () => {
      if (resolved) return;
      resolved = true;
      voices = window.speechSynthesis.getVoices() || [];
      resolve(voices);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // 超时兜底：1.5 秒后就算没等到也 resolve
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      voices = window.speechSynthesis.getVoices() || [];
      resolve(voices);
    }, 1500);
  });
}

/** 同步获取已缓存的语音列表 */
function getCachedVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  if (voices.length === 0 && !voiceLoadAttempted) {
    voiceLoadAttempted = true;
    voices = window.speechSynthesis.getVoices() || [];
  }
  return voices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices() || [];
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices() || [];
  };
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
  return getCachedVoices().some((v) => /^en/i.test(v.lang));
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

/**
 * 中文兜底：通过 CloudBase 云函数代理获取百度 TTS 音频。
 * 云函数返回 base64，前端解码为 Blob URL 播放。
 */
async function playCloudTTS(text: string, lang: 'zh' | 'en' = 'zh') {
  try {
    console.log('[speak] 调用 CloudBase 云函数 tts：', text, 'lang：', lang);
    const res = await callTTS(text, lang);
    if (!res.ok || !res.audioBase64) {
      throw new Error(res.error || 'empty audio');
    }
    const byteCharacters = atob(res.audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.onerror = (e) => {
      console.warn('[speak] 云函数音频对象 URL 加载失败：', e, 'error code：', audio.error?.code, 'message：', audio.error?.message);
    };
    audio.onended = () => URL.revokeObjectURL(objectUrl);
    await audio.play();
    console.log('[speak] 云函数 TTS 音频开始播放');
  } catch (err) {
    console.warn('[speak] 云函数 TTS 失败：', err, '→ 尝试直接播放百度音频');
    await playBaiduAudio(text, lang);
  }
}

/**
 * 中文兜底（备用）：直接请求百度翻译 TTS 音频。
 * 部分移动端浏览器会拦截跨域音频，故此方案仅作最后备用。
 */
async function playBaiduAudio(text: string, lang: 'zh' | 'en' = 'zh') {
  const url = `https://fanyi.baidu.com/gettts?lan=${lang}&text=${encodeURIComponent(text)}&spd=5&source=web`;

  // 方案一：fetch no-cors 取 Blob，转成本地对象 URL 播放
  try {
    console.log('[speak] 尝试 fetch-no-cors 拉取百度音频：', url);
    const res = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
    const blob = await res.blob();
    console.log('[speak] 百度音频 fetch 成功，blob size：', blob.size, 'type：', blob.type);
    if (blob.size === 0) throw new Error('blob empty');
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.onerror = (e) => {
      console.warn('[speak] 本地对象 URL 音频加载失败：', e, 'error code：', audio.error?.code, 'message：', audio.error?.message);
    };
    audio.onended = () => {
      URL.revokeObjectURL(objectUrl);
    };
    await audio.play();
    console.log('[speak] 本地对象 URL 百度音频开始播放');
    return;
  } catch (err) {
    console.warn('[speak] fetch-no-cors 百度音频失败：', err, '→ 尝试直接播放');
  }

  // 方案二：直接 <audio> 播放原 URL
  try {
    const audio = new Audio(url);
    audio.onerror = (e) => {
      console.warn('[speak] 直接百度音频加载失败：', e, 'error code：', audio.error?.code, 'message：', audio.error?.message);
    };
    await audio.play();
    console.log('[speak] 直接百度音频开始播放');
  } catch (err) {
    console.warn('[speak] 直接百度音频播放失败：', err);
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
  getCachedVoices();
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

/**
 * 清理中文释义文本：去掉词性前缀（n. v. adj. 等）、标点符号，只保留中文内容。
 * 例如 "n. 苹果；一种水果" → "苹果 一种水果"
 */
function cleanChineseText(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // 去掉开头的词性标注：n. v. adj. adv. prep. conj. pron. vt. vi. num. art. int.abbr. 等
  cleaned = cleaned.replace(/^[\s]*([a-zA-Z]{1,6}\.)\s*/g, '');
  // 去掉中间的词性标注（如 "n. 苹果 v. 喜欢" 中间也会出现）
  cleaned = cleaned.replace(/\s+[a-zA-Z]{1,6}\.\s*/g, ' ');
  // 中文分号、英文分号换成空格
  cleaned = cleaned.replace(/[；;]/g, ' ');
  // 去掉多余的空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // 百度 TTS 对超长文本可能失败，截断到合理长度
  if (cleaned.length > 60) cleaned = cleaned.slice(0, 60);
  return cleaned;
}

function buildChineseUtterance(text: string): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.85;
  utter.volume = 1;
  utter.pitch = 1;
  const allVoices = getCachedVoices();
  const voice =
    allVoices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    allVoices.find((v) => /^zh/i.test(v.lang)) ||
    allVoices.find((v) => /cmn|chinese|mandarin/i.test(v.name));
  if (voice) {
    utter.voice = voice;
    console.log('[speak] 选中中文语音：', voice.name, voice.lang);
  } else {
    console.log('[speak] 未找到专用中文语音，使用默认');
  }
  return utter;
}

/**
 * 尝试用 speechSynthesis 朗读中文，带超时保护。
 * 返回 Promise<boolean>：true 表示已开始发音，false 表示失败。
 */
function trySpeakChinese(text: string, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    let started = false;
    const utter = buildChineseUtterance(text);
    const guard = window.setTimeout(() => {
      if (!started) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
        resolve(false);
      }
    }, timeoutMs);

    utter.onstart = () => {
      started = true;
      clearTimeout(guard);
      console.log('[speak] 中文朗读开始：', text);
      resolve(true);
    };
    utter.onerror = (e) => {
      clearTimeout(guard);
      console.warn('[speak] 中文 speechSynthesis 出错：', e.error || e);
      resolve(false);
    };
    utter.onend = () => {
      clearTimeout(guard);
    };

    try {
      window.speechSynthesis.cancel();
      // 给 cancel 一点时间生效
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utter);
        } catch (err) {
          clearTimeout(guard);
          console.warn('[speak] 中文 speechSynthesis.speak 抛出异常：', err);
          resolve(false);
        }
      }, 50);
    } catch (err) {
      clearTimeout(guard);
      console.warn('[speak] 中文 speechSynthesis 初始化异常：', err);
      resolve(false);
    }
  });
}

/**
 * 朗读中文文本。
 * 策略：
 *  1. 清理文本（去掉词性前缀）
 *  2. 尝试 speechSynthesis 一次（1500ms 超时），避免多次 cancel 导致 interrupted
 *  3. 若失败，用百度翻译 TTS 音频兜底（有道中文返回 500，不可用）
 */
export async function speakChinese(rawText: string) {
  if (typeof window === 'undefined') return;
  const text = cleanChineseText(rawText);
  if (!text) {
    console.warn('[speak] 中文释义为空，无法朗读');
    return;
  }

  console.log('[speak] 准备朗读中文：', rawText, '→ 清理后：', text);

  // 尝试浏览器内置语音一次
  await loadVoices();
  const ok = await trySpeakChinese(text, 1500);
  if (ok) return;

  // 兜底：通过 CloudBase 云函数代理获取百度 TTS 音频
  console.warn('[speak] 浏览器中文语音不可用，改用 CloudBase 云函数 TTS 兜底：', text);
  await playCloudTTS(text, 'zh');
}

/** 是否有可用的中文语音引擎 */
export function chineseVoiceAvailable(): boolean {
  return getCachedVoices().some((v) => /^zh/i.test(v.lang));
}

// 初始化时加载语音
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices() || [];
}
