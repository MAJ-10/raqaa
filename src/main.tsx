import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../assets/tokens.css';
import './ui/base.css';
import { DisplayApp } from './display/DisplayApp.tsx';
import { RefereeApp } from './referee/RefereeApp.tsx';
import { registerOffline } from './state/offline.ts';

// "#display" is the display (TV) window. Any other address is the referee window.
const isDisplay = () => location.hash === '#display';
const display = isDisplay();
document.title = display ? 'شاشة العرض · رقعة' : 'رقعة';

// A window has one role for its whole life. If its address switches role, it reloads into the new one.
addEventListener('hashchange', () => {
  if (isDisplay() !== display) location.reload();
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<StrictMode>{display ? <DisplayApp /> : <RefereeApp />}</StrictMode>);
}

registerOffline();
