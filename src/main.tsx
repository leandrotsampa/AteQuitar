import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import { migrateLegacyPrefs } from './lib/prefs';
import './index.css';

migrateLegacyPrefs();

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>
);
