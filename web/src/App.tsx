import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { auth } from './firebase';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { TopicPage } from './pages/TopicPage';
import { Trash } from './pages/Trash';
import { subscribeTopics, type Topic } from './topics';

type TopicsState = { topics: Topic[]; loaded: boolean };

const TopicsContext = createContext<TopicsState>({ topics: [], loaded: false });
export const useTopics = () => useContext(TopicsContext);

function Board() {
  const [state, setState] = useState<TopicsState>({ topics: [], loaded: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeTopics(
        (topics) => setState({ topics, loaded: true }),
        (err) => setError(err.message),
      ),
    [],
  );

  return (
    <TopicsContext.Provider value={state}>
      <header className="topbar">
        <Link to="/" className="brand">
          UP-Board
        </Link>
        <Link to="/settings" className="topbar-link">
          설정
        </Link>
      </header>
      <main className="page">
        {error && <p className="notice notice-error">토픽을 불러오지 못했습니다: {error}</p>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/t/:id" element={<TopicPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="*" element={<p className="empty">없는 페이지입니다.</p>} />
        </Routes>
      </main>
    </TopicsContext.Provider>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <p className="splash">불러오는 중…</p>;
  return user ? <Board /> : <Login />;
}
