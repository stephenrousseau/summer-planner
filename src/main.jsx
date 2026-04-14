import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslatePolyfill } from 'mobile-drag-drop/scroll-behaviour';

import 'mobile-drag-drop/default.css';
import './index.css'
import App from './App.jsx'

// Initialize polyfill
polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslatePolyfill
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
