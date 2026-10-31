import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Orden deliberado: base heredada, tokens del sistema, componentes, layout,
// movimiento y por último el vidrio. Cada capa solo puede afinar la anterior.
import './styles/rokai.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/polish.css';
import './styles/interactions.css';
import './styles/glass.css';
import './styles/ux-refinement.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el contenedor #root.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
