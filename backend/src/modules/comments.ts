import { Router, type Request, type Response } from 'express'
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { authMiddleware, adminMiddleware, loadUsers } from './auth'

// ============================================
// 违禁词过滤（同步实现，无异步初始化竞态问题）
// 作为「第一道硬拦截」：命中直接拒绝发表。
// ============================================
const FORBIDDEN_WORDS = [
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'dick', 'piss', 'cock',
  '操', '草', '傻逼', '尼玛', '妈的', '你妈', '死妈', '草泥马', '日你',
  '鸡巴', '狗屎', '废物', '去死', '沙比', '煞笔', '脑残', '智障',
  'sb', 'cnm', 'qnmlgb', 'qnm', 'nmb', 'rnmb', 'rnm', 'nm', '妈逼', '傻b', '2b', '二逼',
  '习近', '毛主',
]

function hasForbiddenWord(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase().replace(/[\s-_\u200b]+/g, '')
  return FORBIDDEN_WORDS.some((w) => lower.includes(w.toLowerCase()))
}

// ============================================
// AI 内容审核（复用 Agnes AI，OpenAI 兼容）
// 识别辱骂攻击、色情低俗、赌博、毒品、诈骗、政治敏感等违规内容。
// 设计原则：
//  - 未配置 AGNES_API_KEY / 调用失败 / 超时 → 返回 null（降级，不隐藏，仅依赖违禁词）
//  - 严格不阻塞发表（绝不因审核服务抖动而拒绝正常评论）
// ============================================
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1'
const AGNES_API_KEY = process.env.AGNES_API_KEY || ''
const MODERATION_MODEL = 'agnes-1.5-flash'
// Agnes 网关首调用冷启动较慢（实测 6~18s），异步审核不阻塞发表，
// 故把超时放宽到 30s，避免请求未完成就被 AbortController 掐断导致永不隐藏。
const MODERATION_TIMEOUT = 30000

interface ModerationResult {
  violation: boolean
  category?: string
  reason?: string
}

// 容错提取 JSON 对象（容忍模型前后杂文本）
function extractJsonObject(text: string): any | null {
  if (!text) return null
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1))
    } catch {
      /* ignore */
    }
  }
  return null
}

async function moderateComment(text: string): Promise<ModerationResult | null> {
  if (!AGNES_API_KEY) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT)
  try {
    const r = await fetch(`${AGNES_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGNES_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        temperature: 0,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              '你是中文内容安全审核员。判断用户评论是否包含违规内容：辱骂攻击、仇恨言论、色情低俗、赌博、毒品、诈骗、政治敏感等。'
              + '仅返回 JSON：{"violation": true 或 false, "category": "辱骂|色情|赌博|毒品|诈骗|政治|其他", "reason": "简短中文说明"}。'
              + '无违规返回 {"violation": false}。严格只返回 JSON，不要其他文字。',
          },
          { role: 'user', content: text },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return null
    const data: any = await r.json()
    const content: string = data?.choices?.[0]?.message?.content || ''
    const obj = extractJsonObject(content)
    if (obj && typeof obj.violation === 'boolean') {
      return {
        violation: obj.violation,
        category: typeof obj.category === 'string' ? obj.category : undefined,
        reason: typeof obj.reason === 'string' ? obj.reason : undefined,
      }
    }
    return null
  } catch {
    clearTimeout(timer)
    return null
  }
}

// 从请求头解析当前用户是否为管理员（公开接口可选鉴权，无需登录）
async function resolveIsAdmin(req: Request): Promise<boolean> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return false
  const token = header.slice('Bearer '.length).trim()
  try {
    const users = await loadUsers()
    const u = users.find((x) => x.token === token)
    return !!u && u.role === 'admin'
  } catch {
    return false
  }
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
  /** AI 判定为违规内容后自动隐藏；仅管理员可见 */
  hidden?: boolean
  /** 隐藏原因（违规类别 + 说明），仅管理员可见 */
  flagReason?: string
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

// 读取某目标下的评论
// - 普通访客/用户：仅返回未隐藏的评论
// - 管理员：返回全部（含被 AI 隐藏的），由前端区分呈现
commentsRouter.get('/comments', async (req: Request, res: Response) => {
  const wordId = Number(req.query.wordId)
  if (!Number.isInteger(wordId)) {
    return res.status(400).json({ message: '缺少有效的 wordId' })
  }
  const isAdmin = await resolveIsAdmin(req)
  const all = await loadComments()
  let list = all
    .filter((c) => c.wordId === wordId)
    .sort((a, b) => a.createdAt - b.createdAt)
  if (!isAdmin) list = list.filter((c) => !c.hidden)
  return res.json(list)
})

// 发表评论（需登录）
commentsRouter.post('/comments', authMiddleware, async (req: Request, res: Response) => {
  const parsed = postSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { wordId, text } = parsed.data
  // 第一道硬拦截：违禁词直接拒绝
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
    hidden: false,
  }
  // 先落库并返回，保证发表零延迟
  const all = await loadComments()
  all.push(comment)
  await saveComments(all)
  // 第二道 AI 软审核：异步进行，不阻塞发表；命中违规再置隐藏（仅管理员可见）
  void moderateAndHide(comment)
  return res.status(201).json(comment)
})

// 异步审核：命中违规则把该评论置为隐藏（仅管理员可见）；失败/无违规/已被处理则保持原样
async function moderateAndHide(comment: Comment): Promise<void> {
  try {
    const mod = await moderateComment(comment.text)
    if (!mod?.violation) return
    const list = await loadComments()
    const idx = list.findIndex((c) => c._id === comment._id)
    if (idx < 0 || list[idx].hidden) return // 已被隐藏/删除则不再处理
    list[idx].hidden = true
    list[idx].flagReason = [mod.category, mod.reason].filter(Boolean).join('：')
    await saveComments(list)
  } catch {
    /* 审核异常不影响已发表评论 */
  }
}

// 取消隐藏（仅管理员）：将 AI 误判或已复核的评论恢复正常
commentsRouter.patch(
  '/comments/:id/unhide',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    const id = req.params.id
    const all = await loadComments()
    const idx = all.findIndex((c) => c._id === id)
    if (idx < 0) {
      return res.status(404).json({ message: '评论不存在' })
    }
    all[idx].hidden = false
    all[idx].flagReason = undefined
    await saveComments(all)
    return res.json(all[idx])
  }
)

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
