import { useState } from 'react';

/** 복구 코드를 딱 한 번 보여주는 화면. 저장했다고 확인해야 넘어갈 수 있다. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([`UP-Board 복구 코드\n\n${text}\n`], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'up-board-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <h2>복구 코드</h2>
      <p className="muted">
        폰을 잃어버리거나 바꿔서 지문 로그인이 안 될 때 쓰는 코드입니다. 각 코드는 한 번만 쓸 수 있고,
        <strong> 이 화면을 닫으면 다시 볼 수 없습니다.</strong>
      </p>
      <ol className="codes" data-testid="recovery-codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="row">
        <button type="button" onClick={copy}>
          {copied ? '복사됨' : '복사'}
        </button>
        <button type="button" onClick={download}>
          파일로 저장
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        안전한 곳에 저장했습니다
      </label>
      <button type="button" className="primary" disabled={!saved} onClick={onDone}>
        계속
      </button>
    </section>
  );
}
