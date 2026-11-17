import { defineSecret, defineString } from 'firebase-functions/params';

export const OWNER_UID = 'owner';
export const RP_NAME = 'UP-Board';

/** 최초 설정(첫 패스키 등록) 때만 요구하는 코드. 남이 먼저 사이트를 차지하지 못하게 막는다. */
export const SETUP_CODE = defineSecret('SETUP_CODE');

/** 패스키가 묶일 도메인. 비워 두면 `<project>.web.app`을 쓴다. */
const RP_ID = defineString('RP_ID', { default: '' });

export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

export function relyingParty(): { rpID: string; origins: string[] } {
  if (isEmulator) {
    return { rpID: 'localhost', origins: ['http://localhost:5000', 'http://localhost:5173'] };
  }
  const rpID = RP_ID.value() || `${process.env.GCLOUD_PROJECT}.web.app`;
  return { rpID, origins: [`https://${rpID}`] };
}
