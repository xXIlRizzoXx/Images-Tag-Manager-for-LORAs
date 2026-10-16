/* ITALIANO: PROVA DEL PULSANTE "RICARICA" DELLA SCHERMATA DI ERRORE
   Il processo principale blocca ogni navigazione della finestra (una foto trascinata sopra la
   finestra la sostituiva con l'immagine). Ma bloccava anche la pagina che ricarica se stessa: il
   pulsante "Ricarica" della schermata di errore chiama window.location.reload(), che per Electron
   e' una navigazione chiesta dalla pagina verso lo stesso indirizzo. Nell'app installata (pagina
   file://) veniva annullata e il pulsante non faceva niente: l'unica uscita era chiudere e riaprire
   il programma. In sviluppo (localhost:3000) non si vedeva. Ora passa la navigazione verso la
   pagina gia' caricata, identica; tutto il resto resta bloccato (un'altra pagina file://, una foto
   trascinata, un sito web, un indirizzo malformato).
   Si carica il main.cjs VERO con un Electron finto che "apre" finestre finte: niente compare sullo
   schermo, niente rete.
   Uso:  node scripts/test-will-navigate-reload.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE ERROR SCREEN'S "RELOAD" BUTTON
   The main process blocks every navigation of the window (a photo dropped on the window replaced it
   with the image). But it also blocked the page reloading itself: the error screen's "Reload"
   button calls window.location.reload(), which for Electron is a navigation started by the page
   towards the same address. In the installed app (file:// page) it was cancelled and the button
   did nothing: the only way out was closing and reopening the program. In development
   (localhost:3000) it never showed. Now a navigation to the page already loaded, identical, goes
   through; everything else stays blocked (another file:// page, a dropped photo, a web site, a
   malformed address).
   The REAL main.cjs is loaded with a fake Electron that "opens" fake windows: nothing appears on
   screen, no network.
   Usage:  node scripts/test-will-navigate-reload.mjs      (exits with code 1 if anything is off) */

import Module, { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

// ITALIANO: finestre finte: ricordano la pagina caricata e permettono di lanciare gli eventi.
// ENGLISH: fake windows: they remember the loaded page and let the test fire the events.
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
        this.indirizzo = '';
        const fin = this;
        this.webContents = Object.assign(creaEmettitore(), {
            setWindowOpenHandler() {},
            reload() {},
            getURL() { return fin.indirizzo; },
        });
        finestre.push(this);
    }
    loadFile(p) { this.indirizzo = pathToFileURL(p).href; }
    loadURL(u) { this.indirizzo = u; }
    show() {}
    maximize() {}
    close() { this.distrutta = true; this.emetti('closed'); }
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
    dice('c\'e\' la finestra principale, con la pagina dell\'app caricata', [true, true],
        [Boolean(principale), Boolean(principale && /\/dist\/index\.html$/.test(principale.indirizzo))]);
    // ITALIANO: annullata = true se il gestore ha chiamato preventDefault; un'eccezione conta come errore.
    // ENGLISH: annullata = true if the handler called preventDefault; an exception counts as an error.
    const naviga = (url) => {
        let annullata = false;
        let errore = null;
        try { principale.webContents.emetti('will-navigate', { preventDefault() { annullata = true; } }, url); } catch (e) { errore = String(e && e.message); }
        return [annullata, errore];
    };
    const pagina = principale.indirizzo;

    console.log('\n--- il pulsante "Ricarica" della schermata di errore (window.location.reload) ---');
    dice('la pagina che ricarica se stessa NON viene annullata', [false, null], naviga(pagina));

    console.log('\n--- tutto il resto resta bloccato ---');
    dice('una foto trascinata sulla finestra (file://)', [true, null], naviga(pathToFileURL(path.join(os.tmpdir(), 'foto.png')).href));
    dice('un\'altra pagina file:// nella stessa cartella', [true, null], naviga(pagina.replace(/index\.html$/, 'altro.html')));
    dice('la stessa pagina con un indirizzo diverso (?x=1)', [true, null], naviga(pagina + '?x=1'));
    dice('un sito web', [true, null], naviga('https://example.com/'));
    dice('localhost:3000 nell\'app installata', [true, null], naviga('http://localhost:3000/'));
    dice('un indirizzo malformato: annullato, senza errori', [true, null], naviga('non un indirizzo'));
    dice('un indirizzo vuoto', [true, null], naviga(''));
    principale.indirizzo = '';
    dice('prima che la pagina sia caricata, nemmeno un indirizzo vuoto passa', [true, null], naviga(''));

    codice = esito();
} finally {
    Module._load = caricaOriginale;
}
// ITALIANO: il cronometro di 20 secondi della finestra resta acceso: si esce subito.
// ENGLISH: the window's 20-second watchdog stays armed: exit right away.
process.exit(codice);
