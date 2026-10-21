/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: CONFIGURAZIONE DI COSTRUZIONE                                   **
**  Questo file spiega al computer come "impacchettare" il programma          **
**  per farlo funzionare correttamente.                                       **
**                                                                            **
**  ENGLISH: BUILD CONFIGURATION                                              **
**  This file tells the computer how to "package" the program                 **
**  to make it run correctly.                                                 **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { cspProduzione } from './scripts/csp-produzione.mjs';

export default defineConfig(() => {
  return {
    base: './',
    // ITALIANO: cspProduzione stringe il meta Content-Security-Policy di dist/index.html (solo build):
    //           l'exe apre la pagina da file://, dove l'header di main.cjs non vale.
    // ENGLISH: cspProduzione tightens dist/index.html's Content-Security-Policy meta (build only):
    //          the exe opens the page from file://, where main.cjs's header does not apply.
    plugins: [react(), tailwindcss(), cspProduzione()],
    // ITALIANO: NON iniettiamo segreti (API key) nel bundle: l'app li chiede a runtime.
    // ENGLISH: DO NOT bake secrets (API key) into the bundle; the app asks for them at runtime.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
