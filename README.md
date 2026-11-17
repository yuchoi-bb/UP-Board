# UP-Board

여행 계획과 직접 만든 웹앱 링크를 "토픽"으로 모아 두는 개인용 포털.
설계와 결정 사항은 [docs/DESIGN.md](docs/DESIGN.md)에 있다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `web/` | 프론트엔드 (Vite + React). 토픽 편집, 변경 이력, 로그인 화면 |
| `functions/` | 백엔드 (Firebase Functions). 패스키 검증, 복구 코드, 세션 관리 |
| `firestore.rules` | 본인(`owner`)만 토픽을 읽고 쓸 수 있게 하는 규칙 |
| `e2e/` | 에뮬레이터에서 전체 흐름을 확인하는 테스트 |

## 처음 배포하기

Firebase 콘솔에서 한 번만 하면 되는 준비:

1. 프로젝트를 만들고 요금제를 **Blaze**로 바꾼다. (Functions 배포에 필요. 개인 사용량이면 요금은 거의 나오지 않는다.)
2. **Firestore Database**를 만든다. 위치는 `asia-northeast3`(서울)을 권한다.
3. **Authentication**에서 "시작하기"를 누른다. 로그인 제공업체는 켜지 않아도 된다.
4. 프로젝트 설정에서 **웹 앱**을 하나 등록한다. (Hosting이 설정값을 자동으로 내려주는 데 필요)

그다음 이 저장소에서:

```sh
npm install && npm --prefix functions install && npm --prefix web install
npx firebase login
npx firebase use --add                          # 만든 프로젝트 선택
npx firebase functions:secrets:set SETUP_CODE   # 첫 패스키 등록 때 입력할 코드. 길게 정한다
npm run deploy
```

배포가 끝나면 **폰에서** `https://<프로젝트ID>.web.app`을 열고, 설정 코드를 입력해 지문을 등록한다.
이때 보여주는 복구 코드 10개는 다시 볼 수 없으니 반드시 저장해 둔다.

### 로그인할 때 서버 오류가 나면

Functions 로그에 `iam.serviceAccounts.signBlob` 권한 오류가 보이면, Functions가 로그인 토큰에 서명할 권한이 없는 것이다.
Google Cloud 콘솔의 IAM에서 Functions 실행 서비스 계정(`<프로젝트번호>-compute@developer.gserviceaccount.com`)에
**서비스 계정 토큰 생성자** 역할을 추가한다.

### 도메인을 바꿀 때

패스키는 도메인에 묶인다. 커스텀 도메인으로 옮기려면 `functions/.env`에 `RP_ID=새도메인`을 넣고 다시 배포한 뒤,
복구 코드로 로그인해서 패스키를 새로 등록한다.

## 로컬에서 실행

```sh
npm --prefix web run build:emulator
echo "SETUP_CODE=test-setup-code" > functions/.secret.local
npm run emulators            # http://localhost:5000
```

화면을 고치면서 볼 때는 에뮬레이터를 띄운 채로 `npm --prefix web run dev` (http://localhost:5173).

## 테스트

에뮬레이터를 띄운 상태에서:

```sh
npm run test:e2e
```

가상 지문 인증기를 붙인 브라우저로 최초 설정, 토픽 편집, 이력 복원, 휴지통, 지문 로그인,
복구 코드 로그인, 패스키 교체, Firestore 규칙까지 확인한다. Playwright가 설치되어 있어야 한다.
