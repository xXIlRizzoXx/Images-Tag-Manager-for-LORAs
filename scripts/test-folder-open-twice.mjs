/* ITALIANO: PROVA DI DUE APERTURE DI CARTELLA UNA SOPRA L'ALTRA
   Mentre il programma legge una cartella grande (con "Carica Cartella" o trascinandola) non si vede
   niente a schermo, e l'utente puo' ripetere il gesto. La seconda apertura riapriva la finestra di
   registrazione del percorso nel processo principale (beginFolderPick azzera i candidati); la prima,
   finendo, ritirava il percorso e la chiudeva, e la seconda riceveva '': le sue foto entravano
   senza percorso vero, e svuotando il cestino arrivava la seconda conferma con la cancellazione
   definitiva al posto del Cestino di Windows. La regola: finche' una cartella si sta aprendo, un
   secondo "Carica Cartella" o una seconda cartella trascinata non partono e lo si dice; finita la
   prima (bene, annullata, vuota o illeggibile) si apre di nuovo come sempre.
   Si eseguono i testi VERI presi da src/App.tsx: importaCartellaScelta, handleLoadFolderClick,
   apriCartellaTrascinata e handleDroppedFiles, con la scansione vera (src/utils/folderScan.ts) su
   cartelle finte e un processo principale finto che si comporta come quello vero.
   Uso:  node scripts/test-folder-open-twice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TWO FOLDER OPENINGS ON TOP OF EACH OTHER
   While the app reads a large folder (with "Load Folder" or by dropping it) nothing shows on screen,
   and the user may repeat the gesture. The second opening reopened the main process's path
   recording window (beginFolderPick resets the candidates); the first, on finishing, collected the
   path and closed it, and the second got '': its photos came in without a real path, and emptying
   the trash brought the second confirmation with permanent deletion instead of the Windows Recycle
   Bin. The rule: while a folder is being opened, a second "Load Folder" or a second dropped folder
   does not start and the user is told; once the first is over (fine, cancelled, empty or
   unreadable) opening works again as always.
   The REAL text taken from src/App.tsx is run: importaCartellaScelta, handleLoadFolderClick,
   apriCartellaTrascinata and handleDroppedFiles, with the real scan (src/utils/folderScan.ts) over
   fake folders and a fake main process behaving like the real one.
   Usage:  node scripts/test-folder-open-twice.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;
const { scanDirectoryHandle, fileDiMac } = await carica('src/utils/folderScan.ts');
const { dice, esito } = creaControlli();
console.warn = () => {};
console.error = () => {};

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (da, a) => {
    const i = sorgente.indexOf(da);
    const j = i < 0 ? -1 : sorgente.indexOf(a, i);
    if (i < 0 || j < 0) { console.log('NO  non trovato in src/App.tsx: ' + da.trim()); process.exit(1); }
    return sorgente.slice(i, j);
};
const pezzoCartella = ritaglia('    const importaCartellaScelta = async (', '    const handleFolderUploadFallback');
const inizioDrop = sorgente.indexOf('    const apriCartellaTrascinata = async (');
const chiusura = /\r?\n    \}, \[([^\]]*)\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizioDrop, 0);
const fineDrop = inizioDrop < 0 ? null : chiusura.exec(sorgente);
if (!fineDrop) { console.log('NO  apriCartellaTrascinata / handleDroppedFiles non trovati'); process.exit(1); }
const pezzoDrop = sorgente.slice(inizioDrop, fineDrop.index + fineDrop[0].length);
const js = (await esbuild.transform(pezzoCartella + pezzoDrop, { loader: 'ts' })).code;
const fabbrica = new Function('window', 't', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'scanDirectoryHandle',
    'useCallback', 'loadSidecarTxtFiles', 'isTagEditorOpen', 'isApiKeyDialogOpen', 'fileDiMac', 'aperturaCartellaRef',
    js + '\nreturn { handleLoadFolderClick, apriCartellaTrascinata, handleDroppedFiles };');

const OCCUPATO = t.folderOpenBusy || '(testo folderOpenBusy mancante)';
const file = (name, type) => ({ name, type, size: 10, lastModified: 1 });
const voceFile = (f) => ({ kind: 'file', name: f.name, getFile: async () => f });
// ITALIANO: una cartella la cui lettura resta sospesa finche' la prova non chiama libera().
// ENGLISH: a folder whose read stays pending until the test calls libera().
const cartella = (name, voci, { sospesa = false } = {}) => {
    let libera = () => { };
    const pronta = sospesa ? new Promise(ok => { libera = ok; }) : Promise.resolve();
    const c = {
        kind: 'directory', name, letture: 0,
        requestPermission: async () => 'granted',
        values() {
            c.letture++;
            let i = 0;
            return {
                [Symbol.asyncIterator]() { return this; },
                async next() { await pronta; return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true }; },
            };
        },
    };
    c.libera = () => libera();
    return c;
};
const fotoIn = (nome, opz) => cartella(nome, [voceFile(file(nome + '-a.jpg', 'image/jpeg')), voceFile(file(nome + '-b.png', 'image/png'))], opz);

/* ITALIANO: il processo principale finto fa come quello vero (folder:begin-pick azzera i candidati e
   apre la registrazione; folder:take-picked-dir la chiude e restituisce il percorso solo se la
   registrazione e' ancora aperta da quando la cartella e' stata letta).
   ENGLISH: the fake main process acts like the real one (folder:begin-pick resets the candidates and
   opens the recording; folder:take-picked-dir closes it and returns the path only if the recording
   is still open since the folder was read). */
const ambiente = ({ selettore = null } = {}) => {
    const r = { inizi: 0, riepiloghi: [], notifiche: [], selettori: 0, campo: 0 };
    let aperta = false, generazione = 0;
    const window = {
        showDirectoryPicker: selettore ? async () => { r.selettori++; return selettore(); } : undefined,
        electronAPI: {
            beginFolderPick: async () => { r.inizi++; aperta = true; generazione++; },
            takePickedFolderPath: async (prove) => {
                const vale = aperta && prove.length > 0;
                aperta = false;
                return vale ? 'D:\\foto\\' + generazione : '';
            },
        },
    };
    const fn = fabbrica(window, t, (m, tipo) => r.notifiche.push([m, tipo]),
        (img, txt, handle, folderOf, relPathOf, pathOf) => {
            r.riepiloghi.push({ cartella: handle ? handle.name : null, percorsi: pathOf ? img.map(f => pathOf.get(f) || '') : null });
        },
        { current: { click: () => { r.campo++; } } }, scanDirectoryHandle,
        (f) => f, async () => ({ txtFiles: [], folderOf: null }), false, false, fileDiMac, { current: false });
    return { r, ...fn };
};
const giri = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise(ok => setImmediate(ok)); };
const occupato = (r) => r.notifiche.some(([m]) => m === OCCUPATO);

console.log('\n--- "Carica Cartella" premuto di nuovo mentre la prima cartella si legge ---');
{
    const prima = fotoIn('uno', { sospesa: true });
    const seconda = fotoIn('due');
    const scelte = [prima, seconda];
    const { r, handleLoadFolderClick } = ambiente({ selettore: () => scelte.shift() });
    const lettura = handleLoadFolderClick();
    await giri();
    dice('premessa: la prima cartella si sta leggendo', 1, prima.letture);
    await handleLoadFolderClick();
    dice('la seconda apertura non riapre la registrazione del percorso', 1, r.inizi);
    dice('...non apre un altro selettore', 1, r.selettori);
    dice('...e dice che una cartella si sta ancora aprendo', true, occupato(r));
    prima.libera();
    await lettura;
    dice('la prima cartella arriva con i suoi percorsi veri', [{ cartella: 'uno', percorsi: ['D:\\foto\\1\\uno-a.jpg', 'D:\\foto\\1\\uno-b.png'] }], r.riepiloghi);
    await handleLoadFolderClick();
    dice('finita la prima, "Carica Cartella" apre di nuovo, con i percorsi veri', { cartella: 'due', percorsi: ['D:\\foto\\2\\due-a.jpg', 'D:\\foto\\2\\due-b.png'] }, r.riepiloghi[1]);
}

console.log('\n--- una cartella trascinata mentre un\'altra si legge (e viceversa) ---');
{
    const prima = fotoIn('uno', { sospesa: true });
    const { r, handleLoadFolderClick, handleDroppedFiles } = ambiente({ selettore: () => prima });
    const lettura = handleLoadFolderClick();
    await giri();
    await handleDroppedFiles([{ name: 'due', type: '' }], [Promise.resolve(fotoIn('due'))]);
    dice('cartella trascinata durante "Carica Cartella": non parte, lo si dice', [1, true], [r.inizi, occupato(r)]);
    prima.libera();
    await lettura;
    dice('...e la prima tiene il suo percorso', ['D:\\foto\\1\\uno-a.jpg', 'D:\\foto\\1\\uno-b.png'], r.riepiloghi[0]?.percorsi);
}
{
    const trascinata = fotoIn('uno', { sospesa: true });
    const { r, handleLoadFolderClick, handleDroppedFiles } = ambiente({ selettore: () => fotoIn('due') });
    const lettura = handleDroppedFiles([{ name: 'uno', type: '' }], [Promise.resolve(trascinata)]);
    await giri();
    await handleLoadFolderClick();
    await handleDroppedFiles([{ name: 'tre', type: '' }], [Promise.resolve(fotoIn('tre'))]);
    dice('"Carica Cartella" o una seconda cartella trascinata durante la lettura: non partono', [1, 0], [r.inizi, r.selettori]);
    trascinata.libera();
    await lettura;
    dice('...e la cartella trascinata tiene il suo percorso', ['D:\\foto\\1\\uno-a.jpg', 'D:\\foto\\1\\uno-b.png'], r.riepiloghi[0]?.percorsi);
}

console.log('\n--- dopo ogni modo di finire si riapre come sempre ---');
{
    let giro = 0;
    const { r, handleLoadFolderClick } = ambiente({ selettore: () => {
        giro++;
        if (giro === 1) throw Object.assign(new Error('annullata'), { name: 'AbortError' });
        if (giro === 2) return cartella('vuota', [voceFile(file('x.txt', 'text/plain'))]);
        if (giro === 3) { const c = cartella('rotta', []); c.values = () => { throw Object.assign(new Error('rotta'), { name: 'NotReadableError' }); }; return c; }
        if (giro === 4) throw Object.assign(new Error('iframe'), { name: 'SecurityError' });
        return fotoIn('buona');
    } });
    for (let i = 0; i < 5; i++) await handleLoadFolderClick();
    dice('annullata, vuota, illeggibile, ripiego del campo nascosto, poi buona: cinque aperture', [5, 5, 1], [r.inizi, r.selettori, r.campo]);
    dice('...l\'ultima arriva con i suoi percorsi', ['D:\\foto\\5\\buona-a.jpg', 'D:\\foto\\5\\buona-b.png'], r.riepiloghi.at(-1)?.percorsi);
    dice('...e nessun "si sta gia\' aprendo"', false, occupato(r));
}
{
    const { r, handleDroppedFiles } = ambiente();
    const negata = fotoIn('no');
    negata.requestPermission = async () => 'denied';
    await handleDroppedFiles([{ name: 'no', type: '' }], [Promise.resolve(negata)]);
    await handleDroppedFiles([{ name: 'si', type: '' }], [Promise.resolve(fotoIn('si'))]);
    dice('cartella trascinata senza permesso, poi un\'altra: la seconda si apre', [2, ['D:\\foto\\2\\si-a.jpg', 'D:\\foto\\2\\si-b.png'], false],
        [r.inizi, r.riepiloghi.at(-1)?.percorsi, occupato(r)]);
}

console.log('\n--- la frase nuova esiste nelle nove lingue ---');
for (const [l, testi] of Object.entries(lingue)) {
    dice(`${l}: folderOpenBusy`, true, typeof testi.folderOpenBusy === 'string' && testi.folderOpenBusy.length > 10);
}

process.exit(esito());
