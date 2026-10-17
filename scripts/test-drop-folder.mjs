/* ITALIANO: PROVA DEL TRASCINAMENTO DI UNA CARTELLA SULLA FINESTRA
   Prima il trascinamento prendeva solo le immagini: una cartella arrivava senza tipo, veniva
   scartata e compariva "Trascina solo immagini". Ora una cartella trascinata DA SOLA si apre per la
   stessa strada di "Carica Cartella" (importaCartellaScelta): la finestra di registrazione del
   percorso si apre PRIMA di chiedere il permesso di scrittura, la cartella si legge, il percorso si
   ritira con le prove dei file e il riepilogo riceve la cartella come destinazione dei salvataggi.
   Senza permesso non si importa niente e si manda su "Carica Cartella"; piu' cartelle, o una cartella
   con altri file, non si indovinano. Le maniglie si chiedono dentro l'evento di rilascio, perche'
   dopo l'elenco del trascinamento non si legge piu'.
   Si eseguono i testi VERI presi da src/App.tsx: importaCartellaScelta, handleLoadFolderClick,
   apriCartellaTrascinata, handleDroppedFiles e il gestore globale del rilascio, con la scansione vera
   (src/utils/folderScan.ts) su cartelle finte.
   Uso:  node scripts/test-drop-folder.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF DROPPING A FOLDER ON THE WINDOW
   Dropping used to take images only: a folder arrived with no type, was discarded and "Drag images
   only" appeared. Now a folder dropped ON ITS OWN opens along the same road as "Load Folder"
   (importaCartellaScelta): the path recording window opens BEFORE write permission is asked, the
   folder is read, the path is collected with the files' proof and the summary receives the folder as
   the save target. With no permission nothing is imported and the user is sent to "Load Folder";
   several folders, or a folder with other files, are not guessed at. The handles are asked for
   inside the drop event, because afterwards the drag list can no longer be read.
   The REAL text taken from src/App.tsx is run: importaCartellaScelta, handleLoadFolderClick,
   apriCartellaTrascinata, handleDroppedFiles and the global drop handler, with the real scan
   (src/utils/folderScan.ts) over fake folders.
   Usage:  node scripts/test-drop-folder.mjs      (exits with code 1 if anything is off) */

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
const ritaglia = (da, a, includiA = false) => {
    const i = sorgente.indexOf(da);
    const j = i < 0 ? -1 : sorgente.indexOf(a, i);
    if (i < 0 || j < 0) { console.log('NO  non trovato in src/App.tsx: ' + da.trim()); process.exit(1); }
    return sorgente.slice(i, includiA ? j + a.length : j);
};
// ITALIANO: da importaCartellaScelta a prima di handleFolderUploadFallback (c'e' anche handleLoadFolderClick);
//           da apriCartellaTrascinata alla fine di handleDroppedFiles.
// ENGLISH: from importaCartellaScelta to before handleFolderUploadFallback (handleLoadFolderClick is in it);
//          from apriCartellaTrascinata to the end of handleDroppedFiles.
const pezzoCartella = ritaglia('    const importaCartellaScelta = async (', '    const handleFolderUploadFallback');
const inizioDrop = sorgente.indexOf('    const apriCartellaTrascinata = async (');
const chiusura = /\r?\n    \}, \[([^\]]*)\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizioDrop, 0);
const fineDrop = inizioDrop < 0 ? null : chiusura.exec(sorgente);
if (!fineDrop) { console.log('NO  apriCartellaTrascinata / handleDroppedFiles non trovati'); process.exit(1); }
const pezzoDrop = sorgente.slice(inizioDrop, fineDrop.index + fineDrop[0].length);
const js = (await esbuild.transform(pezzoCartella + pezzoDrop, { loader: 'ts' })).code;
const fabbrica = new Function('window', 't', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'scanDirectoryHandle',
    'useCallback', 'loadSidecarTxtFiles', 'isTagEditorOpen', 'isApiKeyDialogOpen', 'fileDiMac', 'aperturaCartellaRef', 'aiuto', 'saveCloseDialog',
    js + '\nreturn { handleLoadFolderClick, apriCartellaTrascinata, handleDroppedFiles };');

// --- cartelle finte della File System Access API (come in test-load-folder-scan.mjs)
const file = (name, type) => ({ name, type, size: 10, lastModified: 1 });
const voceFile = (f) => ({ kind: 'file', name: f.name, getFile: async () => f });
const cartella = (name, voci, permesso = 'granted', log = null) => ({
    kind: 'directory', name,
    requestPermission: async (opz) => {
        if (log) log.push('permesso:' + (opz && opz.mode));
        if (permesso instanceof Error) throw permesso;
        return permesso;
    },
    values() {
        let i = 0;
        if (log) log.push('scansione');
        return {
            [Symbol.asyncIterator]() { return this; },
            async next() { return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true }; },
        };
    },
});

const ambiente = ({ electron = true, radiceVera = 'D:\\prova\\foto', editor = false, chiave = false, selettore = null } = {}) => {
    const r = { log: [], notifiche: [], riepilogo: null, sidecar: 0, ritiri: [] };
    const window = {
        showDirectoryPicker: selettore,
        electronAPI: electron ? {
            beginFolderPick: async () => { r.log.push('inizio'); },
            takePickedFolderPath: async (prove) => { r.log.push('ritiro:' + prove.length); r.ritiri.push(prove); return prove.length ? radiceVera : ''; },
        } : undefined,
    };
    const fn = fabbrica(window, t, (m, tipo) => r.notifiche.push([m, tipo]),
        (img, txt, handle, folderOf, relPathOf, pathOf) => {
            r.log.push('riepilogo');
            r.riepilogo = { img: img.map(f => f.name), txt: txt.map(f => f.name), handle: handle ? handle.name : null,
                percorsi: pathOf ? img.map(f => pathOf.get(f) || '') : null };
        },
        { current: { click: () => { r.log.push('campo nascosto'); } } }, scanDirectoryHandle,
        (f) => f, async () => { r.sidecar++; return { txtFiles: [], folderOf: null }; }, editor, chiave, fileDiMac, { current: false }, null, { isOpen: false });
    return { r, ...fn };
};
const a = file('a.jpg', 'image/jpeg');
const at = file('a.txt', 'text/plain');
const b = file('b.png', 'image/png');
const fotoCartella = (log, permesso) => cartella('foto', [voceFile(a), voceFile(at), cartella('sotto', [voceFile(b)])], permesso, log);
const maniglia = (h) => [Promise.resolve(h)];

console.log('\n--- una cartella trascinata da sola si apre come con "Carica Cartella" ---');
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([{ name: 'foto', type: '' }], maniglia(fotoCartella(r.log)));
    dice('ordine: registrazione aperta, permesso di scrittura, lettura, ritiro del percorso, riepilogo',
        ['inizio', 'permesso:readwrite', 'scansione', 'ritiro:2', 'riepilogo'], r.log.filter((x, i, v) => x !== 'scansione' || v.indexOf(x) === i));
    dice('il riepilogo ha le immagini, il .txt e la cartella come destinazione', { img: ['a.jpg', 'b.png'], txt: ['a.txt'] , handle: 'foto' },
        { img: r.riepilogo?.img, txt: r.riepilogo?.txt, handle: r.riepilogo?.handle });
    dice('ogni foto ha il suo percorso vero (serve al Cestino di Windows)', ['D:\\prova\\foto\\a.jpg', 'D:\\prova\\foto\\sotto\\b.png'], r.riepilogo?.percorsi);
    dice('le prove mandate sono nomi e numeri, con la sottocartella relativa', [{ rel: '', name: 'a.jpg', size: 10, mtime: 1 }, { rel: 'sotto', name: 'b.png', size: 10, mtime: 1 }], r.ritiri[0]);
    dice('nessun messaggio e la strada delle immagini sciolte non parte', [[], 0], [r.notifiche, r.sidecar]);
}

console.log('\n--- senza permesso di scrittura non si importa niente ---');
for (const [nome, permesso] of [['negato', 'denied'], ['chiesto e lasciato in sospeso', 'prompt'], ['errore', Object.assign(new Error('x'), { name: 'SecurityError' })]]) {
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([{ name: 'foto', type: '' }], maniglia(fotoCartella(r.log, permesso)));
    dice(`permesso ${nome}: niente lettura, registrazione chiusa, si manda su "Load Folder"`,
        [['inizio', 'permesso:readwrite', 'ritiro:0'], null, [[t.dropFolderNoAccess, 'error']]], [r.log, r.riepilogo, r.notifiche]);
}

console.log('\n--- cartella senza immagini, cartella illeggibile ---');
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([{ name: 'vuota', type: '' }], maniglia(cartella('vuota', [voceFile(at)], 'granted', r.log)));
    dice('senza immagini: lo si dice e la registrazione si chiude', [null, [[t.noImagesTitle, 'info']], true], [r.riepilogo, r.notifiche, r.log.includes('ritiro:0')]);
}
{
    const { r, handleDroppedFiles } = ambiente();
    const rotta = cartella('rotta', [], 'granted');
    rotta.values = () => { throw Object.assign(new Error('rotta'), { name: 'NotReadableError' }); };
    await handleDroppedFiles([{ name: 'rotta', type: '' }], maniglia(rotta));
    dice('illeggibile: "la cartella non si legge" e registrazione chiusa', [null, [[t.folderReadError, 'error']], true], [r.riepilogo, r.notifiche, r.log.includes('ritiro:0')]);
}

console.log('\n--- quello che non si indovina ---');
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([{ name: 'x', type: '' }, { name: 'y', type: '' }], [Promise.resolve(fotoCartella()), Promise.resolve(fotoCartella())]);
    dice('due cartelle: un messaggio e nient\'altro', [[[t.dropOneFolder, 'info']], [], null], [r.notifiche, r.log, r.riepilogo]);
}
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([{ name: 'foto', type: '' }, b], [Promise.resolve(fotoCartella()), Promise.resolve({ kind: 'file', name: 'b.png' })]);
    dice('una cartella con un\'immagine: lo stesso messaggio, le immagini non partono da sole', [[[t.dropOneFolder, 'info']], 0, null], [r.notifiche, r.sidecar, r.riepilogo]);
}
{
    const { r, handleDroppedFiles } = ambiente({ editor: true });
    await handleDroppedFiles([{ name: 'foto', type: '' }], maniglia(fotoCartella(r.log)));
    dice('con l\'editor dei file di tag aperto la cartella non si apre (il riepilogo starebbe sotto)', [[[t.dropCloseWindowFirst, 'info']], []], [r.notifiche, r.log]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([b], [Promise.resolve({ kind: 'file', name: 'b.png' })]);
    dice('solo immagini: la strada di sempre (sidecar dal disco, poi riepilogo), nessuna registrazione', [1, ['riepilogo'], null], [r.sidecar, r.log, r.riepilogo?.handle]);
}
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([b]);
    dice('senza maniglie (chiamata di prima): le immagini si importano come prima', [1, ['riepilogo']], [r.sidecar, r.log]);
}
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([b], [Promise.reject(new Error('no'))]);
    dice('maniglia che fallisce: le immagini si importano lo stesso', [1, ['riepilogo']], [r.sidecar, r.log]);
}
{
    const { r, handleDroppedFiles } = ambiente();
    await handleDroppedFiles([{ name: 'foto', type: '' }], [Promise.resolve(null)]);
    dice('cartella senza maniglia (browser che non la da\'): il messaggio di sempre', [[[t.dropOnlyImages, 'info']], []], [r.notifiche, r.log]);
}
{
    const { r, handleDroppedFiles } = ambiente({ electron: false });
    await handleDroppedFiles([{ name: 'foto', type: '' }], maniglia(fotoCartella(r.log)));
    dice('nel browser (senza Electron) la cartella si apre comunque, senza percorsi', [['permesso:readwrite', 'scansione', 'riepilogo'], 'foto', ['', '']],
        [r.log, r.riepilogo?.handle, r.riepilogo?.percorsi]);
}

console.log('\n--- "Carica Cartella" ---');
{
    const log = [];
    const { r, handleLoadFolderClick } = ambiente({ selettore: async () => fotoCartella(log) });
    await handleLoadFolderClick();
    dice('il pulsante fa la stessa strada: riepilogo con la cartella e i percorsi', ['foto', ['D:\\prova\\foto\\a.jpg', 'D:\\prova\\foto\\sotto\\b.png']], [r.riepilogo?.handle, r.riepilogo?.percorsi]);
    dice('...senza chiedere un altro permesso (lo da\' gia\' il selettore)', false, log.some(x => x.startsWith('permesso')));
}
{
    const { r, handleLoadFolderClick } = ambiente({ selettore: async () => cartella('vuota', [voceFile(at)]) });
    await handleLoadFolderClick();
    dice('cartella scelta senza immagini: ora la registrazione si chiude anche qui', [['inizio', 'ritiro:0'], [[t.noImagesTitle, 'info']]], [r.log, r.notifiche]);
}

console.log('\n--- il gestore globale del rilascio ---');
{
    // ITALIANO: il blocco vero dello useEffect; le maniglie si leggono solo DURANTE l'evento.
    // ENGLISH: the real useEffect block; the handles can only be read DURING the event.
    const blocco = ritaglia('    useEffect(() => {\n        let dragDepth = 0;'.replace(/\n/g, sorgente.includes('\r\n') ? '\r\n' : '\n'), '    }, []);', true);
    const codice = (await esbuild.transform(blocco, { loader: 'ts' })).code;
    const ascolti = {};
    const finestra = { addEventListener: (n, f) => { ascolti[n] = f; }, removeEventListener: () => {} };
    const chiamate = [];
    new Function('useEffect', 'window', 'setIsDragging', 'dropHandlerRef', codice)(
        (f) => f(), finestra, () => {}, { current: (files, maniglie) => chiamate.push([files, maniglie]) });
    let inEvento = true;
    const voce = (h) => ({ kind: 'file', getAsFileSystemHandle: () => { if (!inEvento) throw new Error('fuori dall\'evento'); return Promise.resolve(h); } });
    const evento = (files, items) => ({ preventDefault() {}, dataTransfer: { files, items, types: ['Files'] } });
    const dir = fotoCartella();
    ascolti.drop(evento([{ name: 'foto', type: '' }], [voce(dir), { kind: 'string' }]));
    inEvento = false;
    const date = chiamate.length ? await Promise.all(chiamate[0][1]) : [];
    dice('il rilascio passa i file e le maniglie chieste dentro l\'evento (solo le voci di tipo file)', [1, 1, 'directory'], [chiamate.length, date.length, date[0]?.kind]);
    chiamate.length = 0; inEvento = true;
    ascolti.drop(evento([b], [{ kind: 'file' }]));
    const senza = chiamate.length ? await Promise.all(chiamate[0][1]) : ['?'];
    dice('voce senza getAsFileSystemHandle: maniglia nulla, i file passano lo stesso', [1, [null]], [chiamate.length, senza]);
    chiamate.length = 0;
    ascolti.drop(evento([b], [{ kind: 'file', getAsFileSystemHandle: () => { throw new Error('rotta'); } }]));
    const rotta = chiamate.length ? await Promise.all(chiamate[0][1]) : ['?'];
    dice('getAsFileSystemHandle che lancia subito: maniglia nulla, niente errore', [1, [null]], [chiamate.length, rotta]);
}

console.log('\n--- le frasi nelle nove lingue ---');
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    const L = lingue[l];
    dice(l + ': dropOneFolder e dropFolderNoAccess presenti; il secondo nomina "' + L.loadFolder + '"', [true, true],
        [typeof L.dropOneFolder === 'string' && L.dropOneFolder.trim().length > 0, typeof L.dropFolderNoAccess === 'string' && L.dropFolderNoAccess.includes(L.loadFolder)]);
}

// ITALIANO: in giapponese le frasi della cartella trascinata scrivono フォルダー come il resto del
//           blocco (trashInfo, deleteNoRecycleBin); solo la citazione del pulsante 「フォルダを読み込む」 resta com'e'.
// ENGLISH: in Japanese the dropped-folder sentences spell フォルダー like the rest of the block
//          (trashInfo, deleteNoRecycleBin); only the quoted button 「フォルダを読み込む」 stays as it is.
for (const k of ['dropImagesHere', 'dropOnlyImages', 'dropOneFolder', 'dropFolderNoAccess']) {
    const testo = String(lingue.ja[k] || '').split(lingue.ja.loadFolder).join('');
    dice('ja: ' + k + ' scrive フォルダー', false, /フォルダ(?!ー)/.test(testo));
}

process.exit(esito());
