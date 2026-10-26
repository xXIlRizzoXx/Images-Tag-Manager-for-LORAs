/*
 * ITALIANO: PONTE FINTO per le schermate del README (lo carica solo make-readme-shots.mjs).
 *   Le Impostazioni mostrano chiave, prova dei modelli e server MCP solo dentro il programma
 *   vero; qui la pagina gira nel server di sviluppo, senza processo principale. Questo ponte
 *   espone soltanto quello che serve a disegnarle: una chiave DIMOSTRATIVA (non e' una chiave
 *   Google, non apre niente) e un server MCP "acceso" che non ascolta da nessuna parte.
 *   Per lo scatto del semaforo MCP (19) lo script puo' anche fare la parte di un'AI esterna:
 *   window.__demoMcp.invia(strumento, argomenti) consegna alla pagina una richiesta MCP come
 *   farebbe il processo principale, e restituisce la risposta che la pagina manda indietro.
 *   La richiesta la esegue il codice vero del programma (src/utils/mcpBridge.ts), in memoria.
 *   Non scrive su disco e non parla con la rete.
 *
 * ENGLISH: FAKE BRIDGE for the README screenshots (loaded only by make-readme-shots.mjs).
 *   Settings show the key, the model test and the MCP server only inside the real program;
 *   here the page runs on the dev server, with no main process. This bridge exposes only what
 *   is needed to draw them: a DEMO key (not a Google key, it opens nothing) and an MCP server
 *   "switched on" that listens nowhere.
 *   For the MCP light shot (19) the script can also play the part of an external AI:
 *   window.__demoMcp.invia(tool, args) hands the page an MCP request as the main process would,
 *   and returns the answer the page sends back. The request is run by the program's real code
 *   (src/utils/mcpBridge.ts), in memory. It writes nothing to disk and talks to no network.
 */
const { contextBridge } = require('electron');

const CHIAVE_DEMO = 'AIzaDEMO-only-for-the-readme-screenshots';
let mcpAcceso = true;
const stato = () => ({ acceso: mcpAcceso, attivo: mcpAcceso, porta: 37620, codice: 'demo-token-for-screenshots', errore: '' });

// ITALIANO: chi ascolta le richieste (la pagina) e le risposte ancora attese, per numero.
// ENGLISH: who listens to the requests (the page) and the answers still awaited, by number.
const ascoltatori = new Set();
const inAttesa = new Map();
let prossimoId = 1;

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
        onRequest: (cb) => {
            ascoltatori.add(cb);
            return () => { ascoltatori.delete(cb); };
        },
        respond: (id, risposta) => {
            const fine = inAttesa.get(id);
            if (!fine) return;
            inAttesa.delete(id);
            fine(risposta);
        },
    },
});

// ITALIANO: solo per lo script delle schermate: fa la parte dell'AI esterna.
// ENGLISH: only for the screenshot script: plays the part of the external AI.
contextBridge.exposeInMainWorld('__demoMcp', {
    invia: (strumento, argomenti) => new Promise((risolvi) => {
        if (ascoltatori.size === 0) { risolvi({ errore: 'nobody is listening' }); return; }
        const id = prossimoId++;
        inAttesa.set(id, risolvi);
        for (const cb of ascoltatori) cb({ id, strumento: String(strumento), argomenti: argomenti || {} });
    }),
});
