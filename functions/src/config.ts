import { defineSecret, defineString } from 'firebase-functions/params';

export const RP_NAME = 'UP-Board';

/** up-wishlist 프로젝트를 다른 앱과 같이 쓰므로, UP-Board 데이터는 이 이름의 데이터베이스에만 둔다. */
export const DATABASE_ID = 'up-board';

/** Firestore 규칙과 API가 확인하는 클레임. 패스키나 복구 코드로 들어온 세션에만 붙는다. */
export const OWNER_CLAIM = 'upboard';

/**
 * 로그인하면 이 UID의 사용자가 된다. Supplies 앱에 구글로 로그인한 계정의 UID를 넣어
 * 두 앱이 같은 사용자를 쓰게 한다.
 */
const OWNER_UID = defineString('OWNER_UID');

/** 최초 설정(첫 패스키 등록) 때만 요구하는 코드. 남이 먼저 사이트를 차지하지 못하게 막는다. */
export const SETUP_CODE = defineSecret('SETUP_CODE');

/** 패스키가 묶일 도메인. 바꾸면 등록한 패스키가 전부 무효가 된다. */
const RP_ID = defineString('RP_ID', { default: 'up-board.web.app' });

export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

export const ownerUid = () => OWNER_UID.value();

export function relyingParty(): { rpID: string; origins: string[] } {
  if (isEmulator) {
    return { rpID: 'localhost', origins: ['http://localhost:5000', 'http://localhost:5173'] };
  }
  const rpID = RP_ID.value();
  return { rpID, origins: [`https://${rpID}`] };
}
