import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

export function requireString(value: unknown, field: string, maxLength = 4096): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new HttpError(400, 'bad_request', `${field} 값이 올바르지 않습니다.`);
  }
  return value;
}
