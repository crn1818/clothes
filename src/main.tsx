import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CromaProvider } from './lib/store';
import './styles.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <CromaProvider>
      <App />
    </CromaProvider>
  </StrictMode>,
);

/* Só em produção: em desenvolvimento o service worker serviria módulos do
   cache e o HMR pararia de refletir as edições. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sem service worker o app funciona igual, só não instala nem abre offline */
    });
  });
}
