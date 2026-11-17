// 에뮬레이터에 붙어 전체 흐름을 확인한다.
// 준비: `npm --prefix web run build:emulator` 후 `npm run emulators`를 띄워 둔다.
// 최초 설정부터 다시 하기 위해 시작할 때 에뮬레이터 데이터를 전부 지운다.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// 전역에 설치된 Playwright도 찾을 수 있도록 require로 불러온다.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = 'http://localhost:5000';
const SHOTS = process.env.SHOTS_DIR;
const SCALE = Number(process.env.SHOTS_SCALE ?? 1);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PROJECT = 'demo-upboard';
const DATABASE = 'up-board';
const OWNER_UID = 'test-owner';
const AUTH_API = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;

await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/${DATABASE}/documents`, {
  method: 'DELETE',
});
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

// Supplies 앱에 구글로 가입해 둔 계정 역할. UP-Board는 이 계정으로 로그인한다.
const createOwner = () =>
  fetch(`${AUTH_API}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: OWNER_UID, email: 'owner@example.com', password: 'supplies-login' }),
  }).then((response) => assert.equal(response.status, 200));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE });
const page = await context.newPage();
page.on('dialog', (dialog) => dialog.accept());
page.on('pageerror', (error) => console.error('page error:', error.message));

const cdp = await context.newCDPSession(page);
await cdp.send('WebAuthn.enable');
const addAuthenticator = async () =>
  (
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })
  ).authenticatorId;

const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const step = (name) => console.log(`✓ ${name}`);

let phone = await addAuthenticator();

// 최초 설정
await page.goto(BASE);
await page.getByText('처음 설정').waitFor();
await shot('01-setup');
await page.getByLabel('설정 코드').fill('test-setup-code');
await page.getByRole('button', { name: '패스키 등록하고 시작' }).click();
await page.getByText('OWNER_UID에 해당하는 계정이 없습니다').waitFor();
step('소유자 계정이 없으면 설정을 시작하지 않는다');

await createOwner();
await page.getByLabel('설정 코드').fill('wrong-code');
await page.getByRole('button', { name: '패스키 등록하고 시작' }).click();
await page.getByText('설정 코드가 올바르지 않습니다.').waitFor();
step('틀린 설정 코드는 거부된다');

await page.getByLabel('설정 코드').fill('test-setup-code');
await page.getByRole('button', { name: '패스키 등록하고 시작' }).click();
await page.getByTestId('recovery-codes').waitFor();
const codes = await page.getByTestId('recovery-codes').locator('li').allTextContents();
assert.equal(codes.length, 10);
assert.match(codes[0], /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
await shot('02-recovery-codes');
assert.ok(await page.getByRole('button', { name: '계속' }).isDisabled());
await page.getByLabel('안전한 곳에 저장했습니다').check();
await page.getByRole('button', { name: '계속' }).click();
await page.getByText('아직 토픽이 없습니다').waitFor();
step('패스키 등록 → 복구 코드 10개 발급 → 로그인');

// 토픽 만들고 편집
await page.getByRole('button', { name: '새 토픽' }).click();
await page.getByLabel('제목').fill('오사카 여행');
await page.getByLabel(/^내용/).fill('## 1일차\n\n- 간사이 공항 도착\n- 도톤보리');
await page.getByRole('button', { name: '링크 추가' }).click();
await page.getByLabel('링크 이름').fill('준비물 앱');
await page.getByLabel('링크 주소').fill('example.com/supplies');
await shot('03-editor');
await page.getByRole('button', { name: '저장' }).click();
await page.getByRole('heading', { name: '오사카 여행', level: 1 }).waitFor();
await page.getByRole('heading', { name: '1일차' }).waitFor();
assert.equal(await page.getByRole('link', { name: /준비물 앱/ }).getAttribute('href'), 'https://example.com/supplies');
step('토픽 생성·편집, 마크다운과 링크 표시');

// 다시 편집 → 이력 → 복원
await page.getByRole('button', { name: '편집' }).click();
await page.getByLabel(/^내용/).fill('전부 지워버린 내용');
await page.getByRole('button', { name: '저장' }).click();
await page.getByText('전부 지워버린 내용').waitFor();
await page.getByRole('button', { name: '변경 이력' }).click();
await page.locator('.history-entry').first().waitFor();
assert.equal(await page.locator('.history-entry').count(), 2);
await page.locator('.history-entry').first().click();
await page.getByText('버전 미리보기').waitFor();
await shot('04-history');
await page.getByRole('button', { name: '이 버전으로 복원' }).click();
await page.locator('article > .markdown').getByText('도톤보리').waitFor();
await page.locator('.history-current').getByText(/복원/).waitFor();
assert.equal(await page.locator('.history-entry').count(), 3);
step('변경 이력에서 이전 버전으로 복원');

// 하위 토픽과 순서
const topicUrl = page.url();
for (const title of ['맛집', '교통']) {
  await page.goto(topicUrl);
  await page.getByRole('button', { name: '하위 토픽 추가' }).click();
  await page.getByLabel('제목').fill(title);
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('heading', { name: title, level: 1 }).waitFor();
}
await page.getByRole('link', { name: '오사카 여행' }).click();
const titles = () => page.locator('.topic-item-title').allTextContents();
await page.locator('.topic-item').nth(1).waitFor();
assert.deepEqual(await titles(), ['맛집', '교통']);
await page.locator('.topic-item').nth(1).getByRole('button', { name: '위로' }).click();
await page.waitForFunction(() => document.querySelector('.topic-item-title')?.textContent === '교통');
assert.deepEqual(await titles(), ['교통', '맛집']);
await shot('05-topic');
step('하위 토픽 추가, 경로 표시, 순서 바꾸기');

// 휴지통
await page.getByRole('link', { name: /맛집/ }).click();
await page.getByRole('button', { name: '휴지통으로' }).click();
await page.getByRole('heading', { name: '오사카 여행', level: 1 }).waitFor();
assert.deepEqual(await titles(), ['교통']);
await page.goto(`${BASE}/trash`);
await page.getByText('맛집').waitFor();
await page.getByRole('button', { name: '되살리기' }).click();
await page.getByText('휴지통이 비어 있습니다.').waitFor();
await page.goto(topicUrl);
await page.locator('.topic-item').nth(1).waitFor();
assert.deepEqual(await titles(), ['교통', '맛집']);
step('휴지통으로 보내고 되살리기');

// 로그아웃 → 지문 로그인
await page.goto(`${BASE}/settings`);
await page.getByText('계정에 동기화됨').or(page.getByText('이 기기 전용')).waitFor();
await shot('06-settings');
await page.getByRole('button', { name: '로그아웃', exact: true }).click();
await page.getByRole('button', { name: '지문으로 로그인' }).waitFor();
await shot('07-login');
await page.getByRole('button', { name: '지문으로 로그인' }).click();
await page.getByRole('heading', { name: '설정' }).waitFor();
await page.goto(BASE);
await page.getByText('오사카 여행').waitFor();
await shot('08-home');
step('로그아웃 후 지문으로 다시 로그인');

// 폰 분실 시나리오: 복구 코드로 로그인 → 새 패스키 → 옛 패스키 삭제
await page.goto(`${BASE}/settings`);
await page.getByRole('button', { name: '로그아웃', exact: true }).click();
await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: phone });
await page.getByRole('button', { name: /복구 코드로 로그인/ }).click();
await page.getByLabel('복구 코드').fill('AAAAA-AAAAA-AAAAA-AAAAA');
await page.getByRole('button', { name: '로그인', exact: true }).click();
await page.getByText('복구 코드가 올바르지 않거나').waitFor();
await page.getByLabel('복구 코드').fill(codes[3].toLowerCase());
await page.getByRole('button', { name: '로그인', exact: true }).click();
await page.getByText('복구 코드로 로그인했습니다.').waitFor();
await page.getByText('남은 코드 9개').waitFor();
step('복구 코드로 로그인 (틀린 코드는 거부, 소문자 입력 허용)');

phone = await addAuthenticator();
await page.getByRole('button', { name: '이 기기에 패스키 추가' }).click();
await page.getByText('패스키를 추가했습니다.').waitFor();
assert.equal(await page.locator('.passkeys li').count(), 2);
await page.locator('.passkeys li').first().getByRole('button', { name: '삭제' }).click();
await page.waitForFunction(() => document.querySelectorAll('.passkeys li').length === 1);
assert.ok(await page.locator('.passkeys li').getByRole('button', { name: '삭제' }).isDisabled());
await page.getByRole('button', { name: '모든 기기에서 로그아웃' }).click();
await page.getByText('다른 기기의 로그인을 모두 끊었습니다.').waitFor();
step('새 패스키 추가, 옛 패스키 삭제, 마지막 패스키는 삭제 불가, 전체 로그아웃');

await page.getByRole('button', { name: '로그아웃', exact: true }).click();
await page.getByRole('button', { name: '지문으로 로그인' }).click();
await page.getByRole('heading', { name: '설정' }).waitFor();
await page.goto(BASE);
await page.getByText('오사카 여행').waitFor();
step('새 패스키로 로그인');

// 이미 쓴 복구 코드는 다시 못 쓴다
const reuse = await page.request.post(`${BASE}/api/recovery/login`, { data: { code: codes[3] } });
assert.equal(reuse.status(), 401);
// 설정이 끝난 뒤에는 설정 코드를 알아도 새로 등록할 수 없다
const resetup = await page.request.post(`${BASE}/api/setup/options`, { data: { setupCode: 'test-setup-code' } });
assert.equal(resetup.status(), 409);
step('쓴 복구 코드 재사용 불가, 설정 완료 후 재설정 불가');

const users = await fetch(`${AUTH_API}/accounts:query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ returnUserInfo: true }),
}).then((response) => response.json());
assert.deepEqual(
  users.userInfo.map((user) => user.localId),
  [OWNER_UID],
);
step('여러 번 로그인해도 사용자는 Supplies 계정 하나뿐이다');

// Supplies에서 구글로 로그인한 세션 흉내: 같은 계정이지만 패스키를 거치지 않았다.
const suppliesLogin = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@example.com', password: 'supplies-login', returnSecureToken: true }),
}).then((response) => response.json());
assert.equal(suppliesLogin.localId, OWNER_UID);
const suppliesApi = await page.request.get(`${BASE}/api/security`, {
  headers: { Authorization: `Bearer ${suppliesLogin.idToken}` },
});
assert.equal(suppliesApi.status(), 403);
step('같은 계정이라도 패스키 없이 들어온 세션은 API에서 막힌다');

// Firestore 규칙
const unsigned = (uid, claims = {}) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/demo-upboard',
    aud: 'demo-upboard',
    sub: uid,
    user_id: uid,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    firebase: { identities: {}, sign_in_provider: 'custom' },
    ...claims,
  };
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
};
const firestore = (path, uid, claims) =>
  fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/${DATABASE}/documents/${path}`, {
    headers: uid ? { Authorization: `Bearer ${unsigned(uid, claims)}` } : {},
  }).then((response) => response.status);
const owner = { upboard: true };
assert.equal(await firestore('topics', OWNER_UID, owner), 200);
assert.equal(await firestore('topics', null), 403);
assert.equal(await firestore('topics', OWNER_UID), 403);
assert.equal(await firestore('topics', 'someone-else'), 403);
assert.equal(await firestore('authCredentials', OWNER_UID, owner), 403);
assert.equal(await firestore('auth/recovery', OWNER_UID, owner), 403);
step('Firestore 규칙: 패스키로 들어온 세션만 토픽 접근, 인증 데이터는 누구도 직접 접근 불가');

await browser.close();
console.log('\n전체 통과');
