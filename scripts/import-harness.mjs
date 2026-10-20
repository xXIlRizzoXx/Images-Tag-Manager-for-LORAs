/* ITALIANO: BANCO DI PROVA DI "IMPORTA" DEL RIEPILOGO (confermaImport + processImportData)
   Taglia dal VERO src/App.tsx confermaImport, processImportData e i pezzi che usano (asDirHandle,
   makeBackupKeyer, percorsiSuDisco) e li esegue con un'app finta, come test-import-reopen.mjs.
   Gli identificatori liberi sono passati per nome: una correzione che ne aggiunge uno a queste
   funzioni lo aggiunge anche qui.
   Non e' una prova: run-tests.mjs lancia solo i file test-*.mjs.

   ENGLISH: TEST BENCH FOR THE SUMMARY'S "IMPORT" (confermaImport + processImportData)
   Cuts confermaImport, processImportData and the pieces they use (asDirHandle, makeBackupKeyer,
   percorsiSuDisco) out of the REAL src/App.tsx and runs them with a fake app, as test-import-reopen.mjs
   does. The free identifiers are passed by name: a fix adding one to these functions adds it here too.
   Not a test: run-tests.mjs only runs test-*.mjs files. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const A = await carica('src/utils/alreadyOpen.ts');
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const N = await carica('src/utils/importNotice.ts');
export const t = (await carica('src/constants.ts')).translations.en;

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
    ritaglia(/    const confermaImport = (async )?\(\) => \{/, dentro()),
    ritaglia(/    const processImportData = async \(/, dentro()),
].join('\n');
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const NOMI = ['importSummary', 'window', 'fotoGiaAperte', 'fileGiaAperti', 'imagesRef', 'setImportSummary', 'folderInputRef', 'showNotification', 't',
    'progettoGenRef', 'importInCorsoRef', 'nuovoIdFoto', 'makeFolderKeyer', 'BACKUP_KEY_SEP',
    'globalTriggersRef', 'setImages', 'setDirHandle', 'setIsImporting', 'setImportProgress', 'folderSignature', 'backupDellImport', 'localStorage',
    'TXT_MAX_BYTES', 'parseSidecarText', 'generateThumbnail', 'tagDiImport', 'tagDaRipristinare', 'anteprimeProgettoRef', 'soundManager',
    'avvisoImport', 'console', 'URL', 'leggiTestoSidecar', 'importAttiviRef', 'ripristinoInCorsoRef', 'isUndoRedoAction', 'setHistory'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { confermaImport, processImportData };');

/* ITALIANO: l'app finta, con le foto `iniziali` gia' aperte. `percorsi` = Electron con i percorsi
   su disco (getPathForFile da' file.percorso). render(d) = le funzioni vere con il riepilogo `d`
   aperto; `riepilogoAperto` dice se "Importa" l'ha chiuso.
   ENGLISH: the fake app, with the `iniziali` photos already open. `percorsi` = Electron with paths on
   disk (getPathForFile gives file.percorso). render(d) = the real functions with summary `d` open;
   `riepilogoAperto` tells whether "Import" closed it. */
export const creaApp = ({ iniziali = [], percorsi = true } = {}) => {
    // ITALIANO: cambiStoria = gli aggiornamenti passati a setHistory, da applicare a una cronologia (vedi trash-harness).
    // ENGLISH: cambiStoria = the updates handed to setHistory, to apply to a history (see trash-harness).
    const app = { images: [...iniziali], notifiche: [], riepilogoAperto: true, passiSaltati: 0, cambiStoria: [] };
    const refs = { imagesRef: { current: app.images }, importInCorsoRef: { current: [] }, progettoGenRef: { current: 0 }, importAttiviRef: { current: 0 },
        ripristinoInCorsoRef: { current: false }, isUndoRedoAction: { current: false } };
    let id = 0;
    const finestra = percorsi ? { electronAPI: { getPathForFile: (f) => f.percorso || '' } } : {};
    const setImages = (f) => {
        // ITALIANO: come l'effetto della cronologia: un cambio con isUndoRedoAction non diventa un passo.
        // ENGLISH: like the history effect: a change with isUndoRedoAction does not become a step.
        if (refs.isUndoRedoAction.current) { refs.isUndoRedoAction.current = false; app.passiSaltati++; }
        app.images = typeof f === 'function' ? f(app.images) : f;
        refs.imagesRef.current = app.images;
    };
    app.render = (d) => fabbrica({ isOpen: true, pendingData: d }, finestra, A.fotoGiaAperte, A.fileGiaAperti, refs.imagesRef,
        (v) => { if (v && v.isOpen === false) app.riepilogoAperto = false; }, { current: null },
        (m, tipo) => app.notifiche.push([m, tipo]), t, refs.progettoGenRef, refs.importInCorsoRef, () => 'lotto' + (++id), S.makeFolderKeyer, B.BACKUP_KEY_SEP,
        { current: [] }, setImages, () => { }, () => { }, () => { },
        B.folderSignature, B.backupDellImport, { getItem: () => null }, 1024 * 1024, S.parseSidecarText,
        async () => ({ url: '', width: 1, height: 1 }), S.tagDiImport, B.tagDaRipristinare,
        { current: new Set() }, { chime() { } }, N.avvisoImport, { log() { }, warn() { }, error() { } }, { revokeObjectURL() { } }, S.leggiTestoSidecar,
        refs.importAttiviRef, refs.ripristinoInCorsoRef, refs.isUndoRedoAction, (f) => { app.cambiStoria.push(f); });
    app.refs = refs;
    // ITALIANO: "Importa" del riepilogo, fino alla fine dell'import che fa partire (se ne fa partire uno).
    // ENGLISH: the summary's "Import", until the end of the import it starts (when it starts one).
    app.conferma = async (d) => {
        const prima = refs.importAttiviRef.current;
        await app.render(d).confermaImport();
        for (let i = 0; i < 500 && refs.importAttiviRef.current > prima; i++) await new Promise(ok => setTimeout(ok, 10));
    };
    app.nomi = () => app.images.map(i => i.file.name);
    app.ultimo = () => app.notifiche[app.notifiche.length - 1];
    return app;
};
// ITALIANO: una cartella scelta col selettore (`disco` = quale cartella vera e'); removeEntry annota.
// ENGLISH: a folder picked with the picker (`disco` = which real folder it is); removeEntry records.
export const cartella = (disco, nome) => {
    const c = { disco, name: nome, rimossi: [], getFileHandle() { } };
    c.isSameEntry = async (o) => Boolean(o) && o.disco === c.disco;
    c.removeEntry = async (n) => { c.rimossi.push(n); };
    return c;
};
// ITALIANO: il riepilogo di "Carica cartella" su `h`. ENGLISH: the "Load folder" summary on `h`.
export const riepilogo = (h, nomi, { percorsi = true, dimensione = 10, data = 1000 } = {}) => {
    const imgFiles = nomi.map(n => ({ name: n, percorso: percorsi ? 'E:\\' + h.name + '\\' + n : '', size: dimensione, lastModified: data }));
    const folderOf = new Map(imgFiles.map(f => [f, h]));
    const pathOf = percorsi ? new Map(imgFiles.map(f => [f, f.percorso])) : null;
    return { imgFiles, txtFiles: [], handle: h, folderOf, relPathOf: null, pathOf, cartellaRelOf: null };
};
