import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpError } from './util.js';

export const db = () => getFirestore();

export const configRef = () => db().doc('auth/config');
export const recoveryRef = () => db().doc('auth/recovery');
export const throttleRef = () => db().doc('auth/throttle');
export const credentials = () => db().collection('authCredentials');
export const challenges = () => db().collection('authChallenges');

const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_FAILURES = 5;

/** 설정 코드·복구 코드 입력 실패가 짧은 시간에 몰리면 잠근다. */
export async function assertNotThrottled(): Promise<void> {
  const snap = await throttleRef().get();
  const data = snap.data();
  if (!data) return;
  const windowStart = (data.windowStart as Timestamp).toMillis();
  if (Date.now() - windowStart < THROTTLE_WINDOW_MS && data.failures >= THROTTLE_MAX_FAILURES) {
    throw new HttpError(429, 'throttled', '시도가 너무 많습니다. 15분 뒤에 다시 시도하세요.');
  }
}

export async function recordFailure(): Promise<void> {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(throttleRef());
    const data = snap.data();
    const now = Date.now();
    const expired = !data || now - (data.windowStart as Timestamp).toMillis() >= THROTTLE_WINDOW_MS;
    tx.set(throttleRef(), {
      windowStart: expired ? Timestamp.fromMillis(now) : data.windowStart,
      failures: expired ? 1 : data.failures + 1,
    });
  });
}

export async function isInitialized(): Promise<boolean> {
  const snap = await configRef().get();
  return snap.exists && snap.get('initialized') === true;
}
