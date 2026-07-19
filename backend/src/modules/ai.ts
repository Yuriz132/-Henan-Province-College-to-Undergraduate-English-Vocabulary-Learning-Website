import { Router, type Request, type Response } from 'express'
import { z } from 'zod'

// ============================================
// AI 代理模块（持有 Agnes AI API Key，避免泄露到前端）
// 转发至 https://apihub.agnes-ai.com/v1 (OpenAI 兼容)
// ============================================

const AGNES_BASE = 'https://apihub.agnes-ai.com/v1'
const AGNES_API_KEY = process.env.AGNES_API_KEY || ''

export const aiRouter: Router = Router()

/** 通用 chat：POST /ai/chat */
const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(20000),
    })
  ).min(1).max(20),
  model: z.string().optional(),
  max_tokens: z.number().int().min(1).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
})

aiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  if (!AGNES_API_KEY) {
    return res.status(503).json({ message: 'AI 服务未配置（AGNES_API_KEY 缺失）' })
  }
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { messages, model, max_tokens, temperature } = parsed.data
  try {
    const r = await fetch(`${AGNES_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGNES_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'agnes-1.5-flash',
        messages,
        max_tokens: max_tokens || 500,
        temperature: temperature ?? 0.7,
      }),
    })
    if (!r.ok) {
      const txt = await r.text()
      return res.status(502).json({ message: `AI 服务错误：${r.status}`, detail: txt.slice(0, 300) })
    }
    const data: any = await r.json()
    const content: string = data?.choices?.[0]?.message?.content || ''
    const usedModel: string = data?.model || model || 'agnes-1.5-flash'
    return res.json({ content, model: usedModel })
  } catch (e: any) {
    return res.status(500).json({ message: 'AI 调用失败：' + (e?.message || String(e)) })
  }
})

/** 图片识别：POST /ai/vision/extract-words */
const visionSchema = z.object({
  image: z.string().min(50, '图片数据为空'), // base64 data URL
  hint: z.string().max(200).optional(),
})

aiRouter.post('/ai/vision/extract-words', async (req: Request, res: Response) => {
  if (!AGNES_API_KEY) {
    return res.status(503).json({ message: 'AI 服务未配置（AGNES_API_KEY 缺失）' })
  }
  const parsed = visionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { image, hint } = parsed.data
  const sys = `你是一位英语单词整理助手。用户的图片中可能有：
1. 英文单词表（每行一个/多个英文单词，可能带音标和中文）
2. 英文文章、笔记或短句

任务：
- 提取图中所有英文单词
- 如果原图没有中文释义，**为每个英文单词补充准确、简洁的中文释义（1-2 词）**
- 如果原图只有短语或文章片段，**抽取其中可作为学习单元的关键词**并补充中文
- 按 JSON 数组格式返回：[{"word":"apple","phonetic":"/ˈæpl/","meaning":"苹果"}, ...]
- 严格返回 JSON 数组，不要包含其他说明文字
- 如图片中确实没有任何英文内容，返回空数组 []`

  const user = hint
    ? `请识别并整理图片中的英文单词。附加说明：${hint}`
    : '请识别并整理图片中的英文单词。'
  try {
    const r = await fetch(`${AGNES_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGNES_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: [
              { type: 'text', text: user },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    })
    if (!r.ok) {
      const txt = await r.text()
      return res.status(502).json({ message: `AI 视觉服务错误：${r.status}`, detail: txt.slice(0, 300) })
    }
    const data: any = await r.json()
    const content: string = data?.choices?.[0]?.message?.content || '[]'
    // 解析 JSON 数组（容忍模型在前后加的杂文本）
    const arr = parseWordsJson(content)
    return res.json({ words: arr.words, raw: content, ...(arr.notes ? { notes: arr.notes } : {}) })
  } catch (e: any) {
    return res.status(500).json({ message: 'AI 视觉调用失败：' + (e?.message || String(e)) })
  }
})

/** 容错地从模型输出中提取单词 JSON 数组 */
function parseWordsJson(text: string): { words: Array<{ word: string; phonetic?: string; meaning: string }>; notes?: string } {
  if (!text) return { words: [] }
  // 1) 找到第一个 [ 开头，最后一个 ] 结尾
  const s = text.indexOf('[')
  const e = text.lastIndexOf(']')
  if (s >= 0 && e > s) {
    const slice = text.slice(s, e + 1)
    try {
      const arr = JSON.parse(slice)
      if (Array.isArray(arr)) {
        const words = arr
          .map((x: any) => ({
            word: String(x?.word ?? x?.term ?? '').trim(),
            phonetic: x?.phonetic || x?.ipa || undefined,
            meaning: String(x?.meaning ?? x?.translation ?? x?.cn ?? '').trim(),
          }))
          .filter((w: any) => w.word && w.meaning)
        return { words }
      }
    } catch {}
  }
  // 2) 行式解析：每行形如 word | phonetic | meaning
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const words: Array<{ word: string; phonetic?: string; meaning: string }> = []
  for (const ln of lines) {
    const m = ln.match(/^([A-Za-z][A-Za-z\s\-']+)(?:\s*[\/|]\s*([^|]+?))?\s*[\-|]\s*(.+)$/)
    if (m) {
      const w = m[1].trim()
      const p = m[2]?.trim()
      const cn = m[3].trim()
      if (w && cn) words.push({ word: w, phonetic: p, meaning: cn })
    }
  }
  return { words, notes: '模型未返回标准 JSON，已尝试行式解析' }
}
