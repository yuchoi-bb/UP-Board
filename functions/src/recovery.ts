import { randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { assertNotThrottled, db, recordFailure, recoveryRef } from './store.js';
import { HttpError, sha256Hex } from './util.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_COUNT = 10;
const CODE_LENGTH = 20;

type StoredCode = { hash: string; usedAt: Timestamp | null };

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let raw = '';
  for (const byte of bytes) raw += ALPHABET[byte & 31];
  return raw.match(/.{5}/g)!.join('-');
}

function normalize(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** 새 복구 코드 묶음을 만들어 저장한다. 평문은 이 반환값으로 한 번만 나간다. */
export async function issueRecoveryCodes(): Promise<string[]> {
  const codes = Array.from({ length: CODE_COUNT }, generateCode);
  const stored: StoredCode[] = codes.map((code) => ({ hash: sha256Hex(normalize(code)), usedAt: null }));
  await recoveryRef().set({ codes: stored, generatedAt: Timestamp.now() });
  return codes;
}

export async function recoveryStatus(): Promise<{ remaining: number; generatedAt: number | null }> {
  const snap = await recoveryRef().get();
  const codes = (snap.get('codes') as StoredCode[] | undefined) ?? [];
  const generatedAt = snap.get('generatedAt') as Timestamp | undefined;
  return {
    remaining: codes.filter((code) => code.usedAt === null).length,
    generatedAt: generatedAt ? generatedAt.toMillis() : null,
  };
}

/** 복구 코드를 1회 소모한다. 맞으면 남은 개수를 돌려준다. */
export async function consumeRecoveryCode(input: string): Promise<number> {
  await assertNotThrottled();
  const hash = sha256Hex(normalize(input));
  const remaining = await db().runTransaction(async (tx) => {
    const snap = await tx.get(recoveryRef());
    const codes = (snap.get('codes') as StoredCode[] | undefined) ?? [];
    const match = codes.find((code) => code.hash === hash && code.usedAt === null);
    if (!match) return null;
    match.usedAt = Timestamp.now();
    tx.update(recoveryRef(), { codes });
    return codes.filter((code) => code.usedAt === null).length;
  });
  if (remaining === null) {
    await recordFailure();
    throw new HttpError(401, 'invalid_code', '복구 코드가 올바르지 않거나 이미 사용되었습니다.');
  }
  return remaining;
}
