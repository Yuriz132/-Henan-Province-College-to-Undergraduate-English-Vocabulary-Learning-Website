import apiClient from './api-client';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** 流式输出：提供 onChunk 回调则启用，每块文本增量 */
  onChunk?: (text: string) => void;
}

/** 通用聊天/文本生成（支持流式，走后端代理） */
export async function aiChat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  // 流式模式
  if (opts.onChunk) {
    const token = localStorage.getItem('auth_token');
    const r = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        messages,
        model: opts.model,
        max_tokens: opts.max_tokens,
        temperature: opts.temperature,
        stream: true,
      }),
      signal: opts.signal,
    });
    if (!r.ok) throw new Error(`AI ${r.status}`);
    const reader = r.body?.getReader();
    if (!reader) throw new Error('No stream');
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      // Agnes AI 返回 SSE: data: {...}\n\n
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const delta: any = JSON.parse(payload);
          const chunk = delta?.choices?.[0]?.delta?.content || '';
          if (chunk) { full += chunk; opts.onChunk!(chunk); }
        } catch {}
      }
    }
    return full;
  }

  // 非流式
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
/** 解析单词详情：专升本考试风格，含中文释义+例句+形近词+短语+时态 */
export interface WordAIDetail {
  /** 中文精炼释义（6-12 字） */
  cnMeaning: string;
  /** 英文简短释义（10 词以内） */
  enDef: string;
  /** 专升本难度例句 + 中文翻译 */
  example: string;
  /** 形近词 + 中文（河南专升本常考） */
  similarWords: { word: string; cn: string }[];
  /** 常用短语 + 中文 */
  phrases: { en: string; cn: string }[];
  /** 时态/词形变化（不规则动词才填） */
  tenses: string[];
}

const EMPTY_DETAIL: WordAIDetail = {
  cnMeaning: '',
  enDef: '',
  example: '',
  similarWords: [],
  phrases: [],
  tenses: [],
};

export async function aiExplainWord(word: string, meaning: string): Promise<WordAIDetail> {
  const sys = `你是一位经验丰富的河南专升本英语老师。请分析单词，**严格**输出 JSON，**不要包含 JSON 之外的任何文字**。

字段要求：
- cnMeaning：中文精炼释义，6-12 字（如"成年男性"），必须是中文
- enDef：英文简短释义，10 词以内
- example：一个专升本难度的英文例句，附中文翻译，格式 "英文。/ 中文。"
- similarWords：3-5 个形近词（视觉相似），每个必须带中文含义，格式 [{"word":"woman","cn":"女人"}]
- phrases：3-5 个常用短语/固定搭配，每个必须带中文翻译
- tenses：如果是不规则动词，列出过去式/过去分词/现在分词；规则变化或名词则填空数组 []

输出示例（仅作格式参考，含义要针对输入单词）：
{
  "cnMeaning": "成年男人",
  "enDef": "an adult male human",
  "example": "A man is waiting at the door. / 一个男人在门口等着。",
  "similarWords": [{"word":"woman","cn":"女人"},{"word":"many","cn":"许多"}],
  "phrases": [{"en":"a young man","cn":"年轻人"}],
  "tenses": []
}`;
  const text = await aiChat([
    { role: 'system', content: sys },
    { role: 'user', content: `单词：${word}\n中文释义参考：${meaning || '无'}\n请输出 JSON。` }
  ], { model: 'agnes-1.5-flash', max_tokens: 800, temperature: 0.3 });
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return EMPTY_DETAIL;
    const obj = JSON.parse(m[0]);
    return {
      cnMeaning: String(obj.cnMeaning || '').trim(),
      enDef: String(obj.enDef || '').trim(),
      example: String(obj.example || '').trim(),
      similarWords: Array.isArray(obj.similarWords)
        ? obj.similarWords.map((x: any) => ({ word: String(x?.word || '').trim(), cn: String(x?.cn || '').trim() })).filter((x: any) => x.word)
        : [],
      phrases: Array.isArray(obj.phrases)
        ? obj.phrases.map((x: any) => ({ en: String(x?.en || '').trim(), cn: String(x?.cn || '').trim() })).filter((x: any) => x.en)
        : [],
      tenses: Array.isArray(obj.tenses) ? obj.tenses.map((x: any) => String(x).trim()).filter(Boolean) : [],
    };
  } catch {
    return EMPTY_DETAIL;
  }
}
