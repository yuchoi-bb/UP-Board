import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTopics } from '../App';
import { descendantIds, formatTime, purgeTopic, untrashTopic } from '../topics';

export function Trash() {
  const { topics, loaded } = useTopics();
  const [busyId, setBusyId] = useState<string | null>(null);

  const trashed = topics
    .filter((topic) => topic.deletedAt)
    .sort((a, b) => b.deletedAt!.toMillis() - a.deletedAt!.toMillis());

  const purge = async (id: string, title: string) => {
    const count = descendantIds(topics, id).length;
    const detail = count > 0 ? ` 하위 토픽 ${count}개도 함께 지워집니다.` : '';
    if (!window.confirm(`"${title}" 토픽을 영구 삭제할까요?${detail} 되돌릴 수 없습니다.`)) return;
    setBusyId(id);
    try {
      await purgeTopic(topics, id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/settings">설정</Link>
      </nav>
      <h1>휴지통</h1>
      {!loaded && <p className="muted">불러오는 중…</p>}
      {loaded && trashed.length === 0 && <p className="empty">휴지통이 비어 있습니다.</p>}
      <ul className="topic-list">
        {trashed.map((topic) => (
          <li key={topic.id} className="topic-item">
            <Link to={`/t/${topic.id}`} className="topic-item-main">
              <span className="topic-item-title">{topic.title || '제목 없음'}</span>
              <span className="topic-item-snippet">{formatTime(topic.deletedAt)} 삭제</span>
            </Link>
            <button type="button" onClick={() => untrashTopic(topics, topic)}>
              되살리기
            </button>
            <button
              type="button"
              className="danger"
              disabled={busyId === topic.id}
              onClick={() => void purge(topic.id, topic.title)}
            >
              영구 삭제
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
