/* ITALIANO: PROVA DELLA FINESTRA QUANDO IL PROCESSO DELLA PAGINA MUORE
   Se il processo della pagina moriva (per esempio memoria esaurita su un dataset grande), il
   processo principale chiudeva solo la schermata di avvio: la finestra restava bianca, senza un
   messaggio e senza modo di ricaricarla (in produzione il menu non c'e', quindi niente Ctrl+R), e
   le modifiche non salvate, che stanno nel salvataggio di emergenza, non tornavano finche'
   l'utente non chiudeva e riapriva il programma. Ora la pagina si ricarica da sola, una volta: la
   finestra torna usabile e, riaprendo la cartella, il salvataggio di emergenza ripropone i tag.
   Un secondo crollo entro un minuto non la ricarica subito (niente giri infiniti), ma alla fine
   del minuto: prima veniva ignorato e la finestra restava bianca per sempre. Un solo
   ricaricamento in attesa, annullato se la finestra si chiude prima. Un'uscita
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
   tags. A second crash within a minute does not reload it at once (no endless loop) but at the end of
   the minute: it used to be ignored and the window stayed blank for good. Only one reload is
   pending, cancelled if the window closes first. A normal exit
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
    // ITALIANO: i cronometri messi da qui in poi sono finti: si annotano e si fanno scattare a mano.
    //           Quelli veri gia' accesi (il cronometro di 20 secondi) passano a clearTimeout vero.
    // ENGLISH: timers set from here on are fake: they are recorded and fired by hand. The real
    //          ones already armed (the 20-second watchdog) go to the real clearTimeout.
    const cronometri = [];
    const setTimeoutVero = globalThis.setTimeout;
    const clearTimeoutVero = globalThis.clearTimeout;
    globalThis.setTimeout = (fn, ms) => { const c = { fn, ms, annullato: false, scattato: false }; cronometri.push(c); return c; };
    globalThis.clearTimeout = (c) => { if (cronometri.includes(c)) c.annullato = true; else clearTimeoutVero(c); };
    const inAttesa = () => cronometri.filter((c) => !c.annullato && !c.scattato);
    const scatta = (c) => { if (c) { c.scattato = true; c.fn(); } };
    try {

    console.log('\n--- la pagina muore prima di essere pronta (memoria esaurita) ---');
    crollo('oom');
    dice('la pagina si ricarica da sola', 1, principale.ricaricata);
    dice('la schermata di avvio si chiude e la finestra si mostra subito (non dopo 20 secondi)', [1, 1], [splash.chiusa, principale.mostrata]);

    console.log('\n--- un secondo crollo subito dopo: niente giri infiniti, ma nemmeno finestra bianca per sempre ---');
    adesso += 5_000;
    crollo('crashed');
    dice('non si ricarica subito', 1, principale.ricaricata);
    dice('...ma un ricaricamento aspetta la fine del minuto (55 secondi)', [1, 55_000], [inAttesa().length, inAttesa()[0] && inAttesa()[0].ms]);
    adesso += 5_000;
    crollo('crashed');
    dice('un terzo crollo mentre aspetta non ne aggiunge un altro', [1, 1], [inAttesa().length, principale.ricaricata]);
    adesso += 50_000;
    scatta(inAttesa()[0]);
    dice('alla fine del minuto la pagina si ricarica', 2, principale.ricaricata);
    dice('...e non resta niente in attesa', 0, inAttesa().length);

    console.log('\n--- un crollo piu\' di un minuto dopo: si ricarica ancora, subito ---');
    adesso += 61_000;
    crollo('crashed');
    dice('si ricarica una terza volta', 3, principale.ricaricata);
    dice('...senza aspettare', 0, inAttesa().length);
    dice('...e la finestra, gia\' visibile, non viene mostrata di nuovo', 1, principale.mostrata);

    console.log('\n--- quello che NON deve ricaricare ---');
    adesso += 120_000;
    crollo('clean-exit');
    dice('uscita normale: nessun ricaricamento', 3, principale.ricaricata);
    crollo('killed');
    dice('processo chiuso apposta: nessun ricaricamento', 3, principale.ricaricata);
    dice('...e niente in attesa', 0, inAttesa().length);
    principale.distrutta = true;
    crollo('crashed');
    dice('finestra gia\' distrutta: nessun ricaricamento', [3, 0], [principale.ricaricata, inAttesa().length]);
    principale.distrutta = false;
    crollo('crashed');
    dice('(di nuovo viva: si ricarica subito)', 4, principale.ricaricata);
    adesso += 1_000;
    crollo('crashed');
    principale.distrutta = true;
    scatta(inAttesa()[0]);
    dice('finestra distrutta prima della fine del minuto: nessun ricaricamento', 4, principale.ricaricata);
    principale.distrutta = false;
    adesso += 1_000;
    crollo('crashed');
    const pendente = inAttesa()[0];
    dice('(un ricaricamento in attesa)', true, Boolean(pendente));
    principale.close();
    dice('la finestra si chiude: il ricaricamento in attesa si annulla', [true, 0], [Boolean(pendente && pendente.annullato), inAttesa().length]);
    let errore = null;
    try { if (pendente) pendente.fn(); } catch (e) { errore = e; }
    dice('...e anche se scattasse non ricarica niente e non si rompe', [4, null], [principale.ricaricata, errore]);

    codice = esito();
    } finally {
        globalThis.setTimeout = setTimeoutVero;
        globalThis.clearTimeout = clearTimeoutVero;
    }
} finally {
    Module._load = caricaOriginale;
    Date.now = oraVera;
}
// ITALIANO: il cronometro di 20 secondi della finestra resta acceso: si esce subito.
// ENGLISH: the window's 20-second watchdog stays armed: exit right away.
process.exit(codice);
