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
const { eFileImmagine } = await carica('src/utils/imageFile.ts');
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
    const fabbrica = new Function('window', 't', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'scanDirectoryHandle', 'aperturaCartellaRef',
        (await ritaglia('    const importaCartellaScelta = async (', '    const handleFolderUploadFallback')) + '\nreturn handleLoadFolderClick;');
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
    await fabbrica(window, t, () => { }, (...x) => { argomenti = x; }, { current: { click() { } } }, scanDirectoryHandle, { current: false })();
    const rel = relDa(argomenti);
    dice('dataset/cover.png -> "" (radice), 10_face/a.png -> "10_face", 20_body/extra/c.png -> "20_body/extra"',
        ['', '10_face', '20_body', '20_body/extra'], [rel(radiceF), rel(a), rel(b), rel(c)]);
}

console.log('\n--- il ripiego del browser (webkitdirectory) fa lo stesso ---');
{
    const fabbrica = new Function('t', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'fileDiMac', 'eFileImmagine',
        (await ritaglia('    const handleFolderUploadFallback = async (e: any) => {')) + '\nreturn handleFolderUploadFallback;');
    let argomenti = null;
    const files = [['dataset/cover.png'], ['dataset/10_face/a.png'], ['dataset/20_body/extra/c.png']]
        .map(([p]) => ({ name: p.split('/').pop(), type: 'image/png', webkitRelativePath: p }));
    await fabbrica(t, () => { }, (...x) => { argomenti = x; }, { current: { value: '' } }, fileDiMac, eFileImmagine)({ target: { files } });
    const rel = relDa(argomenti);
    dice('"", "10_face", "20_body/extra"', ['', '10_face', '20_body/extra'], files.map(rel));
}

console.log('\n--- processImportData mette la sottocartella sulla foto ---');
{
    const NOMI = ['globalTriggers', 'globalTriggersRef', 'images', 'setImages', 'setGlobalTriggers', 'uniqueTagsIgnoringCase',
        'setImportSummary', 'setDirHandle', 'setIsImporting', 'setImportProgress', 'folderSignature', 'nuovoIdFoto', 'backupDellImport',
        'localStorage', 'makeFolderKeyer', 'makeBackupKeyer', 'TXT_MAX_BYTES', 'parseSidecarText', 'generateThumbnail', 'tagDiImport',
        'tagDaRipristinare', 'asDirHandle', 'anteprimeProgettoRef', 'soundManager', 'avvisoImport', 't', 'showNotification',
        'folderInputRef', 'console', 'importAttiviRef', 'progettoGenRef', 'leggiTestoSidecar'];
    const fabbrica = new Function(...NOMI, (await ritaglia('    const processImportData = async (')) + '\nreturn processImportData;');
    let immagini = [];
    let id = 0;
    const fn = fabbrica([], { current: [] }, [], (f) => { immagini = typeof f === 'function' ? f(immagini) : f; }, () => { }, (x) => x,
        () => { }, () => { }, () => { }, () => { }, B.folderSignature, () => 'id' + (++id), B.backupDellImport,
        { getItem: () => null }, S.makeFolderKeyer, () => (f) => 'dataset\x1f' + f.name, 1024 * 1024, S.parseSidecarText,
        async () => ({ url: 'blob:finto', width: 1, height: 1 }), S.tagDiImport, B.tagDaRipristinare, () => null,
        { current: new Set() }, { chime() { } }, N.avvisoImport, t, () => { }, { current: null }, { log() { }, warn() { }, error() { } }, { current: 0 }, { current: 0 }, S.leggiTestoSidecar);
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

// ITALIANO: due cartelle aperte una dopo l'altra con "Carica cartella" (10_face, poi 20_body): ogni
//           foto e' alla radice della SUA scelta (cartellaRel ""), e la scelta la dice cartellaImport.
//           L'archivio metteva a, b, img alla radice e solo l'omonima in 20_body/: sd-scripts leggeva
//           una sola foto. Ora con piu' cartelle scelte ogni foto va sotto il nome della sua.
// ENGLISH: two folders opened one after the other with "Load folder" (10_face, then 20_body): every
//          photo is at the root of ITS pick (cartellaRel ""), and cartellaImport tells the pick. The
//          archive put a, b, img at the root and only the namesake in 20_body/: sd-scripts read a
//          single photo. Now with several picked folders each photo goes under its own folder's name.
const dueRadici = (sonda, voci) => voci.map(([radiceScelta, rel, nome, tag], i) => ({
    id: radiceScelta + '/' + rel + '/' + nome, file: new FotoFinta(byteDi(30, i), nome, sonda), tags: [tag], isTrashed: false,
    dirHandle: { name: rel ? rel.split('/').pop() : radiceScelta }, cartellaRel: rel,
    cartellaImport: radiceScelta, lottoImport: 'lotto-' + radiceScelta,
}));
const kohyaDueRadici = [['10_face', '', 'a.png', 'ta'], ['10_face', '', 'img.png', 'ti1'], ['20_body', '', 'b.png', 'tb'], ['20_body', '', 'img.png', 'ti2']];

console.log('\n--- due cartelle Kohya aperte una dopo l\'altra, "Tag e immagini" coi nomi originali ---');
{
    const sonda = creaSonda();
    const r = await creaApp(dueRadici(sonda, kohyaDueRadici), sonda).esporta(true);
    const voci = await r.archivio() || {};
    dice('ogni foto e il suo .txt sotto la cartella che e\' stata aperta',
        ['10_face/a.png', '10_face/a.txt', '10_face/img.png', '10_face/img.txt', '20_body/b.png', '20_body/b.txt', '20_body/img.png', '20_body/img.txt'],
        Object.keys(voci).sort());
    dice('20_body/img.txt ha i tag di 20_body/img.png', 'ti2,', voci['20_body/img.txt'] ? voci['20_body/img.txt'].toString('utf8') : null);
    dice('nessun avviso di nomi doppi', [[t.zipSuccess, 'success']], r.notifiche.filter(([, tipo]) => tipo !== 'info'));
}
{
    const sonda = creaSonda();
    const voci = await (await creaApp(dueRadici(sonda, kohyaDueRadici), sonda).esporta(true, true)).archivio() || {};
    const nomi = Object.keys(voci);
    dice('rinominando in sequenza: 8 voci, nessuna alla radice', [8, []], [nomi.length, nomi.filter(n => !n.includes('/'))]);
    dice('...ognuna sotto la cartella della sua foto', true,
        nomi.every(n => (n.startsWith('10_face/') || n.startsWith('20_body/'))));
    const delB = nomi.find(n => n.endsWith('.txt') && voci[n].toString('utf8') === 'tb,');
    dice('...e b.png resta in 20_body', true, !!delB && delB.startsWith('20_body/'));
}
{
    // ITALIANO: una cartella madre (dataset con 10_face dentro) e una seconda cartella aperta a parte.
    //           La foto in 10_face tiene 10_face come primo livello (sd-scripts legge solo le
    //           cartelle N_nome sotto train_data_dir): usciva dataset/10_face/a.txt, saltata.
    //           Solo cover.png, alla radice della sua scelta, va sotto il nome della scelta.
    // ENGLISH: a parent folder (dataset with 10_face inside) and a second folder opened apart.
    //          The photo in 10_face keeps 10_face as its first level (sd-scripts only reads the
    //          N_name folders under train_data_dir): it came out as dataset/10_face/a.txt, skipped.
    //          Only cover.png, at the root of its pick, goes under the pick's name.
    const sonda = creaSonda();
    const voci = await (await creaApp(dueRadici(sonda, [['dataset', '10_face', 'a.png', 'ta'], ['dataset', '', 'cover.png', 'tc'], ['30_extra', '', 'x.png', 'tx']]), sonda).esporta(false)).archivio() || {};
    dice('cartella madre e cartella a parte: 10_face resta al primo livello', ['10_face/a.txt', '30_extra/x.txt', 'dataset/cover.txt'], Object.keys(voci).sort());
}
{
    // ITALIANO: due cartelle madri aperte una dopo l'altra (char_anna con 10_anna, char_bea con
    //           10_bea): l'archivio usciva char_anna/10_anna/a.png e char_bea/10_bea/b.png, e
    //           sd-scripts non addestrava nessuna foto. Le cartelle N_nome restano al primo livello.
    // ENGLISH: two parent folders opened one after the other (char_anna with 10_anna, char_bea with
    //          10_bea): the archive came out as char_anna/10_anna/a.png and char_bea/10_bea/b.png,
    //          and sd-scripts trained no photo. The N_name folders stay at the first level.
    const madri = [['char_anna', '10_anna', 'a.png', 'ta'], ['char_bea', '10_bea', 'b.png', 'tb']];
    const sonda = creaSonda();
    const r = await creaApp(dueRadici(sonda, madri), sonda).esporta(true);
    const voci = await r.archivio() || {};
    dice('due cartelle madri, "Tag e immagini": 10_anna/ e 10_bea/ al primo livello',
        ['10_anna/a.png', '10_anna/a.txt', '10_bea/b.png', '10_bea/b.txt'], Object.keys(voci).sort());
    dice('10_bea/b.txt ha i tag di b.png', 'tb,', voci['10_bea/b.txt'] ? voci['10_bea/b.txt'].toString('utf8') : null);
    const s2 = creaSonda();
    const soloTag = await (await creaApp(dueRadici(s2, madri), s2).esporta(false)).archivio() || {};
    dice('due cartelle madri, "Solo i tag": 10_anna/a.txt e 10_bea/b.txt', ['10_anna/a.txt', '10_bea/b.txt'], Object.keys(soloTag).sort());
    const s3 = creaSonda();
    const numerate = await (await creaApp(dueRadici(s3, madri), s3).esporta(true, true)).archivio() || {};
    dice('due cartelle madri, rinominando in sequenza: 10_anna/0001 e 10_bea/0002',
        ['10_anna/0001.png', '10_anna/0001.txt', '10_bea/0002.png', '10_bea/0002.txt'], Object.keys(numerate).sort());
    // ITALIANO: una madre con una foto alla radice e una sottocartella "." o ".." soltanto: conta
    //           come radice della scelta, quindi va sotto il nome della scelta e non resta sciolta.
    // ENGLISH: a parent with a photo at its root and a subfolder made only of "." or "..": it
    //          counts as the root of the pick, so it goes under the pick's name, not loose.
    const s4 = creaSonda();
    const punti = await (await creaApp(dueRadici(s4, [['char_anna', '.', 'p.png', 'tp'], ['char_bea', '10_bea', 'b.png', 'tb']]), s4).esporta(false)).archivio() || {};
    dice('una sottocartella fatta solo di "." vale come radice della scelta', ['10_bea/b.txt', 'char_anna/p.txt'], Object.keys(punti).sort());
}
{
    // ITALIANO: una sola cartella aperta, anche insieme a foto sciolte ("Carica immagini"): come prima.
    // ENGLISH: a single folder opened, even together with loose photos ("Load images"): as before.
    const sonda = creaSonda();
    const una = dueRadici(sonda, [['10_face', '', 'a.png', 'ta'], ['10_face', '', 'b.png', 'tb']]);
    const sciolta = { id: 'z', file: new FotoFinta(byteDi(30, 9), 'z.png', sonda), tags: ['tz'], isTrashed: false, dirHandle: null, cartellaRel: '' };
    const voci = await (await creaApp([...una, sciolta], sonda).esporta(true)).archivio() || {};
    dice('una sola cartella aperta: l\'archivio resta piatto', ['a.png', 'a.txt', 'b.png', 'b.txt', 'z.png', 'z.txt'], Object.keys(voci).sort());
}

// ITALIANO: due cartelle Kohya con lo STESSO nome aperte una dopo l'altra (char_anna\10_face, poi
//           char_bea\10_face): le scelte si contavano per nome, quindi sembravano una sola e
//           l'archivio usciva piatto (a, b, img alla radice, solo l'omonima in 10_face/): sd-scripts
//           leggeva una foto. Ora le scelte si contano per apertura (lottoImport), e la seconda con
//           lo stesso nome prende un suffisso che tiene il prefisso N_: 10_face_2.
// ENGLISH: two Kohya folders with the SAME name opened one after the other (char_anna\10_face, then
//          char_bea\10_face): the picks were counted by name, so they looked like one and the archive
//          came out flat (a, b, img at the root, only the namesake in 10_face/): sd-scripts read one
//          photo. Now picks are counted per opening (lottoImport), and the second one with the same
//          name gets a suffix that keeps the N_ prefix: 10_face_2.
const aperture = (sonda, voci) => voci.map(([lotto, radiceScelta, rel, nome, tag], i) => ({
    id: lotto + '/' + rel + '/' + nome, file: new FotoFinta(byteDi(30, i), nome, sonda), tags: [tag], isTrashed: false,
    dirHandle: { name: rel ? rel.split('/').pop() : radiceScelta }, cartellaRel: rel,
    cartellaImport: radiceScelta, lottoImport: lotto,
}));
const omonime = [['L1', '10_face', '', 'a.png', 'ta'], ['L1', '10_face', '', 'img.png', 'ti1'], ['L2', '10_face', '', 'b.png', 'tb'], ['L2', '10_face', '', 'img.png', 'ti2']];
console.log('\n--- due cartelle Kohya con lo stesso nome aperte una dopo l\'altra ---');
{
    const sonda = creaSonda();
    const r = await creaApp(aperture(sonda, omonime), sonda).esporta(true);
    const voci = await r.archivio() || {};
    dice('"Tag e immagini": 10_face/ e 10_face_2/, niente alla radice',
        ['10_face/a.png', '10_face/a.txt', '10_face/img.png', '10_face/img.txt', '10_face_2/b.png', '10_face_2/b.txt', '10_face_2/img.png', '10_face_2/img.txt'],
        Object.keys(voci).sort());
    dice('10_face/img.txt ha i tag della prima, 10_face_2/img.txt della seconda', ['ti1,', 'ti2,'],
        [voci['10_face/img.txt'] ? voci['10_face/img.txt'].toString('utf8') : null, voci['10_face_2/img.txt'] ? voci['10_face_2/img.txt'].toString('utf8') : null]);
    dice('nessun avviso di nomi doppi', [[t.zipSuccess, 'success']], r.notifiche.filter(([, tipo]) => tipo !== 'info'));
    const s2 = creaSonda();
    const soloTag = await (await creaApp(aperture(s2, omonime), s2).esporta(false)).archivio() || {};
    dice('"Solo i tag": 10_face/a, 10_face/img, 10_face_2/b, 10_face_2/img',
        ['10_face/a.txt', '10_face/img.txt', '10_face_2/b.txt', '10_face_2/img.txt'], Object.keys(soloTag).sort());
    const s3 = creaSonda();
    const numerate = await (await creaApp(aperture(s3, omonime), s3).esporta(true, true)).archivio() || {};
    const nomi = Object.keys(numerate);
    dice('rinominando in sequenza: 8 voci, nessuna alla radice', [8, []], [nomi.length, nomi.filter(n => !n.includes('/'))]);
    const delB = nomi.find(n => n.endsWith('.txt') && numerate[n].toString('utf8') === 'tb,');
    dice('...e b.png resta nella cartella della seconda apertura', true, !!delB && delB.startsWith('10_face_2/'));
}
{
    // ITALIANO: maiuscole diverse sono la stessa cartella per Windows: anche qui un suffisso.
    //           Una terza apertura che si chiama gia' 10_face_2 non si mescola con la seconda.
    // ENGLISH: different capitals are the same folder to Windows: a suffix here too. A third
    //          opening already named 10_face_2 does not mix with the second one.
    const sonda = creaSonda();
    const voci = await (await creaApp(aperture(sonda, [['L1', '10_Face', '', 'a.png', 'ta'], ['L2', '10_face', '', 'b.png', 'tb'], ['L3', '10_face_2', '', 'c.png', 'tc']]), sonda).esporta(false)).archivio() || {};
    const nomi = Object.keys(voci).sort();
    dice('tre aperture, tre cartelle diverse, niente alla radice', [3, 3, []],
        [nomi.length, new Set(nomi.map(n => n.split('/')[0].toLowerCase())).size, nomi.filter(n => !n.includes('/'))]);
    dice('10_Face tiene il suo nome', '10_Face/a.txt', nomi.find(n => n.endsWith('/a.txt')) || null);
    dice('ogni cartella comincia ancora con N_ (sd-scripts la legge)', true, nomi.every(n => /^\d+_/.test(n)));
}
{
    // ITALIANO: la stessa cartella riaperta che riusa il suo lotto (lottoDaRiusare) resta una sola
    //           scelta: l'archivio resta piatto come con una sola cartella.
    // ENGLISH: the same folder reopened reusing its batch (lottoDaRiusare) stays a single pick: the
    //          archive stays flat as with a single folder.
    const sonda = creaSonda();
    const voci = await (await creaApp(aperture(sonda, [['L1', '10_face', '', 'a.png', 'ta'], ['L1', '10_face', '', 'b.png', 'tb']]), sonda).esporta(false)).archivio() || {};
    dice('stesso lotto, stesso nome: piatto', ['a.txt', 'b.txt'], Object.keys(voci).sort());
}

// ITALIANO: con piu' cartelle aperte, il nome della scelta si toglieva a OGNI foto con una
//           sottocartella, non solo alle cartelle Kohya N_nome: 10_face/old/x.png usciva old/x.txt
//           (staccata da 10_face, sd-scripts non la legge), e anna/closeup e bea/closeup finivano
//           nella stessa closeup/. Solo una sottocartella N_nome sale al primo livello.
// ENGLISH: with several folders opened, the pick's name was dropped for EVERY photo with a
//          subfolder, not only for the N_name Kohya folders: 10_face/old/x.png came out as
//          old/x.txt (cut off from 10_face, sd-scripts does not read it), and anna/closeup and
//          bea/closeup ended up in the same closeup/. Only an N_name subfolder goes up to the first level.
console.log('\n--- piu\' cartelle aperte, sottocartelle che non sono cartelle Kohya ---');
{
    const sonda = creaSonda();
    const voci = await (await creaApp(dueRadici(sonda, [['10_face', '', 'a.png', 'ta'], ['10_face', 'old', 'x.png', 'tx'], ['20_body', '', 'b.png', 'tb']]), sonda).esporta(false)).archivio() || {};
    dice('10_face con la sottocartella old: old resta dentro 10_face', ['10_face/a.txt', '10_face/old/x.txt', '20_body/b.txt'], Object.keys(voci).sort());
    const s2 = creaSonda();
    const conImmagini = await (await creaApp(dueRadici(s2, [['10_face', '', 'a.png', 'ta'], ['10_face', 'old', 'x.png', 'tx'], ['20_body', '', 'b.png', 'tb']]), s2).esporta(true)).archivio() || {};
    dice('...anche con "Tag e immagini"', ['10_face/a.png', '10_face/a.txt', '10_face/old/x.png', '10_face/old/x.txt', '20_body/b.png', '20_body/b.txt'], Object.keys(conImmagini).sort());
    const s3 = creaSonda();
    const close = await (await creaApp(dueRadici(s3, [['anna', 'closeup', 'a.png', 'ta'], ['bea', 'closeup', 'c.png', 'tc']]), s3).esporta(false)).archivio() || {};
    dice('anna/closeup e bea/closeup restano separate', ['anna/closeup/a.txt', 'bea/closeup/c.txt'], Object.keys(close).sort());
    const s4 = creaSonda();
    const mista = await (await creaApp(dueRadici(s4, [['anna', '', 'z.png', 'tz'], ['anna', 'closeup', 'a.png', 'ta'], ['bea', '', 'c.png', 'tc']]), s4).esporta(false)).archivio() || {};
    dice('anna con una foto alla radice e la sottocartella closeup: tutte e due sotto anna', ['anna/closeup/a.txt', 'anna/z.txt', 'bea/c.txt'], Object.keys(mista).sort());
}

// ITALIANO: una sola cartella aperta con a.png e a.jpg alla radice, che sul disco condividono a.txt:
//           la seconda finiva in 10_face/a.png, cioe' in una cartella NUOVA col nome della cartella
//           stessa (estratta in 10_face diventa 10_face/10_face/a.png, che sd-scripts non legge), e
//           "Solo i tag" creava un 10_face/a.txt senza foto. Ora resta accanto, con il suffisso.
// ENGLISH: a single folder opened with a.png and a.jpg at its root, sharing a.txt on disk: the
//          second one went to 10_face/a.png, a NEW folder named after the folder itself (extracted
//          into 10_face it becomes 10_face/10_face/a.png, which sd-scripts does not read), and "Tags
//          only" made a 10_face/a.txt with no photo. Now it stays alongside, with the suffix.
console.log('\n--- una sola cartella, due foto con lo stesso nome (a.png e a.jpg) ---');
const gemelle = (sonda, cartelle) => [['a.png', 'ta'], ['a.jpg', 'ta'], ['b.png', 'tb']].map(([nome, tag], i) => ({
    id: 'g' + i, file: new FotoFinta(byteDi(30, i), nome, sonda), tags: [tag], isTrashed: false,
    dirHandle: cartelle[i], cartellaRel: '', cartellaImport: '10_face', lottoImport: 'L1',
}));
const coppieGiuste = (nomi) => nomi.filter(n => !n.endsWith('.txt')).every(n => nomi.includes(n.slice(0, n.lastIndexOf('.')) + '.txt'));
{
    const una = { name: '10_face' };
    const sonda = creaSonda();
    const r = await creaApp(gemelle(sonda, [una, una, una]), sonda).esporta(true);
    const nomi = Object.keys(await r.archivio() || {}).sort();
    dice('"Tag e immagini": sei voci, nessuna in una cartella', [6, []], [nomi.length, nomi.filter(n => n.includes('/'))]);
    dice('...ogni foto ha il suo .txt con lo stesso nome', true, nomi.length > 0 && coppieGiuste(nomi));
    dice('...a.txt e b.txt ci sono', [true, true], [nomi.includes('a.txt'), nomi.includes('b.txt')]);
    const s2 = creaSonda();
    const soloTag = Object.keys(await (await creaApp(gemelle(s2, [una, una, una]), s2).esporta(false)).archivio() || {}).sort();
    dice('"Solo i tag": tre .txt, nessuno in una cartella', [3, []], [soloTag.length, soloTag.filter(n => n.includes('/'))]);
    // ITALIANO: la stessa cartella riaperta da' un oggetto nuovo con lo stesso nome: vale lo stesso.
    // ENGLISH: the same folder reopened gives a new object with the same name: the same holds.
    const s3 = creaSonda();
    const riaperta = Object.keys(await (await creaApp(gemelle(s3, [una, { name: '10_face' }, una]), s3).esporta(false)).archivio() || {}).sort();
    dice('stessa cartella riaperta (altro oggetto, stesso nome): nessuna cartella nuova', [3, []], [riaperta.length, riaperta.filter(n => n.includes('/'))]);
    // ITALIANO: due foto omonime di cartelle con nomi diversi tengono il nome della loro cartella.
    // ENGLISH: two namesake photos from folders with different names keep their folder's name.
    const s4 = creaSonda();
    const diverse = Object.keys(await (await creaApp(gemelle(s4, [{ name: 'uno' }, { name: 'due' }, { name: 'uno' }]), s4).esporta(false)).archivio() || {}).sort();
    dice('cartelle diverse: la seconda omonima va sotto il nome della sua cartella', true, diverse.some(n => n === 'uno/a.txt' || n === 'due/a.txt'));
}

console.log('\n--- l\'avviso dei nomi doppi conta i file rinominati ---');
{
    // ITALIANO: con le immagini un nome doppio sposta due file (la foto e il suo .txt): l'avviso
    //           "File rinominati per nomi doppi" diceva 1.
    // ENGLISH: with images a duplicate name moves two files (the photo and its .txt): the notice
    //          "Files renamed because of duplicate names" said 1.
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, [['', 'img.png', 'p1'], ['', 'img.png', 'p2']]), sonda).esporta(true);
    dice('"Tag e immagini": 2 file rinominati', true, r.notifiche.some(([m]) => m.includes(t.zipNameCollisionWarn.replace('{n}', '2'))));
    const s2 = creaSonda();
    const r2 = await creaApp(progetto(s2, [['', 'img.png', 'p1'], ['', 'img.png', 'p2']]), s2).esporta(false);
    dice('"Solo i tag": 1 file rinominato', true, r2.notifiche.some(([m]) => m.includes(t.zipNameCollisionWarn.replace('{n}', '1'))));
}

process.exit(esito());
