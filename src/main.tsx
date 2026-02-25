/**
 * REACT ENTRY POINT
 * Initializes the React application, attaches it to the DOM, and 
 * imports global styles.
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
