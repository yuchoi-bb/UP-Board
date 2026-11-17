import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const useEmulators = import.meta.env.VITE_EMULATORS === '1';

// Firebase 프로젝트 "up-wishlist"의 웹 앱 "UP-Board1" 설정.
// 웹페이지에 공개로 들어가는 식별값이며, 데이터 보호는 Firestore 보안 규칙이 맡는다.
const PRODUCTION_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyBugGi2xSyx-SeROwXNTjqyyCCJpDjNsAk',
  authDomain: 'up-wishlist.firebaseapp.com',
  projectId: 'up-wishlist',
  storageBucket: 'up-wishlist.firebasestorage.app',
  messagingSenderId: '860927554139',
  appId: '1:860927554139:web:9dfb920c34ac64f907457e',
};

const EMULATOR_CONFIG: FirebaseOptions = {
  apiKey: 'demo',
  projectId: 'demo-upboard',
  authDomain: 'demo-upboard.firebaseapp.com',
};

export let auth: Auth;
export let db: Firestore;

export function initFirebase(): void {
  const app = initializeApp(useEmulators ? EMULATOR_CONFIG : PRODUCTION_CONFIG);
  auth = getAuth(app);
  // 로컬 캐시를 켜 두면 오프라인에서도 마지막으로 본 토픽을 읽을 수 있다.
  // up-wishlist 프로젝트를 Supplies와 같이 쓰므로 UP-Board 전용 데이터베이스를 쓴다.
  db = initializeFirestore(
    app,
    { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
    'up-board',
  );
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}
