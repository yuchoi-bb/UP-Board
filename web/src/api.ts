import { auth } from './firebase';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const idToken = await auth.currentUser?.getIdToken();
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? 'unknown',
      data?.error?.message ?? `요청에 실패했습니다 (${response.status}).`,
    );
  }
  return data as T;
}

/** 사용자에게 보여줄 오류 문장. 지문 창을 그냥 닫은 경우는 오류로 치지 않는다. */
export function errorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') return null;
    return error.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}
