// 学习计划数据类型（前端/后端共用结构，后端以 zod 独立定义同构校验）

export type PlanType = 'chapters' | 'words' | 'custom'

export interface PlanTask {
  id: string
  text: string
  done: boolean
}

export interface StudyPlan {
  id: string
  type: PlanType
  title: string
  /** 目标值：chapters=章节数，words=单词数，custom=子任务数 */
  target: number
  /** 仅 type=custom 使用 */
  tasks?: PlanTask[]
  createdAt: number
}

export const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  chapters: '完成章节',
  words: '累计单词',
  custom: '自定义任务',
}
