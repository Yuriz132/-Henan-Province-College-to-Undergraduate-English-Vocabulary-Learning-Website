import apiClient from './api-client';
import type { StudyPlan } from '@/lib/studyPlans';

/** 生成的 AI 文章（存入「我的题库」） */
export interface SavedArticle {
  id: string
  title: string
  content: string
  usedWords: string[]
  target: number
  theme: string
  createdAt: number
}

export interface CloudProgress {
  starred?: number[]
  known?: number[]
  progress?: Record<string, { reviewed: number; total: number }>
  plans?: StudyPlan[]
  savedArticles?: SavedArticle[]
}

export interface AuthResult {
  username: string
  token: string
  role?: string
}

export interface MeResult {
  username: string
  role?: string
}

export async function apiLogin(username: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', { username, password })
  return data
}

export async function apiRegister(username: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/register', { username, password })
  return data
}

export async function apiGetMe(): Promise<MeResult> {
  const { data } = await apiClient.get<MeResult>('/auth/me')
  return data
}

export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<{ message: string; token: string }> {
  const { data } = await apiClient.put<{ message: string; token: string }>('/auth/password', { oldPassword, newPassword })
  return data
}

export async function apiGetProgress(): Promise<CloudProgress> {
  const { data } = await apiClient.get<CloudProgress>('/progress')
  return data
}

export async function apiSaveProgress(slice: CloudProgress): Promise<CloudProgress> {
  const { data } = await apiClient.put<CloudProgress>('/progress', slice)
  return data
}
