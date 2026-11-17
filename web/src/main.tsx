import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { initFirebase } from './firebase';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

initFirebase().then(
  () =>
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    ),
  (error: Error) => root.render(<p className="splash">{error.message}</p>),
);
