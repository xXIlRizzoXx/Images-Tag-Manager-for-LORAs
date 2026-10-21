/* ITALIANO: PROVA DELLE FOTO HEIC (IPHONE) CON IL TIPO VUOTO
   Nella tabella dei tipi di Electron mancano .heic e .heif, e su molti PC Windows il registro ha solo
   "ContentType" senza spazio, che Chromium non legge: una foto .HEIC arriva con File.type vuoto. Le
   quattro strade di import decidevano "e' un'immagine?" solo da type.startsWith('image/'), quindi le
   foto dell'iPhone non entravano da nessuna parte: trascinandole compariva "Trascina immagini o una
   cartella", con "Carica immagini" "Nessuna immagine importata.", e "Carica Cartella" le saltava senza
   dire niente. Ora, con il tipo vuoto, decide l'estensione, con lo stesso elenco del processo principale.
   Si eseguono la scansione vera di src/utils/folderScan.ts e i testi VERI di handleFolderUploadFallback,
   handleImagesUpload e handleDroppedFiles presi da src/App.tsx.
   Casi vicini che non devono cambiare: un file con un tipo image/... entra anche senza estensione; un
   .txt, un .pdf o un file senza estensione con il tipo vuoto restano fuori; i ._ del Mac restano fuori.
   Uso:  node scripts/test-heic-empty-type.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF HEIC (IPHONE) PHOTOS WITH AN EMPTY TYPE
   Electron's type table lacks .heic and .heif, and on many Windows PCs the registry only has
   "ContentType" without the space, which Chromium does not read: a .HEIC photo arrives with an empty
   File.type. The four import roads decided "is it an image?" from type.startsWith('image/') alone, so
   iPhone photos came in nowhere: dropping them showed "Drop images or a folder", "Load images" said "No
   images imported.", and "Load Folder" skipped them silently. Now, with an empty type, the extension
   decides, with the same list as the main process.
   The real scan of src/utils/folderScan.ts and the REAL text of handleFolderUploadFallback,
   handleImagesUpload and handleDroppedFiles taken from src/App.tsx are run.
   Neighbouring cases that must not change: a file with an image/... type comes in even without an
   extension; a .txt, a .pdf or an extension-less file with an empty type stay out; Mac ._ files stay out.
   Usage:  node scripts/test-heic-empty-type.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const FS = await carica('src/utils/folderScan.ts');
let IF = {};
try { IF = await carica('src/utils/imageFile.ts'); } catch (_) { IF = {}; }
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();
console.warn = () => {};

const file = (name, type, rel = '') => ({ name, type, size: 10, lastModified: 1, webkitRelativePath: rel });
const voceFile = (f) => ({ kind: 'file', name: f.name, getFile: async () => f });
const voceCartella = (name, voci) => ({
    kind: 'directory', name,
    values() {
        let i = 0;
        return { [Symbol.asyncIterator]() { return this; }, async next() { return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true }; } };
    },
});

console.log('\n--- "Carica Cartella": la scansione della cartella ---');
{
    const cartella = voceCartella('iphone', [
        voceFile(file('IMG_0001.HEIC', '')), voceFile(file('IMG_0001.txt', '')), voceFile(file('IMG_0002.heif', '')),
        voceFile(file('a.png', 'image/png')), voceFile(file('nota.pdf', '')), voceFile(file('LEGGIMI', '')),
    ]);
    const r = await FS.scanDirectoryHandle(cartella);
    dice('le HEIC con il tipo vuoto entrano come foto, il .pdf e il file senza estensione no',
        [['IMG_0001.HEIC', 'IMG_0002.heif', 'a.png'], ['IMG_0001.txt']], [r.imgFiles.map(f => f.name).sort(), r.txtFiles.map(f => f.name)]);
}

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione, chiusura = /\r?\n    \};\r?\n/g) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const NOMI = ['t', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'imagesInputRef', 'loadSidecarTxtFiles', 'useCallback',
    'isTagEditorOpen', 'isApiKeyDialogOpen', 'fileDiMac', 'aiuto', 'saveCloseDialog', 'eFileImmagine'];
const fabbrica = new Function(...NOMI,
    (await ritaglia('    const handleFolderUploadFallback = async (e: any) => {')) + '\n' +
    (await ritaglia('    const handleImagesUpload = async (e: any) => {')) + '\n' +
    (await ritaglia('    const handleDroppedFiles = useCallback(', /\r?\n    \}, \[[^\]\r\n]*\]\);\r?\n/g)) +
    '\nreturn { handleFolderUploadFallback, handleImagesUpload, handleDroppedFiles };');
const app = () => {
    const r = { importate: null, notifiche: [] };
    r.f = fabbrica(t, (m, tipo) => r.notifiche.push([m, tipo]),
        (img, testi) => { r.importate = [img.map(f => f.name), testi.map(f => f.name)]; },
        { current: { value: 'x' } }, { current: { value: 'x' } }, async () => ({ txtFiles: [], folderOf: null }), (fn) => fn, false, false, FS.fileDiMac, null, { isOpen: false },
        IF.eFileImmagine);
    return r;
};

console.log('\n--- "Carica immagini", trascinamento e selettore di riserva ---');
{
    const r = app();
    await r.f.handleImagesUpload({ target: { files: [file('IMG_0001.HEIC', '')] } });
    dice('"Carica immagini": la HEIC entra (niente "Nessuna immagine importata.")', [['IMG_0001.HEIC'], []], [r.importate && r.importate[0], r.notifiche]);
    const d = app();
    await d.f.handleDroppedFiles([file('IMG_0001.HEIC', ''), file('IMG_0001.txt', 'text/plain')]);
    dice('trascinamento: la HEIC e il suo .txt entrano', [['IMG_0001.HEIC'], ['IMG_0001.txt']], d.importate);
    const w = app();
    await w.f.handleFolderUploadFallback({ target: { files: [file('IMG_0001.HEIC', '', 'iphone/IMG_0001.HEIC'), file('a.png', 'image/png', 'iphone/a.png')] } });
    dice('selettore di riserva: la HEIC entra', [['IMG_0001.HEIC', 'a.png'], []], w.importate);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const d = app();
    await d.f.handleDroppedFiles([file('nota.pdf', ''), file('LEGGIMI', '')]);
    dice('un .pdf e un file senza estensione con il tipo vuoto: "solo immagini", niente importazione', [null, [[t.dropOnlyImages, 'info']]], [d.importate, d.notifiche]);
    const m = app();
    await m.f.handleDroppedFiles([file('._IMG_0001.HEIC', '')]);
    dice('il ._ del Mac di una HEIC resta fuori', null, m.importate);
    const x = app();
    await x.f.handleImagesUpload({ target: { files: [file('incollata', 'image/png')] } });
    dice('un file con il tipo image/png entra anche senza estensione', ['incollata'], x.importate && x.importate[0]);
    const z = app();
    await z.f.handleImagesUpload({ target: { files: [file('documento.heic', 'application/pdf')] } });
    dice('con un tipo dichiarato decide il tipo, come prima', [null, [[t.noImagesTitle, 'info']]], [z.importate, z.notifiche]);
}

console.log('\n--- lo stesso elenco del processo principale ---');
{
    const main = fs.readFileSync(path.join(radice, 'electron/main.cjs'), 'utf8');
    const m = /const SIDECAR_IMAGE_EXT = new Set\(\[([^\]]*)\]\)/.exec(main);
    const delMain = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort() : null;
    dice('src/utils/imageFile.ts ha le stesse estensioni di SIDECAR_IMAGE_EXT', delMain, IF.ESTENSIONI_IMMAGINE ? [...IF.ESTENSIONI_IMMAGINE].sort() : null);
    dice('le quattro strade e l\'AI non decidono piu\' dal solo tipo', [],
        [['src/App.tsx', sorgente], ['src/utils/folderScan.ts', fs.readFileSync(path.join(radice, 'src/utils/folderScan.ts'), 'utf8')]]
            .filter(([, testo]) => /\.type\.startsWith\('image\/'\)/.test(testo)).map(([nome]) => nome));
}

process.exit(esito());
