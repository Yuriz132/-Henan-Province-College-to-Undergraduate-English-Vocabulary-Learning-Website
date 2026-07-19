import { apiClient } from './api-client';

export interface Comment {
  _id: string;
  wordId: number;
  text: string;
  author: string;
  createdAt: number;
  /** AI 判定违规被自动隐藏；普通用户看不到 */
  hidden?: boolean;
  /** 隐藏原因（违规类别 + 说明），仅管理员可见 */
  flagReason?: string;
}

/** 读取某目标下的评论（公开，按时间升序；管理员可额外看到被隐藏的评论） */
export async function fetchComments(wordId: number): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>('/comments', { params: { wordId } });
  return data;
}

/** 发表一条评论（需登录，token 由 apiClient 拦截器自动附带） */
export async function addComment(wordId: number, text: string): Promise<Comment> {
  const { data } = await apiClient.post<Comment>('/comments', { wordId, text });
  return data;
}

/** 删除一条评论（作者本人或管理员） */
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/comments/${commentId}`);
}

/** 取消隐藏一条被 AI 标记的评论（仅管理员） */
export async function unhideComment(commentId: string): Promise<Comment> {
  const { data } = await apiClient.patch<Comment>(`/comments/${commentId}/unhide`);
  return data;
}
