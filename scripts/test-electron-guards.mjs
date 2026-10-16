/* ITALIANO: PROVA DEI PERMESSI E DELLE GUARDIE DI NAVIGAZIONE DI OGNI FINESTRA (voce 23 di luglio 2026)
   1. Il processo principale concedeva alla pagina QUALUNQUE permesso (fotocamera, microfono,
      posizione, notifiche...). Ora solo i due che usa: fileSystem (finestre di file e cartelle) e
      clipboard-sanitized-write (i tasti "Copia" di MCP).
   2. Le guardie (niente navigazioni, niente finestre nuove) valevano solo per la finestra principale:
      ora ogni altra finestra (la schermata di avvio, quelle future) le ha dal momento in cui nasce,
      mentre la principale tiene le sue regole (ricaricare se' stessa).
   Si carica il main.cjs VERO con un Electron finto: niente finestre vere, niente rete.
   Uso:  node scripts/test-electron-guards.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PERMISSIONS AND OF EVERY WINDOW'S NAVIGATION GUARDS (item 23 of July 2026)
   The main process granted the page ANY permission; now only the two it uses. The guards held only
   for the main window; now every other window has them from birth, while the main one keeps its own
   rules. The REAL main.cjs is loaded with a fake Electron. */

import Module, { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

const eventiApp = new Map();
const permessi = {};
const creaEmettitore = () => {
    const ascolto = new Map();
    return {
        on(ev, fn) { if (!ascolto.has(ev)) ascolto.set(ev, []); ascolto.get(ev).push(fn); return this; },
        once(ev, fn) { return this.on(ev, fn); },
        emetti(ev, ...arg) { for (const fn of ascolto.get(ev) || []) fn(...arg); },
    };
};
const finestre = [];
class FinestraFinta {
    constructor(opzioni) {
        Object.assign(this, creaEmettitore());
        this.opzioni = opzioni;
        this.distrutta = false;
        this.indirizzo = '';
        const fin = this;
        this.webContents = Object.assign(creaEmettitore(), {
            apertura: null,
            setWindowOpenHandler(fn) { this.apertura = fn; },
            reload() {},
            getURL() { return fin.indirizzo; },
        });
        // ITALIANO: come Electron: l'evento dell'app arriva mentre la finestra nasce.
        // ENGLISH: like Electron: the app event arrives while the window is being born.
        for (const fn of eventiApp.get('web-contents-created') || []) fn({}, this.webContents);
        finestre.push(this);
    }
    loadFile(p) { this.indirizzo = pathToFileURL(p).href; }
    loadURL(u) { this.indirizzo = u; }
    show() {} maximize() {} restore() {} focus() {}
    close() { this.distrutta = true; this.emetti('closed'); }
    isDestroyed() { return this.distrutta; }
    isMinimized() { return false; }
    static getAllWindows() { return finestre.filter((f) => !f.distrutta); }
}
const electronFinto = {
    app: {
        isPackaged: true, getLocale: () => 'en-US', getVersion: () => '0.0.0',
        getPath: () => path.join(os.tmpdir(), 'itm-test-userdata-missing'),
        requestSingleInstanceLock: () => true, quit() {},
        on(ev, fn) { if (!eventiApp.has(ev)) eventiApp.set(ev, []); eventiApp.get(ev).push(fn); },
        whenReady: () => Promise.resolve(),
    },
    BrowserWindow: FinestraFinta,
    ipcMain: { handle() {}, on() {} },
    net: { request: vietato('the network') },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: vietato('safeStorage'), decryptString: vietato('safeStorage') },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} },
        setPermissionRequestHandler(fn) { permessi.richiesta = fn; }, setPermissionCheckHandler(fn) { permessi.controllo = fn; } } },
    Menu: { setApplicationMenu() {} },
    shell: { trashItem: vietato('the Recycle Bin'), openExternal: vietato('opening addresses') },
};
const cpFinto = { ...require('node:child_process'), spawn: vietato('starting programs'), exec: vietato('starting programs'), execFile: vietato('starting programs') };
const caricaOriginale = Module._load;
Module._load = function (richiesta, ...resto) {
    if (richiesta === 'electron') return electronFinto;
    if (richiesta === 'child_process' || richiesta === 'node:child_process') return cpFinto;
    return caricaOriginale.call(this, richiesta, ...resto);
};
const avvisiOriginali = console.warn;
console.warn = () => {};
let codice = 1;
try {
    require(path.join(radice, 'electron', 'main.cjs'));
    await new Promise((r) => setTimeout(r, 0));

    console.log('\n--- permessi ---');
    const chiedi = (nome, details = {}) => { let esitoRichiesta = null; permessi.richiesta({}, nome, (v) => { esitoRichiesta = v; }, details); return esitoRichiesta; };
    dice('premessa: i due gestori dei permessi sono registrati', [true, true], [typeof permessi.richiesta === 'function', typeof permessi.controllo === 'function']);
    dice('concessi: finestre di file e cartelle, copia negli appunti', [true, true], [chiedi('fileSystem'), chiedi('clipboard-sanitized-write')]);
    dice('negati: fotocamera e microfono, posizione, notifiche, lettura degli appunti', [false, false, false, false],
        ['media', 'geolocation', 'notifications', 'clipboard-read'].map((p) => chiedi(p)));
    dice('il controllo veloce dice lo stesso', [true, false], [permessi.controllo({}, 'fileSystem', '', {}), permessi.controllo({}, 'media', '', {})]);

    console.log('\n--- guardie di ogni finestra ---');
    const splash = finestre.find((f) => f.opzioni && f.opzioni.frame === false);
    const principale = finestre.find((f) => f !== splash);
    dice('premessa: schermata di avvio e finestra principale', [true, true], [Boolean(splash), Boolean(principale)]);
    const naviga = (fin, url) => { let annullata = false; fin.webContents.emetti('will-navigate', { preventDefault() { annullata = true; } }, url); return annullata; };
    dice('la schermata di avvio non naviga verso un sito', true, naviga(splash, 'https://example.com/'));
    dice('la schermata di avvio non apre finestre nuove', 'deny', splash.webContents.apertura ? splash.webContents.apertura({ url: 'https://example.com/' }).action : null);
    const altra = new FinestraFinta({ show: false });
    dice('una finestra nuova qualunque nasce gia\' con le guardie', [true, 'deny'], [naviga(altra, 'https://example.com/'), altra.webContents.apertura ? altra.webContents.apertura({ url: 'x' }).action : null]);
    dice('la principale puo\' ancora ricaricare se\' stessa', false, naviga(principale, principale.indirizzo));
    codice = esito();
} finally {
    Module._load = caricaOriginale;
    console.warn = avvisiOriginali;
}
process.exit(codice);
