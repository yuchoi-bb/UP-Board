import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api';
import {
  addPasskey,
  fetchSecurity,
  logout,
  regenerateRecoveryCodes,
  removePasskey,
  revokeAllSessions,
  type SecurityInfo,
} from '../session';
import { RecoveryCodes } from './RecoveryCodes';

const formatDate = (millis: number | null) =>
  millis ? new Date(millis).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '없음';

export function Settings() {
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [recovered, setRecovered] = useState(() => sessionStorage.getItem('recovered') === '1');

  const reload = useCallback(async () => setInfo(await fetchSecurity()), []);

  useEffect(() => {
    reload().catch((err) => setError(errorMessage(err)));
  }, [reload]);

  const run = async (action: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      await reload();
      setMessage(result ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const dismissRecovered = () => {
    sessionStorage.removeItem('recovered');
    setRecovered(false);
  };

  if (newCodes) {
    return <RecoveryCodes codes={newCodes} onDone={() => setNewCodes(null)} />;
  }

  return (
    <>
      <h1>설정</h1>

      {recovered && (
        <div className="notice">
          <p>
            <strong>복구 코드로 로그인했습니다.</strong> 폰을 잃어버렸다면 아래 순서로 정리하세요.
          </p>
          <ol>
            <li>지금 쓰는 기기에 새 패스키를 추가합니다.</li>
            <li>잃어버린 기기의 패스키를 삭제합니다.</li>
            <li>"모든 기기에서 로그아웃"으로 남아 있는 로그인을 끊습니다.</li>
          </ol>
          <button type="button" className="link" onClick={dismissRecovered}>
            닫기
          </button>
        </div>
      )}

      {error && <p className="notice notice-error">{error}</p>}
      {message && <p className="notice">{message}</p>}

      <section className="card">
        <h2>패스키</h2>
        {!info && !error && <p className="muted">불러오는 중…</p>}
        <ul className="passkeys">
          {info?.passkeys.map((passkey) => (
            <li key={passkey.id}>
              <div>
                <strong>{passkey.name}</strong>{' '}
                <span className="badge">{passkey.synced ? '계정에 동기화됨' : '이 기기 전용'}</span>
                <div className="muted small">
                  등록 {formatDate(passkey.createdAt)} · 마지막 사용 {formatDate(passkey.lastUsedAt)}
                </div>
              </div>
              <button
                type="button"
                className="danger"
                disabled={busy || info.passkeys.length <= 1}
                onClick={() => {
                  if (window.confirm(`"${passkey.name}" 패스키를 삭제할까요?`)) {
                    void run(async () => void (await removePasskey(passkey.id)));
                  }
                }}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await addPasskey();
              return '패스키를 추가했습니다.';
            })
          }
        >
          이 기기에 패스키 추가
        </button>
      </section>

      <section className="card">
        <h2>복구 코드</h2>
        {info && (
          <p className="muted">
            남은 코드 {info.recovery.remaining}개 · 발급 {formatDate(info.recovery.generatedAt)}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm('복구 코드를 새로 발급할까요? 기존 코드는 전부 못 쓰게 됩니다.')) {
              void run(async () => setNewCodes(await regenerateRecoveryCodes()));
            }
          }}
        >
          새로 발급
        </button>
      </section>

      <section className="card">
        <h2>로그인</h2>
        <div className="row">
          <button type="button" onClick={() => void logout()}>
            로그아웃
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  '모든 기기에서 로그아웃할까요? 계정을 같이 쓰는 Supplies 앱의 로그인도 모든 기기에서 끊깁니다. 이 기기는 로그인 상태로 남습니다.',
                )
              ) {
                void run(async () => {
                  await revokeAllSessions();
                  return '다른 기기의 로그인을 모두 끊었습니다. 반영까지 최대 1시간 걸릴 수 있습니다.';
                });
              }
            }}
          >
            모든 기기에서 로그아웃
          </button>
        </div>
      </section>

      <section className="card">
        <h2>토픽</h2>
        <Link to="/trash">휴지통 열기</Link>
      </section>
    </>
  );
}
