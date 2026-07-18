import { apiClient } from './api-client';

export interface Comment {
  _id: string;
  wordId: number;
  text: string;
  author: string;
  createdAt: number;
}

/** 读取某目标下的评论（公开，按时间升序） */
export async function fetchComments(wordId: number): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>('/comments', { params: { wordId } });
  return data;
}

/** 发表一条评论（需登录，token 由 apiClient 拦截器自动附带） */
export async function addComment(wordId: number, text: string): Promise<Comment> {
  const { data } = await apiClient.post<Comment>('/comments', { wordId, text });
  return data;
}

/** 删除一条评论（仅管理员） */
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/comments/${commentId}`);
}
