import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTopics } from '../App';
import { createTopic, formatTime, pathTo, trashTopic, untrashTopic } from '../topics';
import { History } from './History';
import { LinkCards, Markdown } from './Markdown';
import { TopicEditor } from './TopicEditor';
import { TopicList } from './TopicList';

export function TopicPage() {
  const { id = '' } = useParams();
  const { topics, loaded } = useTopics();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showHistory, setShowHistory] = useState(false);

  const topic = topics.find((candidate) => candidate.id === id);
  const editing = params.get('edit') === '1';

  if (!loaded) return <p className="muted">불러오는 중…</p>;
  if (!topic) return <p className="empty">없는 토픽입니다.</p>;

  const path = pathTo(topics, topic.id);
  const parent = path.length > 1 ? path[path.length - 2] : null;

  const remove = () => {
    trashTopic(topic.id);
    navigate(parent ? `/t/${parent.id}` : '/');
  };

  return (
    <article key={topic.id}>
      <nav className="breadcrumb" aria-label="경로">
        <Link to="/">토픽</Link>
        {path.slice(0, -1).map((step) => (
          <span key={step.id}>
            {' › '}
            <Link to={`/t/${step.id}`}>{step.title || '제목 없음'}</Link>
          </span>
        ))}
      </nav>

      {topic.deletedAt && (
        <p className="notice">
          휴지통에 있는 토픽입니다.{' '}
          <button type="button" className="link" onClick={() => untrashTopic(topics, topic)}>
            되살리기
          </button>
        </p>
      )}

      {editing ? (
        <TopicEditor topic={topic} onClose={() => setParams({}, { replace: true })} />
      ) : (
        <>
          <div className="page-head">
            <h1>{topic.title || '제목 없음'}</h1>
            <button type="button" className="primary" onClick={() => setParams({ edit: '1' })}>
              편집
            </button>
          </div>
          <p className="muted small">
            {formatTime(topic.updatedAt)} · {topic.updatedBy === 'ai' ? 'AI' : '나'} · {topic.updatedSummary}
          </p>

          <LinkCards links={topic.links} />
          {topic.content && <Markdown text={topic.content} />}

          <section>
            <div className="page-head">
              <h2>하위 토픽</h2>
              <button type="button" onClick={() => navigate(`/t/${createTopic(topic.id)}?edit=1`)}>
                하위 토픽 추가
              </button>
            </div>
            <TopicList parentId={topic.id} emptyText="하위 토픽이 없습니다." />
          </section>

          <div className="row topic-actions">
            <button type="button" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? '이력 닫기' : '변경 이력'}
            </button>
            {!topic.deletedAt && (
              <button type="button" className="danger" onClick={remove}>
                휴지통으로
              </button>
            )}
          </div>

          {showHistory && <History topic={topic} onRestored={() => setShowHistory(true)} />}
        </>
      )}
    </article>
  );
}
