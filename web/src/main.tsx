import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { initFirebase } from './firebase';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

try {
  initFirebase();
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
} catch (error) {
  root.render(<p className="splash">{(error as Error).message}</p>);
}
