import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { onRequest, type Request } from 'firebase-functions/v2/https';
import { OWNER_UID, SETUP_CODE } from './config.js';
import {
  authenticationOptions,
  deletePasskey,
  listPasskeys,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from './passkeys.js';
import { consumeRecoveryCode, issueRecoveryCodes, recoveryStatus } from './recovery.js';
import { assertNotThrottled, isInitialized, recordFailure } from './store.js';
import { HttpError, requireString, safeEqual } from './util.js';

initializeApp();

type Route = { auth: boolean; handler: (body: Record<string, unknown>) => Promise<unknown> };

const token = () => getAuth().createCustomToken(OWNER_UID);

function passkeyName(body: Record<string, unknown>): string {
  return typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : '패스키';
}

const routes: Record<string, Route> = {
  'GET /api/status': {
    auth: false,
    handler: async () => ({ initialized: await isInitialized() }),
  },

  // 최초 설정: 설정 코드를 아는 사람만 첫 패스키를 등록할 수 있다.
  'POST /api/setup/options': {
    auth: false,
    handler: async (body) => {
      if (await isInitialized()) {
        throw new HttpError(409, 'already_initialized', '이미 설정이 끝난 사이트입니다.');
      }
      const expected = SETUP_CODE.value();
      if (!expected) throw new HttpError(500, 'not_configured', 'SETUP_CODE가 설정되지 않았습니다.');
      await assertNotThrottled();
      if (!safeEqual(requireString(body.setupCode, 'setupCode', 200), expected)) {
        await recordFailure();
        throw new HttpError(401, 'invalid_code', '설정 코드가 올바르지 않습니다.');
      }
      return registrationOptions('setup');
    },
  },
  'POST /api/setup/verify': {
    auth: false,
    handler: async (body) => {
      const passkey = await verifyRegistration(
        'setup',
        requireString(body.challengeId, 'challengeId'),
        body.response as never,
        passkeyName(body),
      );
      return { passkey, recoveryCodes: await issueRecoveryCodes(), token: await token() };
    },
  },

  'POST /api/login/options': {
    auth: false,
    handler: () => authenticationOptions(),
  },
  'POST /api/login/verify': {
    auth: false,
    handler: async (body) => {
      await verifyAuthentication(requireString(body.challengeId, 'challengeId'), body.response as never);
      return { token: await token() };
    },
  },
  'POST /api/recovery/login': {
    auth: false,
    handler: async (body) => {
      const remaining = await consumeRecoveryCode(requireString(body.code, 'code', 100));
      return { remaining, token: await token() };
    },
  },

  'GET /api/security': {
    auth: true,
    handler: async () => ({ passkeys: await listPasskeys(), recovery: await recoveryStatus() }),
  },
  'POST /api/passkeys/options': {
    auth: true,
    handler: () => registrationOptions('register'),
  },
  'POST /api/passkeys/verify': {
    auth: true,
    handler: async (body) => ({
      passkey: await verifyRegistration(
        'register',
        requireString(body.challengeId, 'challengeId'),
        body.response as never,
        passkeyName(body),
      ),
    }),
  },
  'POST /api/passkeys/delete': {
    auth: true,
    handler: async (body) => {
      await deletePasskey(requireString(body.id, 'id', 1024));
      return {};
    },
  },
  'POST /api/recovery/regenerate': {
    auth: true,
    handler: async () => ({ recoveryCodes: await issueRecoveryCodes() }),
  },
  // 모든 기기의 로그인을 끊는다. 요청한 기기는 새 토큰으로 바로 다시 로그인한다.
  'POST /api/sessions/revoke': {
    auth: true,
    handler: async () => {
      await getAuth().revokeRefreshTokens(OWNER_UID);
      return { token: await token() };
    },
  },
};

async function assertOwner(req: Request): Promise<void> {
  const match = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
  if (!match) throw new HttpError(401, 'unauthenticated', '로그인이 필요합니다.');
  const decoded = await getAuth()
    .verifyIdToken(match[1], true)
    .catch(() => {
      throw new HttpError(401, 'unauthenticated', '로그인이 만료되었습니다. 다시 로그인하세요.');
    });
  if (decoded.uid !== OWNER_UID) throw new HttpError(403, 'forbidden', '권한이 없습니다.');
}

export const api = onRequest({ region: 'asia-northeast3', secrets: [SETUP_CODE], maxInstances: 3 }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const route = routes[`${req.method} ${req.path.replace(/\/+$/, '')}`];
    if (!route) throw new HttpError(404, 'not_found', '없는 경로입니다.');
    if (route.auth) await assertOwner(req);
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    res.json(await route.handler(body));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    logger.error('unhandled error', error);
    res.status(500).json({ error: { code: 'internal', message: '서버 오류가 발생했습니다.' } });
  }
});
