import apiClient from './api-client';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** 通用聊天/文本生成（走后端代理，自动带登录 token） */
export async function aiChat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const { data } = await apiClient.post<{ content: string; model: string }>('/ai/chat', {
    messages,
    model: opts.model,
    max_tokens: opts.max_tokens,
    temperature: opts.temperature,
  });
  return data.content || '';
}

/** 视觉识别：从图片中识别英文单词，并自动补充中文释义，返回结构化单词列表 */
export interface ExtractedWord {
  word: string;
  phonetic?: string;
  meaning: string;
}

export async function aiExtractWordsFromImage(opts: {
  imageDataUrl: string;
  hint?: string;
  signal?: AbortSignal;
}): Promise<{ words: ExtractedWord[]; raw?: string }> {
  const { data } = await apiClient.post<{ words: ExtractedWord[]; raw?: string }>(
    '/ai/vision/extract-words',
    { image: opts.imageDataUrl, hint: opts.hint }
  );
  return data;
}

/** 个人学习总结 */
export async function aiPersonalSummary(stats: {
  totalWords: number;
  totalReviewed: number;
  knownCount: number;
  starredCount: number;
  streak: number;
  dailyAverage: number;
  topPart?: string;
}): Promise<string> {
  return aiChat(
    [
      {
        role: 'system',
        content:
          '你是一位经验丰富的专升本英语教师。基于用户的真实学习数据，输出100-200字、有温度、可执行的中文学习建议。直接给出建议正文，不要列点、不要使用 markdown 标题或项目符号。',
      },
      {
        role: 'user',
        content: JSON.stringify(stats),
      },
    ],
    { max_tokens: 500, temperature: 0.8 }
  );
}

/** 用已学单词生成英语文章（可指定词数） */
export async function aiGenerateArticle(opts: {
  learnedWords: string[];
  targetWords: number; // 目标文章总词数
  title?: string;
}): Promise<{ title: string; content: string; usedWords: string[] }> {
  const sys = `你是一位英语写作老师。根据用户提供的已学单词列表，写一篇${opts.targetWords}词左右的英语短文。要求：
1. 尽量多地使用已学单词（至少 60% 覆盖率）
2. 用词难度适合专升本水平
3. 内容积极向上
4. 输出 JSON 格式：{"title": "英文标题", "content": "英文正文", "usedWords": ["已用单词数组"]}
仅返回 JSON，不要加任何解释。`;
  const user = `已学单词（${opts.learnedWords.length}个）：${opts.learnedWords.join(', ')}。${opts.title ? `主题：${opts.title}` : ''}`;
  const text = await aiChat(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { model: 'agnes-2.0-flash', max_tokens: 2500, temperature: 0.85 }
  );
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: opts.title || 'Article', content: text, usedWords: [] };
    return parsed;
  } catch {
    return { title: opts.title || 'Article', content: text, usedWords: [] };
  }
}
