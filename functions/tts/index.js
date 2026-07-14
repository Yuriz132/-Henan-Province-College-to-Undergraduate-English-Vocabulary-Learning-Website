/**
 * 云函数（HTTP 类型）：TTS 音频代理
 *
 * 由于移动端浏览器会拦截来自 fanyi.baidu.com 的跨域音频请求，
 * 前端改为请求同域的云函数，由云函数后端拉取百度翻译 TTS 音频，
 * 再返回给前端播放。
 *
 * 调用方式：
 *   GET  /tts?text=夏天&lang=zh
 *   POST /tts  body: { text: '夏天', lang: 'zh' }
 */
const https = require('https');
const { URL, URLSearchParams } = require('url');

function request(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          Accept: 'audio/webm,audio/ogg,audio/mpeg,audio/*,*/*',
          Referer: 'https://fanyi.baidu.com/',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ statusCode: res.statusCode, headers: res.headers, buffer });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('request timeout'));
    });
  });
}

function getParam(event, key) {
  // callFunction 调用：参数在 event.data 里
  if (event.data && typeof event.data === 'object' && event.data[key] !== undefined) {
    return event.data[key];
  }
  // HTTP 调用：参数在 queryString 或 body 里
  const query = event.queryString || event.queryStringParameters || {};
  if (query[key]) return query[key];
  if (typeof event.body === 'string') {
    try {
      const body = JSON.parse(event.body);
      if (body[key] !== undefined) return body[key];
    } catch {
      /* ignore */
    }
  }
  if (event.body && typeof event.body === 'object') {
    return event.body[key];
  }
  return '';
}

exports.main = async (event) => {
  const text = getParam(event, 'text');
  const lang = (getParam(event, 'lang') || 'zh').toLowerCase();

  if (!text) {
    return { ok: false, error: 'missing text' };
  }

  // 百度翻译 TTS 接口（lang=zh 中文，lang=en 英文）
  const upstreamUrl = `https://fanyi.baidu.com/gettts?lan=${lang === 'en' ? 'en' : 'zh'}&text=${encodeURIComponent(text)}&spd=5&source=web`;

  try {
    const res = await request(upstreamUrl);
    if (res.statusCode !== 200) {
      return { ok: false, error: `upstream status ${res.statusCode}` };
    }
    return {
      ok: true,
      audioBase64: res.buffer.toString('base64'),
      contentType: 'audio/mpeg',
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
};
