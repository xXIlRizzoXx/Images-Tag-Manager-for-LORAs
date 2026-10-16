/*
 * ITALIANO: PONTE FINTO per le schermate del README (lo carica solo make-readme-shots.mjs).
 *   Le Impostazioni mostrano chiave, prova dei modelli e server MCP solo dentro il programma
 *   vero; qui la pagina gira nel server di sviluppo, senza processo principale. Questo ponte
 *   espone soltanto quello che serve a disegnarle: una chiave DIMOSTRATIVA (non e' una chiave
 *   Google, non apre niente) e un server MCP "acceso" che non ascolta da nessuna parte.
 *   Non scrive su disco e non parla con la rete.
 *
 * ENGLISH: FAKE BRIDGE for the README screenshots (loaded only by make-readme-shots.mjs).
 *   Settings show the key, the model test and the MCP server only inside the real program;
 *   here the page runs on the dev server, with no main process. This bridge exposes only what
 *   is needed to draw them: a DEMO key (not a Google key, it opens nothing) and an MCP server
 *   "switched on" that listens nowhere. It writes nothing to disk and talks to no network.
 */
const { contextBridge } = require('electron');

const CHIAVE_DEMO = 'AIzaDEMO-only-for-the-readme-screenshots';
let mcpAcceso = true;
const stato = () => ({ acceso: mcpAcceso, attivo: mcpAcceso, porta: 37620, codice: 'demo-token-for-screenshots', errore: '' });

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    secureStorage: {
        get: async (k) => (k === 'geminiApiKey' ? CHIAVE_DEMO : ''),
        set: async () => true,
        delete: async () => true,
    },
    mcp: {
        getStatus: async () => stato(),
        setEnabled: async (v) => { mcpAcceso = v === true; return stato(); },
        newToken: async () => stato(),
        onRequest: () => () => { },
        respond: () => { },
    },
});
