/* ITALIANO: PROVA: CARTELLA DI RETE \\server\condivisione APERTA IN DUE MODI DIVERSI
   "Carica cartella" su una condivisione di rete scritta per esteso non da' percorsi alle foto (il
   processo principale scarta i percorsi di rete per il Cestino): hanno solo la cartella aperta.
   "Carica immagini" e il trascinamento delle stesse foto danno il percorso di rete, ma nessuna
   cartella. Il controllo "gia' aperte" non aveva niente in comune da confrontare: ogni foto entrava
   due volte (due card, due salvataggi sullo stesso .txt), in tutti e due gli ordini. Ora, quando una
   foto ha solo il percorso e l'altra solo la cartella, sono la stessa foto se coincidono nome (senza
   maiuscole), dimensione, data di modifica e nome della cartella; l'avviso "gia' aperte" lo dice.
   Casi vicini che non devono cambiare: stessa foto ma data o dimensione diverse = entra; cartella
   con un altro nome = entra; due "Carica cartella" della stessa condivisione restano coperti dalla
   regola della cartella (test-import-reopen); foto locali con il percorso decidono col percorso.
   Si eseguono i testi VERI di confermaImport e processImportData presi da src/App.tsx (compilati con
   esbuild) con le regole vere di src/utils.
   Uso:  node scripts/test-import-network-mixed.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: NETWORK FOLDER \\server\share OPENED IN TWO DIFFERENT WAYS
   "Load folder" on a network share written out in full gives the photos no paths (the main process
   drops network paths for the Recycle Bin): they only have the open folder. "Load images" and
   dropping the same photos give the network path, but no folder. The "already open" check had
   nothing in common to compare: every photo came in twice (two cards, two saves to the same .txt),
   in both orders. Now, when one photo has only the path and the other only the folder, they are the
   same photo if name (case-insensitive), size, modified date and folder name all match; the
   "already open" notice says so.
   Neighbouring cases that must not change: same photo but a different date or size = imported;
   a folder with another name = imported; two "Load folder" of the same share stay covered by the
   folder rule (test-import-reopen); local photos with a path are decided by the path.
   The REAL texts of confermaImport and processImportData from src/App.tsx run (compiled with
   esbuild) with the real rules of src/utils.
   Usage:  node scripts/test-import-network-mixed.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const A = await carica('src/utils/alreadyOpen.ts');
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (inizioRe, chiusura) => {
    const m = inizioRe.exec(sorgente);
    if (!m) { console.log('NO  non trovato in src/App.tsx: ' + inizioRe); process.exit(1); }
    chiusura.lastIndex = m.index;
    const fine = chiusura.exec(sorgente);
    return sorgente.slice(m.index, fine.index + fine[0].length);
};
const dentro = () => /\r?\n    \};\r?\n/g;
const testo = [
    ritaglia(/const asDirHandle = /, /;\r?\n/g),
    ritaglia(/const makeBackupKeyer = /, /\r?\n\};\r?\n/g),
    ritaglia(/    const percorsiSuDisco = /, dentro()),
    ritaglia(/    const confermaImport = (async )?\([^)]*\) => \{/, dentro()),
    ritaglia(/    const processImportData = async \(/, dentro()),
].join('\n');
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const NOMI = ['importSummary', 'window', 'fotoGiaAperte', 'fileGiaAperti', 'imagesRef', 'setImportSummary', 'folderInputRef', 'showNotification', 't',
    'progettoGenRef', 'importInCorsoRef', 'nuovoIdFoto', 'makeFolderKeyer', 'BACKUP_KEY_SEP',
    'globalTriggersRef', 'setImages', 'setDirHandle', 'setIsImporting', 'setImportProgress', 'folderSignature', 'backupDellImport', 'localStorage',
    'TXT_MAX_BYTES', 'parseSidecarText', 'generateThumbnail', 'tagDiImport', 'tagDaRipristinare', 'anteprimeProgettoRef', 'soundManager',
    'avvisoImport', 'console', 'URL', 'leggiTestoSidecar', 'importAttiviRef',
    'ripristinoInCorsoRef', 'isUndoRedoAction', 'setHistory'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { confermaImport, processImportData };');

// ITALIANO: l'app finta in Electron: getPathForFile da' il percorso del file (vuoto per quelli della cartella di rete).
// ENGLISH: the fake app in Electron: getPathForFile gives the file's path (empty for the network folder's files).
const creaApp = () => {
    const app = { images: [], notifiche: [] };
    const refs = { imagesRef: { current: [] }, importInCorsoRef: { current: [] }, progettoGenRef: { current: 0 }, importAttiviRef: { current: 0 } };
    let id = 0;
    const finestra = { electronAPI: { getPathForFile: (f) => f.percorso || '' } };
    app.render = (d) => fabbrica({ isOpen: true, pendingData: d }, finestra, A.fotoGiaAperte, A.fileGiaAperti, refs.imagesRef, () => { }, { current: null },
        (m, tipo) => app.notifiche.push([m, tipo]), t, refs.progettoGenRef, refs.importInCorsoRef, () => 'lotto' + (++id), S.makeFolderKeyer, B.BACKUP_KEY_SEP,
        { current: [] }, (f) => { app.images = typeof f === 'function' ? f(app.images) : f; refs.imagesRef.current = app.images; }, () => { }, () => { }, () => { },
        B.folderSignature, B.backupDellImport, { getItem: () => null }, 1024 * 1024, S.parseSidecarText,
        async () => ({ url: '', width: 1, height: 1 }), S.tagDiImport, B.tagDaRipristinare,
        { current: new Set() }, { chime() { } }, N.avvisoImport, { log() { }, warn() { }, error() { } }, { revokeObjectURL() { } }, S.leggiTestoSidecar,
        refs.importAttiviRef, { current: false }, { current: false }, () => { });
    app.refs = refs;
    app.conferma = async (d) => {
        const prima = refs.importAttiviRef.current;
        await app.render(d).confermaImport();
        for (let i = 0; i < 500 && refs.importAttiviRef.current > prima; i++) await new Promise(ok => setTimeout(ok, 10));
    };
    app.nomi = () => app.images.map(i => i.file.name).sort();
    app.ultimo = () => app.notifiche[app.notifiche.length - 1];
    return app;
};
const cartella = (disco, nome) => ({ disco, name: nome, getFileHandle() { }, async isSameEntry(o) { return Boolean(o) && o.disco === this.disco; } });
const B2 = String.fromCharCode(92);
const UNC = B2 + B2 + 'nas' + B2 + 'share' + B2;
// ITALIANO: dimensione e data di modifica di ogni foto "sul disco".
// ENGLISH: size and modified date of every photo "on disk".
const DATI = { 'a.png': [1000, 1700000000000], 'b.png': [2000, 1700000001000] };
const file = (nome, percorso, [size, lastModified] = DATI[nome.toLowerCase()]) => ({ name: nome, percorso, size, lastModified });
// ITALIANO: "Carica cartella" sulla condivisione: nessun percorso, solo la cartella.
// ENGLISH: "Load folder" on the share: no path, only the folder.
const daCartella = (h, nomi, dati = {}) => {
    const imgFiles = nomi.map(n => file(n, '', dati[n]));
    return { imgFiles, txtFiles: [], handle: h, folderOf: new Map(imgFiles.map(f => [f, h])), relPathOf: null, pathOf: null, cartellaRelOf: null };
};
// ITALIANO: "Carica immagini" o trascinamento: il percorso di rete, nessuna cartella (folderOf ha una stringa).
// ENGLISH: "Load images" or drop: the network path, no folder (folderOf holds a string).
const daImmagini = (dir, nomi, dati = {}) => {
    const imgFiles = nomi.map(n => file(n, UNC + dir + B2 + n, dati[n]));
    return { imgFiles, txtFiles: [], handle: null, folderOf: new Map(imgFiles.map(f => [f, UNC + dir])), relPathOf: null, pathOf: null, cartellaRelOf: null };
};

console.log('\n--- prima "Carica cartella", poi "Carica immagini" delle stesse foto ---');
{
    const app = creaApp();
    await app.conferma(daCartella(cartella('NAS', 'dataset'), ['a.png', 'b.png']));
    await app.conferma(daImmagini('dataset', ['a.png', 'b.png']));
    dice('nessuna foto entra due volte', ['a.png', 'b.png'], app.nomi());
    dice('...e l\'avviso dice che erano gia\' aperte', [t.importAlreadyOpen.replace('{n}', '2'), 'info'], app.ultimo());
}

console.log('\n--- al contrario: prima "Carica immagini", poi "Carica cartella" ---');
{
    const app = creaApp();
    await app.conferma(daImmagini('dataset', ['a.png', 'b.png']));
    await app.conferma(daCartella(cartella('NAS', 'dataset'), ['A.PNG', 'b.png', 'c.png'], { 'c.png': [3000, 1700000002000] }));
    dice('entra solo c.png (A.PNG con altre maiuscole e\' la stessa foto)', ['a.png', 'b.png', 'c.png'], app.nomi());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const app = creaApp();
    await app.conferma(daCartella(cartella('NAS', 'dataset'), ['a.png', 'b.png']));
    await app.conferma(daImmagini('dataset', ['a.png', 'b.png'], { 'a.png': [1000, 1800000000000], 'b.png': [2001, 1700000001000] }));
    dice('stesso nome ma data o dimensione diverse: e\' un\'altra foto, entra', ['a.png', 'a.png', 'b.png', 'b.png'], app.nomi());
}
{
    const app = creaApp();
    await app.conferma(daCartella(cartella('NAS', 'dataset'), ['a.png']));
    await app.conferma(daImmagini('copia', ['a.png']));
    dice('stessa foto da una cartella con un altro nome: entra', ['a.png', 'a.png'], app.nomi());
}
{
    const app = creaApp();
    await app.conferma(daCartella(cartella('NAS', 'dataset'), ['a.png']));
    await app.conferma(daCartella(cartella('NAS2', 'dataset'), ['a.png']));
    dice('due "Carica cartella" di condivisioni diverse con lo stesso nome: decide la cartella, entra', ['a.png', 'a.png'], app.nomi());
}
{
    // ITALIANO: foto locali con il percorso da tutte e due le parti: decide il percorso, come prima.
    // ENGLISH: local photos with a path on both sides: the path decides, as before.
    const app = creaApp();
    const h = cartella('E:dataset', 'dataset');
    const locali = { ...daCartella(h, ['a.png']), pathOf: null };
    locali.imgFiles[0].percorso = 'E:' + B2 + 'dataset' + B2 + 'a.png';
    await app.conferma(locali);
    const altrove = daImmagini('dataset', ['a.png']);
    altrove.imgFiles[0].percorso = 'F:' + B2 + 'dataset' + B2 + 'a.png';
    await app.conferma(altrove);
    dice('stesso nome, dati e cartella ma percorso diverso: entra', ['a.png', 'a.png'], app.nomi());
}

process.exit(esito());
