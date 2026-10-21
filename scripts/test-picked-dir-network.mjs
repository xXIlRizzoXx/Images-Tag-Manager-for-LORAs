/* ITALIANO: PROVA DEL PERCORSO DELLA CARTELLA SCELTA QUANDO E' UNA CARTELLA DI RETE
   "Carica cartella" su \\nas\dataset\ohwx mentre in galleria c'e' gia' una copia LOCALE della stessa
   cartella (copiata da Esplora file: stessi nomi, dimensioni e date). Mentre il selettore si chiude
   la pagina rilegge una foto della copia locale, e anche quel percorso arriva fra i candidati.
   Il percorso di rete veniva scartato PRIMA del confronto: restava solo la copia locale, che
   combaciava, e tornava come "la cartella scelta". Le foto di rete risultavano "gia' aperte" o
   ricevevano percorsi dentro la copia locale (il Cestino avrebbe toccato l'altra cartella). La regola
   "se combaciano due cartelle non torna niente" non vedeva mai la cartella di rete.
   Ora la cartella di rete entra nel confronto ma non viene mai restituita: con lei che combacia torna
   '' (seconda conferma, come per ogni cartella di rete). Casi vicini che non devono cambiare: la
   sola copia locale torna; la sola cartella di rete da' '' senza toccare la rete; una cartella
   locale scelta mentre si rilegge una cartella di rete DIVERSA torna; due copie locali uguali danno
   ''; i percorsi \\?\, \\.\, //host e con ".." restano fuori.
   Si carica il main.cjs VERO con un Electron finto; la "rete" e' una cartella temporanea: le
   letture di \\nas\... vengono girate li' (nessun accesso di rete vero).
   Uso:  node scripts/test-picked-dir-network.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PICKED FOLDER'S PATH WHEN IT IS A NETWORK FOLDER
   "Load Folder" on \\nas\dataset\ohwx while the gallery already holds a LOCAL copy of the same folder
   (copied with File Explorer: same names, sizes and dates). As the picker closes the page re-reads a
   photo of the local copy, and that path lands among the candidates too. The network path used to
   be dropped BEFORE the comparison: only the local copy was left, it matched, and it came back as
   "the picked folder". The network photos were judged "already open" or got paths inside the local
   copy. Now the network folder takes part in the comparison but is never returned: with it matching
   the answer is '' (second confirmation, as for every network folder). The REAL main.cjs is loaded
   with a fake Electron; the "network" is a temporary folder: reads of \\nas\... are redirected there. */

import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

// ITALIANO: la "rete" finta. \\nas\<resto> e //nas/<resto> vengono letti da <tmp>\nas\<resto>; si
//           annota ogni lettura di rete per sapere se il programma l'ha toccata.
// ENGLISH: the fake "network". \\nas\<rest> and //nas/<rest> are read from <tmp>\nas\<rest>; every
//          network read is recorded to know whether the program touched it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-picked-net-'));
const letturaRete = [];
const statVero = fs.statSync;
fs.statSync = function (p, ...resto) {
    if (typeof p === 'string' && /^(\\\\|\/\/)nas[\\/]/i.test(p)) {
        letturaRete.push(p);
        return statVero.call(this, path.join(tmp, 'nas', p.slice(6)), ...resto);
    }
    return statVero.call(this, p, ...resto);
};

const handlers = new Map();
const permessi = {};
const electronFinto = {
    app: {
        isPackaged: true, getLocale: () => 'en-US', getVersion: () => '0.0.0',
        getPath: () => path.join(os.tmpdir(), 'itm-test-userdata-missing'),
        requestSingleInstanceLock: () => true, quit() {}, on() {},
        whenReady: () => Promise.resolve(),
    },
    // ITALIANO: dopo whenReady main.cjs crea le finestre: qui la prima che nasce ferma il resto
    //           dell'avvio, i gestori dei permessi sono gia' registrati.
    // ENGLISH: after whenReady main.cjs creates the windows: here the first one stops the rest of
    //          the startup; the permission handlers are already registered by then.
    BrowserWindow: class { constructor() { throw new Error('test: no window'); } static getAllWindows() { return []; } },
    ipcMain: { handle: (canale, fn) => handlers.set(canale, fn), on() {} },
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
const erroriOriginali = console.error;
console.warn = () => {};
const rifiutiNonGestiti = [];
const suRifiuto = (e) => { if (!String(e && e.message).includes('test: no window')) rifiutiNonGestiti.push(e); };
process.on('unhandledRejection', suRifiuto);

// ITALIANO: una cartella con 5 png di dimensioni e date fisse (come una copia fatta da Esplora file).
// ENGLISH: a folder with 5 png of fixed sizes and dates (like a copy made with File Explorer).
const DATA = new Date('2026-05-01T10:00:00Z');
const riempi = (dir, diverso = false) => {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= 5; i++) {
        const p = path.join(dir, `img${i}.png`);
        fs.writeFileSync(p, Buffer.alloc(100 + i + (diverso ? 7 : 0)));
        fs.utimesSync(p, DATA, DATA);
    }
    return dir;
};
const prove = [1, 2, 3, 4, 5].map((i) => ({ rel: '', name: `img${i}.png`, size: 100 + i, mtime: DATA.getTime() }));

let codice = 1;
try {
    require(path.join(radice, 'electron', 'main.cjs'));
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));

    const copiaLocale = riempi(path.join(tmp, 'locale', '10_ohwx'));
    const copiaLocale2 = riempi(path.join(tmp, 'locale2', '10_ohwx'));
    const altraLocale = riempi(path.join(tmp, 'locale3', 'altro'), true);
    riempi(path.join(tmp, 'nas', 'dataset', 'ohwx'));
    riempi(path.join(tmp, 'nas', 'dati'));
    riempi(path.join(tmp, 'nas', 'altro', 'set'), true);
    const RETE = '\\\\nas\\dataset\\ohwx';

    dice('premessa: gestori dei permessi e dei due canali registrati', [true, true, true, true],
        [typeof permessi.controllo, typeof permessi.richiesta, typeof handlers.get('folder:begin-pick'), typeof handlers.get('folder:take-picked-dir')].map((t) => t === 'function'));
    dice('premessa: la rete finta risponde (\\\\nas\\dataset\\ohwx e\' una cartella)', true, fs.statSync(RETE).isDirectory());
    letturaRete.length = 0;

    // ITALIANO: una scelta: begin-pick, i controlli che Electron fa durante la scelta, poi le prove.
    // ENGLISH: one pick: begin-pick, the checks Electron runs during the pick, then the proofs.
    const scelta = async (cartelle, { richiesta = false } = {}) => {
        await handlers.get('folder:begin-pick')();
        for (const c of cartelle) {
            if (richiesta) permessi.richiesta({}, 'fileSystem', () => {}, { isDirectory: true, filePath: c });
            else permessi.controllo({}, 'fileSystem', 'file:///', { isDirectory: true, filePath: c });
        }
        return handlers.get('folder:take-picked-dir')({}, prove);
    };

    console.log('\n--- il difetto ---');
    dice('cartella di rete scelta + copia locale identica riletta: nessun percorso (seconda conferma)', '',
        await scelta([RETE, copiaLocale]));
    dice('lo stesso con la copia locale arrivata per prima', '', await scelta([copiaLocale, RETE]));
    dice('lo stesso dalla "richiesta" di permesso (prima scelta della cartella)', '', await scelta([RETE, copiaLocale], { richiesta: true }));
    dice('radice di una condivisione (\\\\nas\\dati) + copia locale identica: nessun percorso', '',
        await scelta(['\\\\nas\\dati', copiaLocale]));
    dice('radice di una condivisione con la barra finale (\\\\nas\\dati\\) + copia locale: nessun percorso', '',
        await scelta(['\\\\nas\\dati\\', copiaLocale]));

    console.log('\n--- casi vicini che non devono cambiare ---');
    dice('solo la copia locale: torna il suo percorso', copiaLocale, await scelta([copiaLocale]));
    letturaRete.length = 0;
    dice('solo la cartella di rete: nessun percorso', '', await scelta([RETE]));
    dice('solo la cartella di rete: la rete non viene nemmeno letta', [], letturaRete.slice());
    dice('cartella locale scelta mentre si rilegge una cartella di rete DIVERSA: torna la locale', copiaLocale,
        await scelta(['\\\\nas\\altro\\set', copiaLocale]));
    dice('cartella locale scelta + una locale diversa riletta: torna quella che combacia', copiaLocale,
        await scelta([altraLocale, copiaLocale]));
    dice('due copie locali identiche: nessun percorso', '', await scelta([copiaLocale, copiaLocale2]));
    dice('percorso \\\\?\\ della stessa copia: resta fuori, torna la copia', copiaLocale,
        await scelta(['\\\\?\\' + copiaLocale, copiaLocale]));
    dice('percorso \\\\.\\ della stessa copia: resta fuori, torna la copia', copiaLocale,
        await scelta(['\\\\.\\' + copiaLocale, copiaLocale]));
    dice('cartella di rete con "..": resta fuori, torna la copia', copiaLocale,
        await scelta(['\\\\nas\\x\\..\\dataset\\ohwx', copiaLocale]));
    dice('forma //nas/...: resta fuori, torna la copia', copiaLocale,
        await scelta(['//nas/dataset/ohwx', copiaLocale]));
    await handlers.get('folder:take-picked-dir')({}, prove);
    permessi.controllo({}, 'fileSystem', 'file:///', { isDirectory: true, filePath: copiaLocale });
    dice('fuori dalla finestra di scelta nessun candidato viene registrato', '', await handlers.get('folder:take-picked-dir')({}, prove));
    dice('nessun errore non gestito', [], rifiutiNonGestiti.map((e) => String(e && e.message)));
    codice = esito();
} finally {
    Module._load = caricaOriginale;
    console.warn = avvisiOriginali;
    console.error = erroriOriginali;
    process.off('unhandledRejection', suRifiuto);
    fs.statSync = statVero;
    fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(codice);
