/* ITALIANO: PROVA DEI FILE NASCOSTI DEL MAC (__MACOSX, ._NOME) IN UN DATASET
   Uno .zip fatto su un Mac ed estratto con Esplora file contiene, accanto a 10_ohwx\0001.png, anche
   __MACOSX\10_ohwx\._0001.png (pochi KB di dati del Finder, non un'immagine) e spesso ._0001.txt;
   copiando da un Mac su una chiavetta i ._ restano proprio accanto ai file veri. Il programma li
   importava come foto: il conteggio raddoppiava, le card avevano l'anteprima rotta, ._0001.txt dava
   "tag" binari, "Tagga tutte con AI" sprecava richieste e Salva scriveva .txt dentro __MACOSX. La
   regola: la cartella __MACOSX e i file che iniziano con "._" non entrano, da nessuna strada
   ("Carica cartella", il selettore di riserva, "Carica immagini", il trascinamento).
   Si eseguono la scansione vera di src/utils/folderScan.ts e i testi VERI di
   handleFolderUploadFallback, handleImagesUpload e handleDroppedFiles presi da src/App.tsx.
   Uso:  node scripts/test-macosx-junk.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MAC HIDDEN FILES (__MACOSX, ._NAME) IN A DATASET
   A .zip made on a Mac and extracted with File Explorer holds, next to 10_ohwx\0001.png, also
   __MACOSX\10_ohwx\._0001.png (a few KB of Finder data, not an image) and often ._0001.txt; copying
   from a Mac onto a USB stick leaves the ._ files right next to the real ones. The program imported
   them as photos: the count doubled, the cards had broken thumbnails, ._0001.txt gave binary
   "tags", "Auto-tag all with AI" wasted requests and Save wrote .txt files into __MACOSX. The rule:
   the __MACOSX folder and files starting with "._" do not come in, by any road ("Load folder", the
   fallback picker, "Load images", drag and drop).
   The real scan of src/utils/folderScan.ts and the REAL text of handleFolderUploadFallback,
   handleImagesUpload and handleDroppedFiles taken from src/App.tsx are run.
   Usage:  node scripts/test-macosx-junk.mjs      (exits with code 1 if anything is off) */

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
// ITALIANO: la regola vera di "e' un'immagine?" (src/utils/imageFile.ts), che le strade di import usano.
// ENGLISH: the real "is it an image?" rule (src/utils/imageFile.ts), which the import roads use.
const IF = await carica('src/utils/imageFile.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();
console.warn = () => {};

// --- cartelle finte della File System Access API
const file = (name, type, rel = '') => ({ name, type, size: 10, lastModified: 1, webkitRelativePath: rel });
const voceFile = (f) => ({ kind: 'file', name: f.name, getFile: async () => f });
const voceCartella = (name, voci) => ({
    kind: 'directory', name,
    values() {
        let i = 0;
        return { [Symbol.asyncIterator]() { return this; }, async next() { return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true }; } };
    },
});
const png = (n) => file(n, 'image/png');
const txt = (n) => file(n, 'text/plain');

console.log('\n--- "Carica cartella": dataset estratto da uno .zip del Mac ---');
{
    const cartella = voceCartella('ds', [
        voceCartella('10_ohwx', [voceFile(png('0001.png')), voceFile(txt('0001.txt')), voceFile(png('._0001.png')), voceFile(txt('._0001.txt'))]),
        voceCartella('__MACOSX', [voceCartella('10_ohwx', [voceFile(png('._0001.png')), voceFile(txt('._0001.txt')), voceFile(png('0002.png'))])]),
        voceCartella('__macosx', [voceFile(png('0003.png'))]),
    ]);
    const r = typeof FS.scanDirectoryHandle === 'function' ? await FS.scanDirectoryHandle(cartella) : { imgFiles: [], txtFiles: [], skipped: -1 };
    dice('si importano solo la foto e il .txt veri', [['0001.png'], ['0001.txt']], [r.imgFiles.map(f => f.name), r.txtFiles.map(f => f.name)]);
    dice('...e non contano come "voci illeggibili"', 0, r.skipped);
}

console.log('\n--- la regola da sola ---');
{
    const M = FS.fileDiMac;
    dice('src/utils/folderScan.ts esporta fileDiMac', 'function', typeof M);
    if (typeof M === 'function') {
        dice('"._0001.png" e "._0001.txt" sono file del Mac', [true, true], [M('._0001.png'), M('._0001.txt')]);
        dice('qualunque cosa sotto __MACOSX (anche minuscolo) e\' del Mac', [true, true], [M('0002.png', 'ds/__MACOSX/10_ohwx/0002.png'), M('a.png', 'ds\\__macosx\\a.png')]);
        dice('nomi veri restano: "0001.png", "_0001.png", "a._b.png", "MACOSX_set/a.png"', [false, false, false, false],
            [M('0001.png', 'ds/10_ohwx/0001.png'), M('_0001.png'), M('a._b.png'), M('a.png', 'MACOSX_set/a.png')]);
    }
}

// --- i gestori veri di App.tsx
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
        { current: { value: 'x' } }, { current: { value: 'x' } }, async () => ({ txtFiles: [], folderOf: null }), (fn) => fn, false, false, FS.fileDiMac, null, { isOpen: false }, IF.eFileImmagine);
    return r;
};

console.log('\n--- il selettore di cartella di riserva (webkitdirectory) ---');
{
    const r = app();
    await r.f.handleFolderUploadFallback({ target: { files: [
        file('0001.png', 'image/png', 'ds/10_ohwx/0001.png'), file('0001.txt', 'text/plain', 'ds/10_ohwx/0001.txt'),
        file('._0001.png', 'image/png', 'ds/10_ohwx/._0001.png'),
        file('0002.png', 'image/png', 'ds/__MACOSX/10_ohwx/0002.png'), file('._0001.txt', 'text/plain', 'ds/__MACOSX/10_ohwx/._0001.txt')] } });
    dice('solo la foto e il .txt veri', [['0001.png'], ['0001.txt']], r.importate);
}

console.log('\n--- "Carica immagini" e trascinamento ---');
{
    const r = app();
    await r.f.handleImagesUpload({ target: { files: [png('0001.png'), png('._0001.png')] } });
    dice('"Carica immagini": il ._ resta fuori', ['0001.png'], r.importate && r.importate[0]);
    const d = app();
    await d.f.handleDroppedFiles([png('0001.png'), png('._0001.png'), txt('0001.txt'), txt('._0001.txt')]);
    dice('trascinamento: i ._ restano fuori', [['0001.png'], ['0001.txt']], d.importate);
    const solo = app();
    await solo.f.handleDroppedFiles([png('._0001.png')]);
    dice('solo file del Mac trascinati: "solo immagini", niente importazione', [null, [[t.dropOnlyImages, 'info']]], [solo.importate, solo.notifiche]);
}

process.exit(esito());
