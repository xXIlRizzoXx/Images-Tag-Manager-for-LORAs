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

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
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
