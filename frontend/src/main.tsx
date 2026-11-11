import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { createMockBridge } from './bridge/mock';
import { createWailsBridge, isWails } from './bridge/wails';

// Inside the desktop shell Wails injects window.go / window.runtime; in a
// plain browser (design preview, tests) the mock keeps the UI fully usable.
if (typeof window !== 'undefined' && !window.anchorBridge) {
  window.anchorBridge = isWails() ? createWailsBridge() : createMockBridge();
  document.documentElement.dataset.shell = isWails() ? 'desktop' : 'browser';
}

createRoot(document.getElementById('root')!).render(<App />);
