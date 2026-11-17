# 작업 규칙 (Claude용)

개인용 포털 웹서비스. 설계는 `docs/DESIGN.md`, 배포 절차는 `README.md`.

## 진행 방식

- 구현·배포 전에 먼저 논의한다. 애매한 선택지는 만들기 전에 물어본다.
- 혼자 쓰는 서비스다. 공유 기능을 넣지 않는다.
- 실제 개인정보(예약 번호, 여권 정보 등)를 커밋하지 않는다.

## 검증

푸시 전에 반드시 돌린다:

```sh
npm --prefix functions run build
npm --prefix web run build:emulator
npm run emulators      # 다른 터미널에 띄워 둔다
npm run test:e2e
```

클라우드 세션에서는 에뮬레이터를 프록시 변수 없이 띄워야 한다. 그러지 않으면 Hosting 에뮬레이터가
로컬 Functions로 가는 요청까지 프록시로 보내서 `/api`가 전부 403이 된다:

```sh
env -u HTTPS_PROXY -u https_proxy -u GLOBAL_AGENT_HTTPS_PROXY npx firebase emulators:start --project demo-upboard
```

화면을 바꿨으면 `SHOTS_DIR=<폴더> npm run test:e2e`로 스크린샷을 찍어 직접 본다.

## 건드리면 안 되는 것

- 패스키는 도메인(rpID)에 묶인다. `RP_ID`나 호스팅 도메인을 바꾸면 등록된 지문이 전부 무효가 된다.
- 계정은 고정 UID `owner` 하나다. Firestore 규칙과 Functions가 이 값에 의존한다.
- `auth/*`, `authCredentials`, `authChallenges`는 클라이언트에 열지 않는다. 규칙에서 전부 막혀 있어야 한다.
- 토픽의 제목·내용·링크를 바꾸는 코드는 반드시 직전 상태를 `versions`에 남긴다
  (`web/src/topics.ts`의 `saveTopic`). AI 편집을 추가할 때도 같다.
- 토픽 삭제는 `deletedAt`만 찍는다. 문서를 실제로 지우는 건 휴지통의 "영구 삭제"뿐이다.
- Gemini API 키 같은 비밀값은 Functions secret으로만 둔다. 저장소와 브라우저 번들에 넣지 않는다.
