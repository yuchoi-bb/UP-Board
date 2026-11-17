import { useNavigate } from 'react-router-dom';
import { useTopics } from '../App';
import { createTopic } from '../topics';
import { TopicList } from './TopicList';

export function Home() {
  const { loaded } = useTopics();
  const navigate = useNavigate();

  return (
    <>
      <div className="page-head">
        <h1>토픽</h1>
        <button type="button" className="primary" onClick={() => navigate(`/t/${createTopic(null)}?edit=1`)}>
          새 토픽
        </button>
      </div>
      {loaded ? (
        <TopicList parentId={null} emptyText="아직 토픽이 없습니다. 첫 토픽을 만들어 보세요." />
      ) : (
        <p className="muted">불러오는 중…</p>
      )}
    </>
  );
}
