/* ITALIANO: PROVA DELLE SOTTOCARTELLE KOHYA IN "Esporta (.zip)" COI NOMI ORIGINALI
   Dataset aperto con "Carica cartella": 10_face/a.png, 10_face/img.png, 20_body/b.png,
   20_body/img.png. L'archivio conteneva a, img, b alla radice e solo 20_body/img in una cartella:
   sd-scripts (train_data_dir) legge solo le sottocartelle N_nome, quindi le foto alla radice
   venivano ignorate, i numeri di ripetizioni dei nomi delle cartelle andavano persi, e una
   cartella mezza vuota non si capiva. Ora ogni foto aperta con "Carica cartella" ricorda la sua
   sottocartella rispetto a quella scelta, e l'archivio la rimette: 10_face/a.txt, 20_body/b.txt...
   Le foto senza cartella (o alla radice) restano alla radice come prima; rinominando in sequenza
   (0001, 0002...) ogni foto numerata resta nella sua sottocartella (10_face/0001.png).
   Si eseguono i testi VERI presi da src/App.tsx: handleLoadFolderClick, handleFolderUploadFallback,
   processImportData (cosa ricorda ogni foto) e l'esportazione (export-harness.mjs).
   Uso:  node scripts/test-export-subfolders.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF KOHYA SUBFOLDERS IN "Export (.zip)" WITH THE ORIGINAL NAMES
   Dataset opened with "Load folder": 10_face/a.png, 10_face/img.png, 20_body/b.png,
   20_body/img.png. The archive held a, img, b at the root and only 20_body/img in a folder:
   sd-scripts (train_data_dir) only reads N_name subfolders, so the root photos were ignored, the
   repeat counts in the folder names were lost, and a half-empty folder made no sense. Now every
   photo opened with "Load folder" remembers its subfolder relative to the picked one, and the
   archive puts it back: 10_face/a.txt, 20_body/b.txt... Photos with no folder (or at the root)
   stay at the root as before; renaming in sequence (0001, 0002...) keeps every numbered photo in
   its subfolder (10_face/0001.png).
   The REAL text taken from src/App.tsx is run: handleLoadFolderClick, handleFolderUploadFallback,
   processImportData (what each photo remembers) and the export (export-harness.mjs).
   Usage:  node scripts/test-export-subfolders.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, t } from './export-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const N = await carica('src/utils/importNotice.ts');
const { scanDirectoryHandle, fileDiMac } = await carica('src/utils/folderScan.ts');
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione, fino = null) => {
    const inizio = sorgente.indexOf(intestazione);
    let fineIdx = -1;
    if (inizio >= 0 && fino) fineIdx = sorgente.indexOf(fino, inizio);
    else if (inizio >= 0) {
        const chiusura = /\r?\n    \};\r?\n/g;
        chiusura.lastIndex = inizio;
        const m = chiusura.exec(sorgente);
        if (m) fineIdx = m.index + m[0].length;
    }
    if (inizio < 0 || fineIdx < 0) {
        console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fineIdx), { loader: 'ts' })).code;
};

// ITALIANO: la sottocartella che ogni foto ricorda, letta dall'ultimo argomento passato al
//           riepilogo di import (il passo prima di processImportData).
// ENGLISH: the subfolder each photo remembers, read from the last argument handed to the import
//          summary (the step before processImportData).
const relDa = (argomenti) => {
    const mappa = argomenti && argomenti[6];
    return (file) => (mappa && typeof mappa.get === 'function' ? (mappa.get(file) ?? null) : null);
};

console.log('\n--- "Carica cartella": ogni foto ricorda la sua sottocartella ---');
{
    const fabbrica = new Function('window', 't', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'scanDirectoryHandle',
        (await ritaglia('    const handleLoadFolderClick = async () => {', '    const handleFolderUploadFallback')) + '\nreturn handleLoadFolderClick;');
    const file = (name) => ({ name, type: 'image/png', size: 10, lastModified: 1 });
    const voceFile = (f) => ({ kind: 'file', name: f.name, getFile: async () => f });
    const voceCartella = (name, voci) => ({
        kind: 'directory', name,
        values() { let i = 0; return { [Symbol.asyncIterator]() { return this; }, async next() { return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true }; } }; },
    });
    const radiceF = file('cover.png'), a = file('a.png'), b = file('b.png'), c = file('c.png');
    let argomenti = null;
    const window = {
        showDirectoryPicker: async () => voceCartella('dataset', [voceFile(radiceF), voceCartella('10_face', [voceFile(a)]), voceCartella('20_body', [voceFile(b), voceCartella('extra', [voceFile(c)])])]),
        electronAPI: { beginFolderPick: async () => { }, takePickedFolderPath: async () => '' },
    };
    await fabbrica(window, t, () => { }, (...x) => { argomenti = x; }, { current: { click() { } } }, scanDirectoryHandle)();
    const rel = relDa(argomenti);
    dice('dataset/cover.png -> "" (radice), 10_face/a.png -> "10_face", 20_body/extra/c.png -> "20_body/extra"',
        ['', '10_face', '20_body', '20_body/extra'], [rel(radiceF), rel(a), rel(b), rel(c)]);
}

console.log('\n--- il ripiego del browser (webkitdirectory) fa lo stesso ---');
{
    const fabbrica = new Function('t', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'fileDiMac',
        (await ritaglia('    const handleFolderUploadFallback = async (e: any) => {')) + '\nreturn handleFolderUploadFallback;');
    let argomenti = null;
    const files = [['dataset/cover.png'], ['dataset/10_face/a.png'], ['dataset/20_body/extra/c.png']]
        .map(([p]) => ({ name: p.split('/').pop(), type: 'image/png', webkitRelativePath: p }));
    await fabbrica(t, () => { }, (...x) => { argomenti = x; }, { current: { value: '' } }, fileDiMac)({ target: { files } });
    const rel = relDa(argomenti);
    dice('"", "10_face", "20_body/extra"', ['', '10_face', '20_body/extra'], files.map(rel));
}

console.log('\n--- processImportData mette la sottocartella sulla foto ---');
{
    const NOMI = ['globalTriggers', 'globalTriggersRef', 'images', 'setImages', 'setGlobalTriggers', 'uniqueTagsIgnoringCase',
        'setImportSummary', 'setDirHandle', 'setIsImporting', 'setImportProgress', 'folderSignature', 'nuovoIdFoto', 'backupDellImport',
        'localStorage', 'makeFolderKeyer', 'makeBackupKeyer', 'TXT_MAX_BYTES', 'parseSidecarText', 'generateThumbnail', 'tagDiImport',
        'tagDaRipristinare', 'asDirHandle', 'anteprimeProgettoRef', 'soundManager', 'avvisoImport', 't', 'showNotification',
        'folderInputRef', 'console', 'importAttiviRef'];
    const fabbrica = new Function(...NOMI, (await ritaglia('    const processImportData = async (')) + '\nreturn processImportData;');
    let immagini = [];
    let id = 0;
    const fn = fabbrica([], { current: [] }, [], (f) => { immagini = typeof f === 'function' ? f(immagini) : f; }, () => { }, (x) => x,
        () => { }, () => { }, () => { }, () => { }, B.folderSignature, () => 'id' + (++id), B.backupDellImport,
        { getItem: () => null }, S.makeFolderKeyer, () => (f) => 'dataset\x1f' + f.name, 1024 * 1024, S.parseSidecarText,
        async () => ({ url: 'blob:finto', width: 1, height: 1 }), S.tagDiImport, B.tagDaRipristinare, () => null,
        { current: new Set() }, { chime() { } }, N.avvisoImport, t, () => { }, { current: null }, { log() { }, warn() { }, error() { } }, { current: 0 });
    const a = { name: 'a.png' }, r = { name: 'r.png' };
    await fn([a, r], [], { name: 'dataset' }, new Map(), null, null, new Map([[a, '10_face'], [r, '']]));
    dice('a.png ricorda "10_face", r.png (radice) ""', ['10_face', ''], immagini.map(i => (typeof i.cartellaRel === 'string' ? i.cartellaRel : null)));
    immagini = [];
    await fn([{ name: 'z.png' }], []);
    dice('"Carica immagini" (nessuna cartella): ""', [''], immagini.map(i => (typeof i.cartellaRel === 'string' ? i.cartellaRel : null)));
}

const progetto = (sonda, voci) => voci.map(([rel, nome, tag], i) => ({
    id: rel + '/' + nome, file: new FotoFinta(byteDi(30, i), nome, sonda), tags: [tag], isTrashed: false,
    dirHandle: { name: rel ? rel.split('/').pop() : 'dataset' }, cartellaRel: rel,
}));
const kohya = [['10_face', 'a.png', 'ta'], ['10_face', 'img.png', 'ti1'], ['20_body', 'b.png', 'tb'], ['20_body', 'img.png', 'ti2']];

console.log('\n--- "Tag e immagini" coi nomi originali, due cartelle Kohya ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, kohya), sonda).esporta(true);
    const voci = await r.archivio() || {};
    dice('ogni foto e il suo .txt nella sua sottocartella',
        ['10_face/a.png', '10_face/a.txt', '10_face/img.png', '10_face/img.txt', '20_body/b.png', '20_body/b.txt', '20_body/img.png', '20_body/img.txt'],
        Object.keys(voci).sort());
    dice('20_body/img.txt ha i tag di 20_body/img.png', 'ti2,', voci['20_body/img.txt'] ? voci['20_body/img.txt'].toString('utf8') : null);
    dice('nessun avviso di nomi doppi', [[t.zipSuccess, 'success']], r.notifiche.filter(([, tipo]) => tipo !== 'info'));
}

console.log('\n--- "Solo i tag": i .txt si estraggono sopra il dataset, ognuno accanto alla sua foto ---');
{
    const sonda = creaSonda();
    const voci = await (await creaApp(progetto(sonda, kohya), sonda).esporta(false)).archivio() || {};
    dice('10_face/a.txt, 10_face/img.txt, 20_body/b.txt, 20_body/img.txt', ['10_face/a.txt', '10_face/img.txt', '20_body/b.txt', '20_body/img.txt'], Object.keys(voci).sort());
}

console.log('\n--- una sottocartella con un nome pericoloso non esce dall\'archivio ---');
{
    const sonda = creaSonda();
    const voci = await (await creaApp(progetto(sonda, [['../fuori', 'x.png', 'tx'], ['C:/win', 'y.png', 'ty']]), sonda).esporta(false)).archivio() || {};
    const nomi = Object.keys(voci);
    dice('nessun ".." e nessuna unita\' nei nomi', [], nomi.filter(n => n.split('/').some(p => p === '..' || p === '.' || /:/.test(p)) || n.startsWith('/')));
    dice('i due .txt ci sono', 2, nomi.length);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const sciolte = (await (await creaApp(progetto(sonda, [['', 'img.png', 'p1'], ['', 'b.png', 'p2']]), sonda).esporta(true)).archivio()) || {};
    dice('foto alla radice (o senza cartella): alla radice', ['b.png', 'b.txt', 'img.png', 'img.txt'], Object.keys(sciolte).sort());
    const s2b = creaSonda();
    const numerateRadice = (await (await creaApp(progetto(s2b, [['', 'img.png', 'p1'], ['', 'b.png', 'p2']]), s2b).esporta(true, true)).archivio()) || {};
    dice('rinominando in sequenza, le foto alla radice (o senza cartella) restano alla radice',
        ['0001.png', '0001.txt', '0002.png', '0002.txt'], Object.keys(numerateRadice).sort());
}

console.log('\n--- "Rinomina in sequenza" tiene le sottocartelle Kohya ---');
{
    // ITALIANO: rinominando, l'archivio era piatto: 0001..0004 alla radice, senza 10_face/ e
    //           20_body/. sd-scripts legge solo le cartelle N_nome, e la stessa esportazione coi
    //           nomi originali le tiene. Ora il numero (unico per tutto l'archivio) sta nella
    //           sottocartella della foto.
    // ENGLISH: when renaming, the archive was flat: 0001..0004 at the root, without 10_face/ and
    //          20_body/. sd-scripts only reads N_name folders, and the same export with the
    //          original names keeps them. Now the number (unique across the archive) sits in the
    //          photo's subfolder.
    const s2 = creaSonda();
    const r = await creaApp(progetto(s2, kohya), s2).esporta(true, true);
    const numerate = (await r.archivio()) || {};
    // ITALIANO: i numeri seguono l'ordine della galleria (per nome: a, b, img, img).
    // ENGLISH: the numbers follow the gallery order (by name: a, b, img, img).
    dice('ogni foto numerata e il suo .txt nella sua sottocartella',
        ['10_face/0001.png', '10_face/0001.txt', '10_face/0003.png', '10_face/0003.txt', '20_body/0002.png', '20_body/0002.txt', '20_body/0004.png', '20_body/0004.txt'],
        Object.keys(numerate).sort());
    dice('20_body/0002.txt ha i tag di 20_body/b.png', 'tb,', numerate['20_body/0002.txt'] ? numerate['20_body/0002.txt'].toString('utf8') : null);
    dice('20_body/0004.txt ha i tag di 20_body/img.png', 'ti2,', numerate['20_body/0004.txt'] ? numerate['20_body/0004.txt'].toString('utf8') : null);
    dice('nessun avviso di nomi doppi', [[t.zipSuccess, 'success']], r.notifiche.filter(([, tipo]) => tipo !== 'info'));
    const s4 = creaSonda();
    const pericolose = (await (await creaApp(progetto(s4, [['../fuori', 'x.png', 'tx'], ['C:/win', 'y.png', 'ty']]), s4).esporta(true, true)).archivio()) || {};
    dice('rinominando, nessun ".." e nessuna unita\' nei nomi', [],
        Object.keys(pericolose).filter(n => n.split('/').some(p => p === '..' || p === '.' || /:/.test(p)) || n.startsWith('/')));
}

{
    const s3 = creaSonda();
    const doppie = (await (await creaApp(progetto(s3, [['', 'img.png', 'p1'], ['', 'img.png', 'p2']]), s3).esporta(false)).archivio()) || {};
    dice('due omonime senza sottocartella: ancora distinte', 2, Object.keys(doppie).length);
}

process.exit(esito());
