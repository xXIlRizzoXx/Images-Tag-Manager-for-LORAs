/* ITALIANO: PROVA DELLE CARTELLE PROTETTE DA CHROMIUM (Desktop, Documenti, Download, AppData...)
   Electron 43 non apre da solo certe cartelle scelte con «Carica Cartella» o trascinate: manda al
   processo principale l'evento 'file-system-access-restricted' e aspetta la risposta 'allow',
   'deny' o 'tryAgain'. Prima nessuno lo ascoltava: la cartella non si apriva e l'utente non vedeva
   niente. Qui si carica il main.cjs VERO con un Electron finto e si pretende che:
   - l'ascoltatore sia registrato sulla sessione;
   - la risposta arrivi SEMPRE, una volta sola, anche con dati strani;
   - le cartelle dell'utente (Desktop, Documenti, Download, una cartella sotto AppData come quella
     di un kohya installato da Stability Matrix, un altro disco) si aprano;
   - Windows, Programmi, la cartella dei dati del programma, la radice di C:, la cartella utente
     intera (contiene i dati del programma) e .ssh restino chiuse, e la pagina venga avvisata
     (canale 'folder:restricted') cosi' puo' dire perche';
   - una cartella aperta cosi' entri fra le candidate di «Carica Cartella» (percorso per il Cestino).
   Niente finestre, niente rete, nessun percorso vero dell'utente: i percorsi sono finti.
   Uso:  node scripts/test-folder-restricted.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE FOLDERS CHROMIUM PROTECTS (Desktop, Documents, Downloads, AppData...)
   Electron 43 does not open some folders picked with "Load Folder" or dropped by itself: it sends
   the main process the 'file-system-access-restricted' event and waits for 'allow', 'deny' or
   'tryAgain'. Nobody listened before: the folder did not open and the user saw nothing. The REAL
   main.cjs is loaded with a fake Electron; the user's folders must open, the system and program
   folders must stay closed with the page told why, and the answer must always arrive once. */

import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

// ITALIANO: un PC finto: le cartelle di sistema vengono dalle variabili d'ambiente, la cartella dei
//           dati del programma da app.getPath('userData').
// ENGLISH: a fake PC: system folders come from the environment, the program's data folder from
//          app.getPath('userData').
const UTENTE = 'C:\\Users\\prova';
const USER_DATA = UTENTE + '\\AppData\\Roaming\\images-tag-manager';
process.env.SystemRoot = 'C:\\Windows';
process.env.windir = 'C:\\Windows';
process.env.ProgramFiles = 'C:\\Program Files';
process.env['ProgramFiles(x86)'] = 'C:\\Program Files (x86)';
process.env.ProgramW6432 = 'C:\\Program Files';
process.env.ProgramData = 'C:\\ProgramData';

const ascoltiSessione = new Map();
const handlers = new Map();
const electronFinto = {
    app: {
        isPackaged: true, getLocale: () => 'en-US', getVersion: () => '0.0.0',
        getPath: (nome) => (nome === 'userData' ? USER_DATA : path.join(os.tmpdir(), 'itm-test-userdata-missing')),
        requestSingleInstanceLock: () => true, quit() {}, on() {},
        whenReady: () => Promise.resolve(),
    },
    // ITALIANO: la prima finestra ferma il resto dell'avvio: l'ascoltatore e' gia' registrato.
    // ENGLISH: the first window stops the rest of the startup: the listener is registered by then.
    BrowserWindow: class { constructor() { throw new Error('test: no window'); } static getAllWindows() { return []; } },
    ipcMain: { handle: (canale, fn) => handlers.set(canale, fn), on() {} },
    net: { request: vietato('the network') },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: vietato('safeStorage'), decryptString: vietato('safeStorage') },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} },
        setPermissionRequestHandler() {}, setPermissionCheckHandler() {},
        on(ev, fn) { ascoltiSessione.set(ev, fn); return this; } } },
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
console.error = () => {};
const suRifiuto = (e) => { if (!String(e && e.message).includes('test: no window')) erroriOriginali('rifiuto inatteso:', e); };
process.on('unhandledRejection', suRifiuto);

let codice = 1;
let cartellaProva = null;
try {
    require(path.join(radice, 'electron', 'main.cjs'));
    await new Promise((r) => setTimeout(r, 0));

    const ascolta = ascoltiSessione.get('file-system-access-restricted');
    dice('premessa: main.cjs ascolta l\'evento file-system-access-restricted', 'function', typeof ascolta);

    // ITALIANO: una chiamata come la fa Electron; si contano le risposte e gli avvisi alla pagina.
    // ENGLISH: one call the way Electron makes it; answers and notices to the page are counted.
    const chiedi = (percorso, { isDirectory = true, dettagli } = {}) => {
        const risposte = [];
        const avvisi = [];
        const webContents = { isDestroyed: () => false, send: (canale, ...arg) => avvisi.push({ canale, arg }) };
        const d = dettagli !== undefined ? dettagli : { origin: 'file://', isDirectory, path: percorso, webContents };
        try { if (typeof ascolta === 'function') ascolta({}, d, (r) => risposte.push(r)); } catch (e) { risposte.push('ECCEZIONE: ' + e.message); }
        return { risposte, avvisi };
    };

    console.log('\n--- cartelle dell\'utente: si aprono ---');
    for (const p of [UTENTE + '\\Desktop', UTENTE + '\\Documents', UTENTE + '\\Downloads',
        UTENTE + '\\AppData\\Roaming\\StabilityMatrix\\Packages\\kohya_ss\\dataset',
        UTENTE + '\\AppData\\Local\\dataset', 'D:\\', 'D:\\Foto\\lora']) {
        const { risposte, avvisi } = chiedi(p);
        dice(`${p} -> allow, una risposta, nessun avviso`, [['allow'], 0], [risposte, avvisi.length]);
    }
    dice('un file sul Desktop (finestra Salva) -> allow', ['allow'], chiedi(UTENTE + '\\Desktop\\estensione.mcpb', { isDirectory: false }).risposte);

    console.log('\n--- cartelle di sistema e del programma: restano chiuse e la pagina sa perche\' ---');
    for (const p of ['C:\\', 'C:\\Windows', 'C:\\windows\\System32', 'C:\\Program Files\\Qualcosa',
        'C:\\Program Files (x86)', 'C:\\ProgramData\\x', USER_DATA, USER_DATA + '\\sotto',
        UTENTE + '\\AppData\\Roaming', UTENTE, 'C:\\Users', UTENTE + '\\.ssh']) {
        const { risposte, avvisi } = chiedi(p);
        dice(`${p} -> deny, una risposta, la pagina avvisata su folder:restricted`, [['deny'], ['folder:restricted']], [risposte, avvisi.map((a) => a.canale)]);
    }
    dice('un file dentro i dati del programma -> deny', ['deny'], chiedi(USER_DATA + '\\secrets.json', { isDirectory: false }).risposte);

    console.log('\n--- dati strani: la risposta arriva comunque, una volta ---');
    dice('dettagli mancanti -> deny una volta', ['deny'], chiedi('', { dettagli: null }).risposte);
    dice('percorso relativo -> deny una volta', ['deny'], chiedi('cartella\\relativa').risposte);
    dice('percorso con .. -> deny una volta', ['deny'], chiedi(UTENTE + '\\Desktop\\..\\..\\..\\Windows').risposte);
    dice('percorso device -> deny una volta', ['deny'], chiedi('\\\\?\\C:\\Windows').risposte);
    {
        const risposte = [];
        const webContents = { isDestroyed: () => false, send: () => { throw new Error('pagina chiusa'); } };
        try { ascolta && ascolta({}, { isDirectory: true, path: 'C:\\Windows', webContents }, (r) => risposte.push(r)); } catch (e) { risposte.push('ECCEZIONE'); }
        dice('pagina che non riceve l\'avviso -> deny una volta, nessuna eccezione', ['deny'], risposte);
    }

    console.log('\n--- una cartella aperta cosi\' entra fra le candidate di «Carica Cartella» ---');
    cartellaProva = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-cartella-protetta-'));
    fs.writeFileSync(path.join(cartellaProva, 'foto.png'), 'x');
    const st = fs.statSync(path.join(cartellaProva, 'foto.png'));
    await handlers.get('folder:begin-pick')();
    const { risposte } = chiedi(cartellaProva);
    dice('premessa: la cartella temporanea si apre', ['allow'], risposte);
    const preso = await handlers.get('folder:take-picked-dir')({}, [{ rel: '', name: 'foto.png', size: st.size, mtime: st.mtimeMs }]);
    dice('take-picked-dir restituisce la cartella aperta', cartellaProva, preso);

    console.log('\n--- la pagina dice all\'utente perche\' la cartella non si apre ---');
    const app = fs.readFileSync(path.join(radice, 'src', 'App.tsx'), 'utf8');
    dice('App.tsx ascolta onFolderRestricted e mostra t.folderProtected', true,
        /onFolderRestricted\?\.\(\(\) => showNotification\(t\.folderProtected, 'error'\)\)/.test(app));
    const costanti = fs.readFileSync(path.join(radice, 'src', 'constants.ts'), 'utf8');
    dice('folderProtected c\'e\' in tutte e nove le lingue', 9, (costanti.match(/^ {8}folderProtected: "/gm) || []).length);

    codice = esito();
} finally {
    Module._load = caricaOriginale;
    console.warn = avvisiOriginali;
    console.error = erroriOriginali;
    if (cartellaProva) { try { fs.rmSync(cartellaProva, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
}
process.exit(codice);
