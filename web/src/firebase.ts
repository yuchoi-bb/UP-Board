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

async function loadConfig(): Promise<FirebaseOptions> {
  if (useEmulators) {
    return { apiKey: 'demo', projectId: 'demo-upboard', authDomain: 'demo-upboard.firebaseapp.com' };
  }
  // Firebase Hosting이 프로젝트 설정을 이 경로로 내려준다. 저장소에 설정값을 넣지 않아도 된다.
  const response = await fetch('/__/firebase/init.json');
  if (!response.ok) throw new Error('Firebase 설정을 불러오지 못했습니다.');
  return response.json();
}

export let auth: Auth;
export let db: Firestore;

export async function initFirebase(): Promise<void> {
  const app = initializeApp(await loadConfig());
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
