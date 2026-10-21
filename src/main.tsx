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
import {allineaBackupDaFile} from './utils/backupFile';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

const avvia = () => createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// ITALIANO: prima di partire il backup anti-crash torna dal file se e' piu' recente di quello del
//           localStorage (vedi utils/backupFile.ts). Se la risposta non arriva, l'app parte lo stesso.
// ENGLISH: before starting, the crash backup comes back from the file when it is newer than the
//          localStorage one (see utils/backupFile.ts). If the answer does not come, the app starts anyway.
let partita = false;
const parti = () => { if (!partita) { partita = true; avvia(); } };
const attesa = setTimeout(parti, 2000);
let veroStorage: Storage | null = null;
try { veroStorage = window.localStorage; } catch (_) { veroStorage = null; }
(veroStorage ? allineaBackupDaFile(veroStorage, (window as any).electronAPI) : Promise.resolve('invariato'))
  .catch(() => 'invariato')
  .finally(() => { clearTimeout(attesa); parti(); });
