import { Router, type Request, type Response } from 'express'
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { authMiddleware } from './auth'

// ============================================
// 违禁词过滤（使用 DFA 开源库 sensitive-word-filter，支持中英文）
// ============================================
const wc = require('sensitive-word-filter')

function hasForbiddenWord(text: string): boolean {
  if (!text) return false
  const filtered = wc.filter(text)
  return filtered !== text
}

// ============================================
// 评论模块（仅登录用户可发表；读取公开）
// 存储：backend/data/comments.json（与 users.json 同目录，零外部依赖）
// 既用于单词的短语/近义词评论，也用于站点「反馈与建议」(wordId 取特殊值，如 -2)
// 彻底替代原先的腾讯云开发(CloudBase)评论能力，数据落到自己的阿里云后端。
// ============================================

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data')
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json')

export interface Comment {
  _id: string
  wordId: number
  text: string
  author: string
  createdAt: number
}

let commentsCache: Comment[] | null = null

async function loadComments(): Promise<Comment[]> {
  if (commentsCache) return commentsCache
  try {
    const raw = await fs.readFile(COMMENTS_FILE, 'utf-8')
    commentsCache = JSON.parse(raw) as Comment[]
  } catch {
    commentsCache = []
  }
  return commentsCache
}

async function saveComments(list: Comment[]): Promise<void> {
  commentsCache = list
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(COMMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

const postSchema = z.object({
  wordId: z.number().int(),
  text: z.string().trim().min(1, '评论内容不能为空').max(200, '评论最多 200 字'),
})

export const commentsRouter: Router = Router()

// 读取某目标下的评论（公开）
commentsRouter.get('/comments', async (req: Request, res: Response) => {
  const wordId = Number(req.query.wordId)
  if (!Number.isInteger(wordId)) {
    return res.status(400).json({ message: '缺少有效的 wordId' })
  }
  const all = await loadComments()
  const list = all
    .filter((c) => c.wordId === wordId)
    .sort((a, b) => a.createdAt - b.createdAt)
  return res.json(list)
})

// 发表评论（需登录）
commentsRouter.post('/comments', authMiddleware, async (req: Request, res: Response) => {
  const parsed = postSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { wordId, text } = parsed.data
  if (hasForbiddenWord(text)) {
    return res.status(400).json({ message: '评论内容包含违禁词汇' })
  }
  const user = (req as Request & { user?: { username: string } }).user
  const comment: Comment = {
    _id: randomBytes(8).toString('hex'),
    wordId,
    text,
    author: user?.username ?? '匿名',
    createdAt: Date.now(),
  }
  const all = await loadComments()
  all.push(comment)
  await saveComments(all)
  return res.status(201).json(comment)
})

// 删除评论（作者本人或管理员）
commentsRouter.delete('/comments/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = req.params.id
  const user = (req as Request & { user?: { username: string; role?: string } }).user
  const all = await loadComments()
  const idx = all.findIndex((c) => c._id === id)
  if (idx < 0) {
    return res.status(404).json({ message: '评论不存在' })
  }
  // 作者本人或管理员可删
  if (!user || (all[idx].author !== user.username && user.role !== 'admin')) {
    return res.status(403).json({ message: '只能删除自己的评论' })
  }
  all.splice(idx, 1)
  await saveComments(all)
  return res.json({ message: '已删除' })
})
