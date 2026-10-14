/* ITALIANO: PROVA DELLA FINESTRA QUANDO IL PROCESSO DELLA PAGINA MUORE
   Se il processo della pagina moriva (per esempio memoria esaurita su un dataset grande), il
   processo principale chiudeva solo la schermata di avvio: la finestra restava bianca, senza un
   messaggio e senza modo di ricaricarla (in produzione il menu non c'e', quindi niente Ctrl+R), e
   le modifiche non salvate, che stanno nel salvataggio di emergenza, non tornavano finche'
   l'utente non chiudeva e riapriva il programma. Ora la pagina si ricarica da sola, una volta: la
   finestra torna usabile e, riaprendo la cartella, il salvataggio di emergenza ripropone i tag.
   Un secondo crollo entro un minuto non la ricarica di nuovo (niente giri infiniti); un'uscita
   normale ('clean-exit') o un processo chiuso apposta ('killed') non la ricaricano.
   Si carica il main.cjs VERO con un Electron finto che "apre" finestre finte: niente compare sullo
   schermo, niente rete.
   Uso:  node scripts/test-renderer-crash-reload.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE WINDOW WHEN THE PAGE PROCESS DIES
   When the page process died (for example out of memory on a big dataset), the main process only
   closed the splash screen: the window stayed blank, with no message and no way to reload it (in
   production there is no menu, so no Ctrl+R), and the unsaved edits, which sit in the crash backup,
   did not come back until the user closed and reopened the program. Now the page reloads by
   itself, once: the window is usable again and, reopening the folder, the crash backup offers the
   tags. A second crash within a minute does not reload it again (no endless loop); a normal exit
   ('clean-exit') or a process ended on purpose ('killed') does not reload it.
   The REAL main.cjs is loaded with a fake Electron that "opens" fake windows: nothing appears on
   screen, no network.
   Usage:  node scripts/test-renderer-crash-reload.mjs      (exits with code 1 if anything is off) */

import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

// ITALIANO: finestre finte: annotano cosa viene chiesto e permettono di lanciare gli eventi.
// ENGLISH: fake windows: they record what is asked and let the test fire the events.
const finestre = [];
const creaEmettitore = () => {
    const ascolto = new Map();
    return {
        on(ev, fn) { if (!ascolto.has(ev)) ascolto.set(ev, []); ascolto.get(ev).push(fn); return this; },
        once(ev, fn) { return this.on(ev, fn); },
        emetti(ev, ...arg) { for (const fn of ascolto.get(ev) || []) fn(...arg); },
    };
};
class FinestraFinta {
    constructor(opzioni) {
        Object.assign(this, creaEmettitore());
        this.opzioni = opzioni;
        this.distrutta = false;
        this.mostrata = 0;
        this.chiusa = 0;
        this.ricaricata = 0;
        const fin = this;
        this.webContents = Object.assign(creaEmettitore(), {
            setWindowOpenHandler() {},
            reload() { fin.ricaricata++; },
        });
        finestre.push(this);
    }
    loadFile() {}
    loadURL() {}
    show() { this.mostrata++; }
    maximize() {}
    close() { this.chiusa++; this.distrutta = true; this.emetti('closed'); }
    isDestroyed() { return this.distrutta; }
    isMinimized() { return false; }
    restore() {}
    focus() {}
    static getAllWindows() { return finestre.filter((f) => !f.distrutta); }
}
const electronFinto = {
    app: {
        isPackaged: true,
        getLocale: () => 'en-US',
        getVersion: () => '0.0.0',
        getPath: () => path.join(os.tmpdir(), 'itm-test-userdata-missing'),
        requestSingleInstanceLock: () => true,
        quit() {},
        on() {},
        whenReady: () => Promise.resolve(),
    },
    BrowserWindow: FinestraFinta,
    ipcMain: { handle() {}, on() {} },
    net: { request: vietato('the network') },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: vietato('safeStorage'), decryptString: vietato('safeStorage') },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} }, setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
    Menu: { setApplicationMenu() {} },
    shell: { trashItem: vietato('the Recycle Bin'), openExternal: vietato('opening addresses') },
};
const cpFinto = { ...require('node:child_process'), spawn: vietato('starting programs'), exec: vietato('starting programs'), execFile: vietato('starting programs') };

// ITALIANO: l'orologio e' finto, cosi' "un minuto dopo" non richiede di aspettare.
// ENGLISH: the clock is fake, so "a minute later" needs no waiting.
let adesso = 1_000_000;
const oraVera = Date.now;
Date.now = () => adesso;

const caricaOriginale = Module._load;
Module._load = function (richiesta, ...resto) {
    if (richiesta === 'electron') return electronFinto;
    if (richiesta === 'child_process' || richiesta === 'node:child_process') return cpFinto;
    return caricaOriginale.call(this, richiesta, ...resto);
};
let codice = 1;
try {
    require(path.join(radice, 'electron', 'main.cjs'));
    await new Promise((r) => setTimeout(r, 0));
    const splash = finestre.find((f) => f.opzioni && f.opzioni.frame === false);
    const principale = finestre.find((f) => f !== splash);
    dice('ci sono la schermata di avvio e la finestra principale', [true, true], [Boolean(splash), Boolean(principale)]);
    const crollo = (motivo) => principale.webContents.emetti('render-process-gone', {}, { reason: motivo, exitCode: 1 });

    console.log('\n--- la pagina muore prima di essere pronta (memoria esaurita) ---');
    crollo('oom');
    dice('la pagina si ricarica da sola', 1, principale.ricaricata);
    dice('la schermata di avvio si chiude e la finestra si mostra subito (non dopo 20 secondi)', [1, 1], [splash.chiusa, principale.mostrata]);

    console.log('\n--- un secondo crollo subito dopo: niente giri infiniti ---');
    adesso += 5_000;
    crollo('crashed');
    dice('non si ricarica di nuovo', 1, principale.ricaricata);

    console.log('\n--- un crollo piu\' di un minuto dopo: si ricarica ancora ---');
    adesso += 61_000;
    crollo('crashed');
    dice('si ricarica una seconda volta', 2, principale.ricaricata);
    dice('...e la finestra, gia\' visibile, non viene mostrata di nuovo', 1, principale.mostrata);

    console.log('\n--- quello che NON deve ricaricare ---');
    adesso += 120_000;
    crollo('clean-exit');
    dice('uscita normale: nessun ricaricamento', 2, principale.ricaricata);
    crollo('killed');
    dice('processo chiuso apposta: nessun ricaricamento', 2, principale.ricaricata);
    principale.distrutta = true;
    crollo('crashed');
    dice('finestra gia\' distrutta: nessun ricaricamento', 2, principale.ricaricata);

    codice = esito();
} finally {
    Module._load = caricaOriginale;
    Date.now = oraVera;
}
// ITALIANO: il cronometro di 20 secondi della finestra resta acceso: si esce subito.
// ENGLISH: the window's 20-second watchdog stays armed: exit right away.
process.exit(codice);
