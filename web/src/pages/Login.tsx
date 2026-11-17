import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../api';
import { fetchStatus, loginWithPasskey, loginWithRecoveryCode, setupWithPasskey, signIn } from '../session';
import { RecoveryCodes } from './RecoveryCodes';

type Mode = 'loading' | 'setup' | 'login' | 'recovery';

export function Login() {
  const [mode, setMode] = useState<Mode>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [issued, setIssued] = useState<{ recoveryCodes: string[]; token: string } | null>(null);

  useEffect(() => {
    fetchStatus().then(
      ({ initialized }) => setMode(initialized ? 'login' : 'setup'),
      (err) => setError(errorMessage(err)),
    );
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setup = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => setIssued(await setupWithPasskey(setupCode)));
  };

  const recover = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => void (await loginWithRecoveryCode(recoveryCode)));
  };

  if (issued) {
    return (
      <main className="login">
        <RecoveryCodes codes={issued.recoveryCodes} onDone={() => void run(async () => void (await signIn(issued.token)))} />
      </main>
    );
  }

  return (
    <main className="login">
      <h1 className="login-title">UP-Board</h1>

      {mode === 'loading' && !error && <p className="muted">불러오는 중…</p>}

      {mode === 'setup' && (
        <form className="card" onSubmit={setup}>
          <h2>처음 설정</h2>
          <p className="muted">
            배포할 때 정한 설정 코드를 입력하고, 이 기기의 지문을 패스키로 등록합니다. 폰에서 진행하는 것을 권합니다.
          </p>
          <label>
            설정 코드
            <input
              type="password"
              autoComplete="off"
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            패스키 등록하고 시작
          </button>
        </form>
      )}

      {mode === 'login' && (
        <section className="card">
          <button type="button" className="primary big" disabled={busy} onClick={() => void run(loginWithPasskey)}>
            지문으로 로그인
          </button>
          <p className="muted small">PC에서는 브라우저가 띄우는 QR을 폰으로 찍어 지문으로 승인할 수 있습니다.</p>
          <button type="button" className="link" onClick={() => setMode('recovery')}>
            폰을 쓸 수 없나요? 복구 코드로 로그인
          </button>
        </section>
      )}

      {mode === 'recovery' && (
        <form className="card" onSubmit={recover}>
          <h2>복구 코드로 로그인</h2>
          <label>
            복구 코드
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            로그인
          </button>
          <button type="button" className="link" onClick={() => setMode('login')}>
            지문 로그인으로 돌아가기
          </button>
        </form>
      )}

      {error && <p className="notice notice-error">{error}</p>}
    </main>
  );
}
