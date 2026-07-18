import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'

// ============================================
// 账户 + 云端学习进度模块
// 存储：backend/data/users.json（JSON 文件，零外部依赖）
// 密码：scrypt 加盐哈希，绝不存明文
// ============================================

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

// ---------- 类型 ----------
interface ProgressData {
  starred: number[]
  known: number[]
  progress: Record<string, { reviewed: number; total: number }>
}

interface User {
  username: string
  salt: string
  passwordHash: string
  token: string | null
  progress: ProgressData
}

type AuthedRequest = Request & { user?: User }

const EMPTY_PROGRESS: ProgressData = { starred: [], known: [], progress: {} }

// ---------- 文件读写（带缓存，减少磁盘 IO）----------
let usersCache: User[] | null = null

async function loadUsers(): Promise<User[]> {
  if (usersCache) return usersCache
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8')
    usersCache = JSON.parse(raw) as User[]
  } catch {
    usersCache = []
  }
  return usersCache
}

async function saveUsers(users: User[]): Promise<void> {
  usersCache = users
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

// ---------- 密码哈希 ----------
function hashPassword(password: string): { salt: string; passwordHash: string } {
  const salt = randomBytes(16).toString('hex')
  const passwordHash = scryptSync(password, salt, 64).toString('hex')
  return { salt, passwordHash }
}

function verifyPassword(password: string, salt: string, passwordHash: string): boolean {
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(passwordHash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

function publicUser(u: User): { username: string; token: string } {
  return { username: u.username, token: u.token as string }
}

// ---------- 鉴权中间件 ----------
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: '未登录或登录已过期' })
    return
  }
  const token = header.slice('Bearer '.length).trim()
  loadUsers()
    .then((users) => {
      const user = users.find((u) => u.token === token)
      if (!user) {
        res.status(401).json({ message: '登录已过期，请重新登录' })
        return
      }
      ;(req as AuthedRequest).user = user
      next()
    })
    .catch(() => {
      res.status(500).json({ message: '服务器内部错误' })
    })
}

// ---------- 校验 schema ----------
const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名仅限字母、数字、下划线'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码过长'),
})

const progressSchema = z
  .object({
    starred: z.array(z.number().int()).optional(),
    known: z.array(z.number().int()).optional(),
    progress: z
      .record(z.string(), z.object({ reviewed: z.number().int(), total: z.number().int() }))
      .optional(),
  })
  .refine((d) => d.starred !== undefined || d.known !== undefined || d.progress !== undefined, {
    message: '至少提供 starred / known / progress 中的一项',
  })

export const authRouter: Router = Router()

// 注册：仅记录账号密码
authRouter.post('/auth/register', async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { username, password } = parsed.data
  const users = await loadUsers()
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ message: '该用户名已被注册' })
  }
  const { salt, passwordHash } = hashPassword(password)
  const token = generateToken()
  const user: User = {
    username,
    salt,
    passwordHash,
    token,
    progress: { ...EMPTY_PROGRESS },
  }
  users.push(user)
  await saveUsers(users)
  return res.status(201).json(publicUser(user))
})

// 登录
authRouter.post('/auth/login', async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const { username, password } = parsed.data
  const users = await loadUsers()
  const user = users.find((u) => u.username === username)
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }
  // 每次登录轮换 token
  user.token = generateToken()
  await saveUsers(users)
  return res.json(publicUser(user))
})

// 获取云端进度
authRouter.get('/progress', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user as User
  return res.json(user.progress)
})

// 保存/导入进度（按分片合并：提供的字段覆盖，未提供的保留）
authRouter.put('/progress', authMiddleware, async (req: Request, res: Response) => {
  const parsed = progressSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? '参数错误' })
  }
  const user = (req as AuthedRequest).user as User
  const incoming = parsed.data
  const next: ProgressData = {
    starred: incoming.starred ?? user.progress.starred,
    known: incoming.known ?? user.progress.known,
    progress: incoming.progress ?? user.progress.progress,
  }
  user.progress = next
  const users = await loadUsers()
  const idx = users.findIndex((u) => u.username === user.username)
  if (idx >= 0) users[idx] = user
  await saveUsers(users)
  return res.json(user.progress)
})
