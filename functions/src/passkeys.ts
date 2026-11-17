import { randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { Timestamp } from 'firebase-admin/firestore';
import { RP_NAME, relyingParty } from './config.js';
import { challenges, configRef, credentials, db } from './store.js';
import { HttpError, randomId } from './util.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type ChallengeKind = 'setup' | 'register' | 'login';

export type PasskeySummary = {
  id: string;
  name: string;
  synced: boolean;
  createdAt: number;
  lastUsedAt: number | null;
};

async function saveChallenge(kind: ChallengeKind, challenge: string): Promise<string> {
  const id = randomId();
  await challenges().doc(id).set({
    kind,
    challenge,
    expiresAt: Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS),
  });
  return id;
}

/** 챌린지는 한 번만 쓸 수 있다. 꺼내는 즉시 지운다. */
async function takeChallenge(id: string, kind: ChallengeKind): Promise<string> {
  const ref = challenges().doc(id);
  const data = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) tx.delete(ref);
    return snap.data();
  });
  if (!data || data.kind !== kind || (data.expiresAt as Timestamp).toMillis() < Date.now()) {
    throw new HttpError(400, 'challenge_expired', '요청이 만료되었습니다. 다시 시도하세요.');
  }
  return data.challenge as string;
}

async function userId(): Promise<Uint8Array<ArrayBuffer>> {
  const snap = await configRef().get();
  const existing = snap.get('userId') as string | undefined;
  if (existing) return new Uint8Array(Buffer.from(existing, 'base64url'));
  const created = randomBytes(16);
  await configRef().set({ userId: created.toString('base64url') }, { merge: true });
  return new Uint8Array(created);
}

export async function registrationOptions(kind: 'setup' | 'register') {
  const existing = await credentials().get();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: relyingParty().rpID,
    userName: 'owner',
    userDisplayName: RP_NAME,
    userID: await userId(),
    attestationType: 'none',
    excludeCredentials: existing.docs.map((doc) => ({
      id: doc.id,
      transports: doc.get('transports') ?? undefined,
    })),
    // residentKey를 요구해야 구글 계정에 동기화되는 패스키로 만들어진다.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  return { challengeId: await saveChallenge(kind, options.challenge), options };
}

export async function verifyRegistration(
  kind: 'setup' | 'register',
  challengeId: string,
  response: RegistrationResponseJSON,
  name: string,
): Promise<PasskeySummary> {
  const expectedChallenge = await takeChallenge(challengeId, kind);
  const { rpID, origins } = relyingParty();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch((error: Error) => {
    throw new HttpError(400, 'verification_failed', `패스키 등록을 확인하지 못했습니다: ${error.message}`);
  });
  if (!result.verified) {
    throw new HttpError(400, 'verification_failed', '패스키 등록을 확인하지 못했습니다.');
  }

  const { credential, credentialBackedUp } = result.registrationInfo;
  const ref = credentials().doc(credential.id);
  const now = Timestamp.now();
  await db().runTransaction(async (tx) => {
    const config = await tx.get(configRef());
    const initialized = config.get('initialized') === true;
    if (kind === 'setup' && initialized) {
      throw new HttpError(409, 'already_initialized', '이미 설정이 끝난 사이트입니다.');
    }
    tx.create(ref, {
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
      synced: credentialBackedUp,
      name,
      createdAt: now,
      lastUsedAt: null,
    });
    if (!initialized) tx.set(configRef(), { initialized: true, initializedAt: now }, { merge: true });
  });
  return { id: credential.id, name, synced: credentialBackedUp, createdAt: now.toMillis(), lastUsedAt: null };
}

export async function authenticationOptions() {
  const options = await generateAuthenticationOptions({
    rpID: relyingParty().rpID,
    userVerification: 'required',
  });
  return { challengeId: await saveChallenge('login', options.challenge), options };
}

export async function verifyAuthentication(challengeId: string, response: AuthenticationResponseJSON): Promise<void> {
  const expectedChallenge = await takeChallenge(challengeId, 'login');
  const ref = credentials().doc(response.id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpError(401, 'unknown_passkey', '등록되지 않은 패스키입니다.');
  }
  const { rpID, origins } = relyingParty();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: snap.id,
      publicKey: new Uint8Array(snap.get('publicKey') as Buffer),
      counter: snap.get('counter') as number,
      transports: snap.get('transports') ?? undefined,
    },
  }).catch((error: Error) => {
    throw new HttpError(401, 'verification_failed', `패스키를 확인하지 못했습니다: ${error.message}`);
  });
  if (!result.verified) {
    throw new HttpError(401, 'verification_failed', '패스키를 확인하지 못했습니다.');
  }
  await ref.update({
    counter: result.authenticationInfo.newCounter,
    synced: result.authenticationInfo.credentialBackedUp,
    lastUsedAt: Timestamp.now(),
  });
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  const snap = await credentials().orderBy('createdAt').get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    name: doc.get('name') as string,
    synced: doc.get('synced') === true,
    createdAt: (doc.get('createdAt') as Timestamp).toMillis(),
    lastUsedAt: (doc.get('lastUsedAt') as Timestamp | null)?.toMillis() ?? null,
  }));
}

export async function deletePasskey(id: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const all = await tx.get(credentials());
    if (!all.docs.some((doc) => doc.id === id)) {
      throw new HttpError(404, 'not_found', '패스키를 찾을 수 없습니다.');
    }
    if (all.size <= 1) {
      throw new HttpError(409, 'last_passkey', '마지막 패스키는 지울 수 없습니다. 새 패스키를 먼저 등록하세요.');
    }
    tx.delete(credentials().doc(id));
  });
}
