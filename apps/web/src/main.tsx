import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Orden deliberado: base heredada, tokens del sistema, componentes, layout y
// por último movimiento. Cada capa solo puede afinar la anterior.
import './styles/rokai.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/polish.css';
import './styles/interactions.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el contenedor #root.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
