/**
 * CloudBase 客户端封装：
 *  - 初始化 @cloudbase/js-sdk（环境 henananszb-d2gg6lb9if6c9aa6f）
 *  - 匿名登录：访客无需注册即可发表评论
 *  - 提供评论的读取 / 写入接口（comments 集合，ACL 为 READONLY：所有人可读，作者可写）
 */
import cloudbase from '@cloudbase/js-sdk';

const ENV_ID = 'hennanzsb-d2gg6lb9if6c9aa6f';

export interface Comment {
  _id?: string;
  wordId: number;
  text: string;
  author: string;
  createdAt: number;
}

let appPromise: Promise<any> | null = null;
let anonymousReady = false;

/** 获取已匿名登录的 CloudBase app 实例（单例） */
export function getCloudApp(): Promise<any> {
  if (!appPromise) {
    const app = cloudbase.init({ env: ENV_ID });
    appPromise = app
      .auth()
      .signInAnonymously()
      .then(() => {
        anonymousReady = true;
        return app;
      })
      .catch((err) => {
        // 匿名登录失败也返回 app，使读取（公开）仍能工作
        console.warn('[cloudbase] 匿名登录失败，评论将以只读模式运行：', err);
        return app;
      });
  }
  return appPromise;
}

export function isAnonymousReady() {
  return anonymousReady;
}

/** 读取某个单词的全部评论（按时间升序） */
export async function fetchComments(wordId: number): Promise<Comment[]> {
  const app = await getCloudApp();
  const db = app.database();
  const res = await db
    .collection('comments')
    .where({ wordId })
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get();
  return (res.data || []) as Comment[];
}

/** 发表一条评论（需匿名登录成功） */
export async function addComment(wordId: number, text: string): Promise<void> {
  const app = await getCloudApp();
  const db = app.database();
  await db.collection('comments').add({
    wordId,
    text,
    author: '匿名访客',
    createdAt: Date.now(),
  });
}

/** 调用云函数 TTS 代理，返回 base64 音频 */
export async function callTTS(text: string, lang: 'zh' | 'en' = 'zh'): Promise<{ ok: boolean; audioBase64?: string; error?: string }> {
  const app = await getCloudApp();
  try {
    const res = await app.callFunction({
      name: 'tts',
      data: { text, lang },
    });
    return res.result || { ok: false, error: 'empty result' };
  } catch (err) {
    console.error('[cloudbase] callFunction tts 失败：', err);
    return { ok: false, error: String(err) };
  }
}

