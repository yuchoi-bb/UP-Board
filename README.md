# UP-Board

여행 계획과 직접 만든 웹앱 링크를 "토픽"으로 모아 두는 개인용 포털.
설계와 결정 사항은 [docs/DESIGN.md](docs/DESIGN.md)에 있다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `web/` | 프론트엔드 (Vite + React). 토픽 편집, 변경 이력, 로그인 화면 |
| `functions/` | 백엔드 (Firebase Functions). 패스키 검증, 복구 코드, 세션 관리 |
| `firestore.rules` | `up-board` 데이터베이스 규칙. 패스키로 로그인한 본인만 토픽을 읽고 쓴다 |
| `e2e/` | 에뮬레이터에서 전체 흐름을 확인하는 테스트 |

## 처음 배포하기

Firebase 프로젝트 `up-wishlist`를 Supplies 앱과 같이 쓴다. 어떻게 나눠 쓰는지는 [docs/DESIGN.md](docs/DESIGN.md) 참고.

Firebase 콘솔에서 한 번만 하면 되는 준비:

1. `up-wishlist`의 요금제가 **Blaze**인지 확인한다. (Functions 배포에 필요. 개인 사용량이면 요금은 거의 나오지 않는다.)
2. **Authentication → Users**에서 Supplies 앱에 로그인할 때 쓰는 구글 계정 행의 **사용자 UID**를 복사해 둔다.
3. 프로젝트 설정에서 **웹 앱**을 하나 더 등록하고(이름 예: UP-Board), 아래에서 만들 `up-board` Hosting 사이트에 연결한다.
   Hosting이 이 앱의 설정값을 사이트에 자동으로 내려준다.

그다음 이 저장소에서:

```sh
npm install && npm --prefix functions install && npm --prefix web install
npx firebase login
npx firebase hosting:sites:create up-board          # 이름이 이미 쓰이고 있으면 알려 달라
echo "OWNER_UID=<복사한 UID>" > functions/.env.up-wishlist
npx firebase functions:secrets:set SETUP_CODE       # 첫 패스키 등록 때 입력할 코드. 길게 정한다
npm run deploy
```

첫 배포 때 Firestore 데이터베이스 `up-board`가 서울(`asia-northeast3`)에 자동으로 만들어진다.
Supplies가 쓰는 기본 데이터베이스와 그 규칙은 건드리지 않는다.

배포가 끝나면 **폰에서** `https://up-board.web.app`을 열고, 설정 코드를 입력해 지문을 등록한다.
이때 보여주는 복구 코드 10개는 다시 볼 수 없으니 반드시 저장해 둔다.

### 로그인할 때 서버 오류가 나면

- `OWNER_UID에 해당하는 계정이 없습니다`: `functions/.env.up-wishlist`의 UID가 틀렸다. 고치고 다시 배포한다.
- Functions 로그에 `iam.serviceAccounts.signBlob` 권한 오류: Functions가 로그인 토큰에 서명할 권한이 없는 것이다.
  Google Cloud 콘솔의 IAM에서 Functions 실행 서비스 계정(`<프로젝트번호>-compute@developer.gserviceaccount.com`)에
  **서비스 계정 토큰 생성자** 역할을 추가한다.
- 화면이 Firebase에 연결하지 못하면: Google Cloud 콘솔의 사용자 인증 정보에서 브라우저 API 키에
  HTTP 리퍼러 제한이 걸려 있는지 보고, 걸려 있으면 `up-board.web.app`을 추가한다.

### 도메인을 바꿀 때

패스키는 도메인에 묶인다. 커스텀 도메인으로 옮기려면 `functions/.env.up-wishlist`에 `RP_ID=새도메인`을 넣고 다시 배포한 뒤,
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
