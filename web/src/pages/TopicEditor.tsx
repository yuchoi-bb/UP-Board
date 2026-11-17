import { useState, type FormEvent } from 'react';
import { useTopics } from '../App';
import {
  descendantIds,
  moveTopic,
  normalizeUrl,
  pathTo,
  saveTopic,
  type Topic,
  type TopicLink,
} from '../topics';

export function TopicEditor({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const { topics } = useTopics();
  const [title, setTitle] = useState(topic.title);
  const [content, setContent] = useState(topic.content);
  const [links, setLinks] = useState<TopicLink[]>(topic.links);
  const [parentId, setParentId] = useState<string | null>(topic.parentId);
  const [error, setError] = useState<string | null>(null);

  const excluded = new Set([topic.id, ...descendantIds(topics, topic.id)]);
  const parentOptions = topics
    .filter((candidate) => !excluded.has(candidate.id) && !candidate.deletedAt)
    .map((candidate) => ({
      id: candidate.id,
      label: pathTo(topics, candidate.id)
        .map((step) => step.title || '제목 없음')
        .join(' › '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  const setLink = (index: number, patch: Partial<TopicLink>) =>
    setLinks(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleaned: TopicLink[] = [];
    for (const link of links) {
      if (!link.url.trim() && !link.label.trim()) continue;
      const url = normalizeUrl(link.url);
      if (!url) {
        setError(`링크 주소가 올바르지 않습니다: ${link.url || link.label}`);
        return;
      }
      cleaned.push({ label: link.label.trim(), url });
    }
    const next = { title: title.trim() || '제목 없음', content, links: cleaned };
    const changed =
      next.title !== topic.title ||
      next.content !== topic.content ||
      JSON.stringify(next.links) !== JSON.stringify(topic.links);
    if (changed) saveTopic(topic, next);
    if (parentId !== topic.parentId) moveTopic(topic.id, parentId);
    onClose();
  };

  return (
    <form className="editor" onSubmit={submit}>
      <label>
        제목
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </label>

      <label>
        내용 <span className="muted small">마크다운을 쓸 수 있습니다</span>
        <textarea rows={14} value={content} onChange={(event) => setContent(event.target.value)} />
      </label>

      <fieldset>
        <legend>링크</legend>
        {links.map((link, index) => (
          <div className="link-row" key={index}>
            <input
              type="text"
              placeholder="이름"
              aria-label="링크 이름"
              value={link.label}
              onChange={(event) => setLink(index, { label: event.target.value })}
            />
            <input
              type="text"
              inputMode="url"
              placeholder="https://"
              aria-label="링크 주소"
              value={link.url}
              onChange={(event) => setLink(index, { url: event.target.value })}
            />
            <button type="button" aria-label="링크 삭제" onClick={() => setLinks(links.filter((_, i) => i !== index))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLinks([...links, { label: '', url: '' }])}>
          링크 추가
        </button>
      </fieldset>

      <label>
        상위 토픽
        <select value={parentId ?? ''} onChange={(event) => setParentId(event.target.value || null)}>
          <option value="">(최상위)</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="notice notice-error">{error}</p>}

      <div className="row">
        <button type="submit" className="primary">
          저장
        </button>
        <button type="button" onClick={onClose}>
          취소
        </button>
      </div>
    </form>
  );
}
