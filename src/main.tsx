import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import './index.css';
import App from './App.tsx';
import { SessionBootstrap } from './components/app/SessionBootstrap';

// Prevent mouse-wheel / trackpad scroll from nudging focused number inputs (cash, prices).
document.addEventListener(
  'wheel',
  (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'number') return;
    if (document.activeElement !== target) return;
    target.blur();
  },
  { passive: true }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SessionBootstrap>
          <App />
        </SessionBootstrap>
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
