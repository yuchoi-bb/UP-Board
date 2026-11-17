import { useEffect, useState } from 'react';
import { formatTime, restoreVersion, subscribeVersions, type Author, type Topic, type Version } from '../topics';
import { LinkCards, Markdown } from './Markdown';

const authorLabel = (author: Author) => (author === 'ai' ? 'AI' : '나');

export function History({ topic, onRestored }: { topic: Topic; onRestored: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => subscribeVersions(topic.id, setVersions), [topic.id]);

  const selected = versions?.find((version) => version.id === selectedId) ?? null;

  return (
    <section className="history">
      <h2>변경 이력</h2>
      <ol className="history-list">
        <li className="history-current">
          <span className="history-meta">
            <strong>현재</strong> · {authorLabel(topic.updatedBy)} · {topic.updatedSummary}
          </span>
          <span className="muted small">{formatTime(topic.updatedAt)}</span>
        </li>
        {versions?.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              className={version.id === selectedId ? 'history-entry selected' : 'history-entry'}
              onClick={() => setSelectedId(version.id === selectedId ? null : version.id)}
            >
              <span className="history-meta">
                {authorLabel(version.author)} · {version.summary}
              </span>
              <span className="muted small">{formatTime(version.createdAt)}</span>
            </button>
          </li>
        ))}
      </ol>
      {versions?.length === 0 && <p className="muted small">아직 이전 버전이 없습니다. 저장할 때마다 여기에 쌓입니다.</p>}

      {selected && (
        <div className="history-preview">
          <div className="row spread">
            <span className="muted small">{formatTime(selected.createdAt)} 버전 미리보기</span>
            <button
              type="button"
              className="primary"
              onClick={() => {
                restoreVersion(topic, selected);
                setSelectedId(null);
                onRestored();
              }}
            >
              이 버전으로 복원
            </button>
          </div>
          <h3>{selected.title}</h3>
          <LinkCards links={selected.links} />
          {selected.content ? <Markdown text={selected.content} /> : <p className="muted">(내용 없음)</p>}
        </div>
      )}
    </section>
  );
}
