import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { api } from './api';
import { auth } from './firebase';

export type Passkey = {
  id: string;
  name: string;
  synced: boolean;
  createdAt: number;
  lastUsedAt: number | null;
};

export type SecurityInfo = {
  passkeys: Passkey[];
  recovery: { remaining: number; generatedAt: number | null };
};

type RegistrationStart = { challengeId: string; options: PublicKeyCredentialCreationOptionsJSON };
type AuthenticationStart = { challengeId: string; options: PublicKeyCredentialRequestOptionsJSON };

export function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : '기기';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '브라우저';
  return `${os} · ${browser}`;
}

export const signIn = (token: string) => signInWithCustomToken(auth, token);
export const logout = () => signOut(auth);

export async function fetchStatus(): Promise<{ initialized: boolean }> {
  return api('GET', '/status');
}

/** 최초 설정. 로그인은 복구 코드를 확인한 뒤에 호출자가 `signIn(token)`으로 마무리한다. */
export async function setupWithPasskey(setupCode: string): Promise<{ recoveryCodes: string[]; token: string }> {
  const start = await api<RegistrationStart>('POST', '/setup/options', { setupCode });
  const response = await startRegistration({ optionsJSON: start.options });
  return api('POST', '/setup/verify', { challengeId: start.challengeId, response, name: deviceName() });
}

export async function loginWithPasskey(): Promise<void> {
  const start = await api<AuthenticationStart>('POST', '/login/options');
  const response = await startAuthentication({ optionsJSON: start.options });
  const { token } = await api<{ token: string }>('POST', '/login/verify', {
    challengeId: start.challengeId,
    response,
  });
  await signIn(token);
}

export async function loginWithRecoveryCode(code: string): Promise<number> {
  const { token, remaining } = await api<{ token: string; remaining: number }>('POST', '/recovery/login', { code });
  sessionStorage.setItem('recovered', '1');
  await signIn(token);
  return remaining;
}

export const fetchSecurity = () => api<SecurityInfo>('GET', '/security');

export async function addPasskey(): Promise<Passkey> {
  const start = await api<RegistrationStart>('POST', '/passkeys/options');
  const response = await startRegistration({ optionsJSON: start.options });
  const { passkey } = await api<{ passkey: Passkey }>('POST', '/passkeys/verify', {
    challengeId: start.challengeId,
    response,
    name: deviceName(),
  });
  return passkey;
}

export const removePasskey = (id: string) => api('POST', '/passkeys/delete', { id });

export async function regenerateRecoveryCodes(): Promise<string[]> {
  const { recoveryCodes } = await api<{ recoveryCodes: string[] }>('POST', '/recovery/regenerate');
  return recoveryCodes;
}

export async function revokeAllSessions(): Promise<void> {
  const { token } = await api<{ token: string }>('POST', '/sessions/revoke');
  await signIn(token);
}
