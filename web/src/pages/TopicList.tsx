import { Link } from 'react-router-dom';
import { useTopics } from '../App';
import { childrenOf, reorderTopic, type Topic } from '../topics';

function snippet(topic: Topic): string {
  const line = topic.content
    .split('\n')
    .map((text) => text.replace(/^[#>\-*\s]+/, '').trim())
    .find((text) => text.length > 0);
  if (line) return line;
  return topic.links.length > 0 ? `링크 ${topic.links.length}개` : '';
}

export function TopicList({ parentId, emptyText }: { parentId: string | null; emptyText: string }) {
  const { topics } = useTopics();
  const items = childrenOf(topics, parentId);

  if (items.length === 0) return <p className="empty">{emptyText}</p>;

  return (
    <ul className="topic-list">
      {items.map((topic, index) => {
        const childCount = childrenOf(topics, topic.id).length;
        return (
          <li key={topic.id} className="topic-item">
            <Link to={`/t/${topic.id}`} className="topic-item-main">
              <span className="topic-item-title">{topic.title || '제목 없음'}</span>
              <span className="topic-item-snippet">{snippet(topic)}</span>
            </Link>
            {childCount > 0 && <span className="badge">하위 {childCount}</span>}
            <span className="reorder">
              <button
                type="button"
                aria-label="위로"
                disabled={index === 0}
                onClick={() => reorderTopic(topics, topic, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="아래로"
                disabled={index === items.length - 1}
                onClick={() => reorderTopic(topics, topic, 1)}
              >
                ↓
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
