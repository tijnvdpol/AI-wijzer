import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PinGate } from './components/PinGate';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element ontbreekt');
createRoot(root).render(
  <StrictMode>
    <PinGate>
      <App />
    </PinGate>
  </StrictMode>,
);
