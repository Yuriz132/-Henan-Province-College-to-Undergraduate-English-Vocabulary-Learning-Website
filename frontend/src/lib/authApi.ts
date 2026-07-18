import apiClient from './api-client';
import type { StudyPlan } from '@/lib/studyPlans';

export interface CloudProgress {
  starred?: number[]
  known?: number[]
  progress?: Record<string, { reviewed: number; total: number }>
  plans?: StudyPlan[]
}

export interface AuthResult {
  username: string
  token: string
}

export async function apiLogin(username: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', { username, password })
  return data
}

export async function apiRegister(username: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/register', { username, password })
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
