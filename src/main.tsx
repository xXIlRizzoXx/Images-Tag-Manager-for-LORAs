/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: PUNTO DI PARTENZA (REACT)                                       **
**  Questo è il file che avvia tutto il sistema visivo del programma.         **
**  Collega il codice alla pagina web che vedi.                               **
**                                                                            **
**  ENGLISH: REACT ENTRY POINT                                                **
**  This is the file that starts the entire visual system of the program.     **
**  It connects the code to the web page you see.                             **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
