import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export type TopicLink = { label: string; url: string };
export type Author = 'me' | 'ai';

export type TopicContent = { title: string; content: string; links: TopicLink[] };

export type Topic = TopicContent & {
  id: string;
  parentId: string | null;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: Author;
  updatedSummary: string;
  turnId: string | null;
  deletedAt: Timestamp | null;
};

/** 토픽의 예전 상태 한 벌. `createdAt`은 그 상태가 만들어진 시각이다. */
export type Version = TopicContent & {
  id: string;
  author: Author;
  summary: string;
  turnId: string | null;
  createdAt: Timestamp;
  archivedAt: Timestamp;
};

export const MAX_VERSIONS = 50;

const topicsCol = () => collection(db, 'topics');
const topicRef = (id: string) => doc(db, 'topics', id);
const versionsCol = (topicId: string) => collection(db, 'topics', topicId, 'versions');

export function subscribeTopics(onChange: (topics: Topic[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(
    topicsCol(),
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Topic),
      );
    },
    onError,
  );
}

export function subscribeVersions(topicId: string, onChange: (versions: Version[]) => void): () => void {
  return onSnapshot(query(versionsCol(topicId), orderBy('archivedAt', 'desc')), (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Version));
  });
}

export function childrenOf(topics: Topic[], parentId: string | null): Topic[] {
  return topics
    .filter((topic) => topic.parentId === parentId && !topic.deletedAt)
    .sort((a, b) => a.order - b.order);
}

/** 루트부터 해당 토픽까지의 경로. 토픽이 없으면 빈 배열. */
export function pathTo(topics: Topic[], id: string): Topic[] {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const path: Topic[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function descendantIds(topics: Topic[], id: string): string[] {
  const result: string[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const parent = stack.pop()!;
    for (const topic of topics) {
      if (topic.parentId === parent && !result.includes(topic.id)) {
        result.push(topic.id);
        stack.push(topic.id);
      }
    }
  }
  return result;
}

export function createTopic(parentId: string | null): string {
  const ref = doc(topicsCol());
  const batch = writeBatch(db);
  batch.set(ref, {
    title: '새 토픽',
    content: '',
    links: [],
    parentId,
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: 'me',
    updatedSummary: '생성',
    turnId: null,
    deletedAt: null,
  });
  void batch.commit();
  return ref.id;
}

/**
 * 토픽 내용을 바꾼다. 바꾸기 직전 상태를 이력에 남기므로 언제든 되돌릴 수 있다.
 * 오프라인에서도 동작하도록 서버 응답을 기다리지 않는다.
 */
export function saveTopic(topic: Topic, next: TopicContent, summary = '편집'): void {
  const batch = writeBatch(db);
  batch.set(doc(versionsCol(topic.id)), {
    title: topic.title,
    content: topic.content,
    links: topic.links,
    author: topic.updatedBy,
    summary: topic.updatedSummary,
    turnId: topic.turnId,
    createdAt: topic.updatedAt,
    archivedAt: serverTimestamp(),
  });
  batch.update(topicRef(topic.id), {
    ...next,
    updatedAt: serverTimestamp(),
    updatedBy: 'me',
    updatedSummary: summary,
    turnId: null,
  });
  void batch.commit().then(() => pruneVersions(topic.id));
}

async function pruneVersions(topicId: string): Promise<void> {
  const snapshot = await getDocs(query(versionsCol(topicId), orderBy('archivedAt', 'desc')));
  await Promise.all(snapshot.docs.slice(MAX_VERSIONS).map((d) => deleteDoc(d.ref)));
}

export function restoreVersion(topic: Topic, version: Version): void {
  const when = version.createdAt.toDate().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  saveTopic(topic, { title: version.title, content: version.content, links: version.links }, `복원 (${when} 버전)`);
}

export function moveTopic(id: string, parentId: string | null): void {
  void updateDoc(topicRef(id), { parentId, order: Date.now() });
}

/** 같은 부모 안에서 한 칸 위(-1)나 아래(+1)로 옮긴다. */
export function reorderTopic(topics: Topic[], topic: Topic, direction: -1 | 1): void {
  const siblings = childrenOf(topics, topic.parentId);
  const index = siblings.findIndex((sibling) => sibling.id === topic.id);
  const other = siblings[index + direction];
  if (!other) return;
  const batch = writeBatch(db);
  batch.update(topicRef(topic.id), { order: other.order });
  batch.update(topicRef(other.id), { order: topic.order });
  void batch.commit();
}

export function trashTopic(id: string): void {
  void updateDoc(topicRef(id), { deletedAt: serverTimestamp() });
}

/** 휴지통에서 되살린다. 상위 토픽이 없어졌거나 휴지통에 있으면 최상위로 올린다. */
export function untrashTopic(topics: Topic[], topic: Topic): void {
  const ancestors = pathTo(topics, topic.id).slice(0, -1);
  const parentReachable =
    topic.parentId === null ||
    (ancestors.length > 0 && ancestors[0].parentId === null && ancestors.every((ancestor) => !ancestor.deletedAt));
  void updateDoc(topicRef(topic.id), {
    deletedAt: null,
    ...(parentReachable ? {} : { parentId: null, order: Date.now() }),
  });
}

/** 토픽과 하위 토픽, 이력을 영구 삭제한다. 되돌릴 수 없다. */
export async function purgeTopic(topics: Topic[], id: string): Promise<void> {
  for (const targetId of [...descendantIds(topics, id), id]) {
    const versions = await getDocs(versionsCol(targetId));
    await Promise.all(versions.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(topicRef(targetId));
  }
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function formatTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
