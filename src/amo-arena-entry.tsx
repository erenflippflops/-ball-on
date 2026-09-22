import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AmoArena from './AmoArena';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmoArena />
  </StrictMode>,
);
