/* ITALIANO: BANCO DI PROVA DEL CESTINO DELL'APP (Svuota cestino, la X su una foto, Annulla lo
   svuotamento, Ctrl+Z, Chiudi progetto e Reset)
   Ritaglia da src/App.tsx i testi VERI delle funzioni del cestino, dell'effetto che registra la
   cronologia e di handleUndo, li compila con esbuild e li esegue con i testi veri di
   src/constants.ts. Al posto di React c'e' un piccolo stato che si comporta come lui nelle cose
   che contano qui:
   - ogni "render" crea funzioni NUOVE che vedono lo stato di QUEL momento: una funzione salvata in
     una finestra di conferma continua a vedere lo stato di quando e' stata salvata;
   - gli aggiornamenti non si applicano subito ma tutti insieme poco dopo (in un microtask), come
     fa React; dopo ogni gruppo che cambia `images` girano l'effetto della cronologia e la copia
     sempre aggiornata imagesRef, nello stesso ordine in cui stanno in App.tsx.
   Al posto del processo principale: l'electronAPI finto che ogni prova si sceglie (senza, e' come
   l'anteprima nel browser). Nessuna finestra, nessun file toccato, nessun Cestino di Windows.
   Non e' una prova: run-tests.mjs lancia solo i file test-*.mjs.

   ENGLISH: TEST BENCH FOR THE APP'S TRASH (Empty trash, the X on a photo, Undo the emptying,
   Ctrl+Z, Close project and Reset)
   Cuts the REAL text of the trash functions, of the effect that records the history and of
   handleUndo out of src/App.tsx, compiles it with esbuild and runs it with the real strings of
   src/constants.ts. Instead of React there is a small state that behaves like it in what matters
   here:
   - every "render" creates NEW functions that see the state of THAT moment: a function stored in
     a confirm dialog keeps seeing the state of when it was stored;
   - updates are not applied at once but all together a moment later (in a microtask), as React
     does; after every batch that changes `images` the history effect and the always-current copy
     imagesRef run, in the same order as in App.tsx.
   Instead of the main process: the fake electronAPI each test picks (without one it is like the
   browser preview). No window, no file touched, no Windows Recycle Bin.
   Not a test: run-tests.mjs only runs test-*.mjs files. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
export const lingue = (await carica('src/constants.ts')).translations;
export const t = lingue.en;
const P = await carica('src/utils/pathUtils.ts');
// ITALIANO: le regole dei .txt: Annulla lo svuotamento rilegge il .txt condiviso (parseSidecarText,
//           tagDopoEditor); il codice di prima non le usava.
// ENGLISH: the .txt rules: Undo the emptying re-reads the shared .txt (parseSidecarText,
//          tagDopoEditor); the previous code did not use them.
const S = await carica('src/utils/sidecarTags.ts');
// ITALIANO: il modulo della cronologia puo' non esserci ancora (codice di prima): allora resta vuoto.
// ENGLISH: the history module may not exist yet (previous code): then it stays empty.
let H = {};
try { H = await carica('src/utils/historyUtils.ts'); } catch (_) { H = {}; }
// ITALIANO: closeProjectNow riscrive il backup con backupDopoChiusura (il codice di prima non l'aveva).
// ENGLISH: closeProjectNow rewrites the backup with backupDopoChiusura (the previous code did not have it).
let G;
try { G = await carica('src/utils/closeGuard.ts'); } catch (_) { G = {}; }
export const cronologia = H;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
export const sorgenteApp = sorgente;

// ITALIANO: una funzione vera, dalla sua intestazione fino alla riga che la chiude.
// ENGLISH: a real function, from its header down to the line that closes it.
const ritaglia = (intestazione, chiusura = /\r?\n    \};\r?\n/g) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) return '';
    chiusura.lastIndex = inizio;
    const fine = chiusura.exec(sorgente);
    return fine ? sorgente.slice(inizio, fine.index + fine[0].length) : '';
};
const FUNZIONI = ['handleRestore', 'percorsiSuDisco', 'deleteImageFiles', 'deleteImageFilesForGood', 'releaseThumbnails',
    'handleDeletePermanently', 'annullaSvuotamento', 'handleEmptyTrash', 'chiediEliminazioneDefinitiva', 'eliminaPerSempre', 'handleRestoreAll',
    'closeProjectNow', 'handleResetProject'];
// ITALIANO: funzioni che il codice di prima non aveva: se mancano si va avanti senza.
// ENGLISH: functions the previous code did not have: when missing, carry on without them.
const FACOLTATIVE = ['fraseCestinoWindows', 'txtUsatoDaAltre'];
const testi = [];
for (const nome of [...FUNZIONI, ...FACOLTATIVE]) {
    const testo = ritaglia(`    const ${nome} = `);
    if (!testo && FUNZIONI.includes(nome)) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
    if (testo) testi.push(testo);
}
const undo = ritaglia('    const handleUndo = useCallback(', /\r?\n    \}, \[history, historyIndex, t\]\);\r?\n/g);
// ITALIANO: handleRedo e l'effetto che ricorda cosa c'e' su disco (discoNotoRef): il codice di
//           prima non aveva il secondo, e se manca si va avanti senza.
// ENGLISH: handleRedo and the effect that remembers what is on disk (discoNotoRef): the previous
//          code did not have the latter, and when missing it carries on without it.
const redo = ritaglia('    const handleRedo = useCallback(', /\r?\n    \}, \[history, historyIndex, t\]\);\r?\n/g);
const iDisco = sorgente.indexOf('discoNotoRef.current.set(');
const testoDisco = iDisco < 0 ? '' : sorgente.slice(sorgente.lastIndexOf('    useEffect(() => {', iDisco) + '    useEffect('.length,
    sorgente.indexOf('    }, [images]);', iDisco) + '    }'.length);
// ITALIANO: l'effetto della cronologia e' anonimo: lo si trova dalla sua prima riga.
// ENGLISH: the history effect is anonymous: it is found from its first line.
const iPrima = sorgente.indexOf('        if (isUndoRedoAction.current) {');
const iUso = sorgente.lastIndexOf('    useEffect(() => {', iPrima);
const iFine = sorgente.indexOf('    }, [images]);', iPrima);
if (!undo || iPrima < 0 || iUso < 0 || iFine < 0) { console.log('NO  handleUndo o l\'effetto della cronologia non trovati in src/App.tsx'); process.exit(1); }
testi.push(undo, 'const effettoCronologia = ' + sorgente.slice(iUso + '    useEffect('.length, iFine + '    }'.length) + ';');
if (redo) testi.push(redo);
testi.push('const effettoDisco = ' + (testoDisco || '() => { }') + ';');

const nomiFacoltativi = FACOLTATIVE.filter(n => testi.some(x => x.startsWith(`    const ${n} = `)));
const NOMI = ['images', 'trashedImages', 'history', 'historyIndex', 'ultimoSvuotamento', 'ripristinoInCorso',
    'setImages', 'setHistory', 'setHistoryIndex', 'setUltimoSvuotamento', 'setRipristinoInCorso', 'setIsEmptyingTrash',
    'setSelectedForBulk', 'setConfirmDialog', 'setIsTrashOpen', 'setToast', 'showNotification',
    'imagesRef', 'isUndoRedoAction', 'fotoChiuseRef', 'ripristinoInCorsoRef', 't', 'soundManager', 'sidecarTagFileName', 'purgeIdsFromHistory',
    'withLiveOriginalTags', 'nearestDifferentStep', 'discoNotoRef', 'globalTriggers', 'setGlobalTriggers', 'globalTriggersRef', 'triggerHistoryRef',
    // ITALIANO: quello che serve a Chiudi progetto e a Reset (closeProjectNow, handleResetProject).
    // ENGLISH: what Close project and Reset need (closeProjectNow, handleResetProject).
    'progettoGenRef', 'aiCancelRequestedRef', 'setAiCancelRequested', 'aiAbortControllerRef', 'localStorage', 'liberaAnteprimeProgetto',
    'setStagedBulkTags', 'setCustomProjectTags', 'setDirHandle', 'setSelectedImageId', 'setCopiedTags',
    'useCallback', 'window', 'URL', 'console', 'backupDopoChiusura',
    // ITALIANO: la spia dello svuotamento in corso (annullaSvuotamento la guarda).
    // ENGLISH: the emptying-in-progress flag (annullaSvuotamento looks at it).
    'isEmptyingTrash',
    // ITALIANO: Annulla lo svuotamento rimette le foto tornate in ogni passo (il codice di prima non l'aveva).
    // ENGLISH: Undo the emptying puts the returned photos back in every step (the previous code did not have it).
    'addPhotosToHistory',
    // ITALIANO: Annulla lo svuotamento allinea una foto al .txt condiviso cambiato nel frattempo.
    // ENGLISH: Undo the emptying syncs a photo to the shared .txt changed meanwhile.
    'parseSidecarText', 'tagDopoEditor'];
const codice = (await esbuild.transform(testi.join('\n'), { loader: 'ts' })).code;
const fabbrica = new Function(...NOMI, codice + '\nreturn { ' + [...FUNZIONI, ...nomiFacoltativi, 'handleUndo', ...(redo ? ['handleRedo'] : []), 'effettoCronologia', 'effettoDisco'].join(', ') + ' };');

/* ITALIANO: una foto finta. `cestinata` = sta nel cestino dell'app; `cartella` = la cartella aperta
   (serve alla cancellazione definitiva); il percorso su disco lo da' il finto getPathForFile.
   ENGLISH: a fake photo. `cestinata` = it sits in the app's trash; `cartella` = the open folder
   (needed by the permanent delete); the path on disk comes from the fake getPathForFile. */
export const foto = (id, { cestinata = true, cartella = null } = {}) => ({
    id, file: { name: id + '.png', percorso: 'E:\\dataset\\' + id + '.png' }, thumb: 'blob:finto/' + id,
    tags: ['tag ' + id], originalTags: ['tag ' + id], isTrashed: cestinata, dirHandle: cartella, width: 1024, height: 1024,
});
export const percorsoImg = (id) => 'E:\\dataset\\' + id + '.png';
export const percorsoTxt = (id) => 'E:\\dataset\\' + id + '.txt';

/* ITALIANO: una cartella aperta con "Carica cartella" nell'anteprima: removeEntry annota il nome
   e riesce, oppure fallisce per i nomi in `bloccati`.
   ENGLISH: a folder opened with "Load folder" in the preview: removeEntry records the name and
   succeeds, or fails for the names in `bloccati`. */
export const cartellaFinta = (bloccati = []) => {
    const c = { name: 'dataset', rimossi: [] };
    c.removeEntry = async (nome) => {
        await new Promise(ok => setTimeout(ok, 0));
        if (bloccati.includes(nome)) throw new DOMException('The file is in use', 'NoModificationAllowedError');
        c.rimossi.push(nome);
    };
    return c;
};

/* ITALIANO: un electronAPI finto. `esitoDi(percorso)` decide l'esito di ogni file ('ok', 'errore',
   'rifiutato'); `prima(percorso)` gira PRIMA della risposta, mentre il file "si sta spostando":
   e' il momento in cui l'utente puo' fare altro. Ogni chiamata aspetta un giro dell'orologio,
   come una vera chiamata al processo principale, cosi' nel frattempo lo stato si aggiorna.
   ENGLISH: a fake electronAPI. `esitoDi(path)` picks each file's outcome ('ok', 'errore',
   'rifiutato'); `prima(path)` runs BEFORE the answer, while the file "is being moved": the moment
   the user can do something else. Every call waits one tick, like a real call to the main process,
   so the state updates meanwhile. */
export const apiFinta = ({ esitoDi = () => 'ok', prima = null, ripristino = null, txtSulDisco = null } = {}) => {
    const a = { chiamate: [], ripristini: [] };
    a.getPathForFile = (file) => file.percorso;
    a.trashFiles = async (percorsi) => {
        a.chiamate.push([...percorsi]);
        if (prima) for (const p of percorsi) await prima(p);
        await new Promise(ok => setTimeout(ok, 0));
        const results = percorsi.map(p => esitoDi(p));
        const trashed = results.filter(x => x === 'ok').length;
        return { ok: trashed === percorsi.length, trashed, failed: percorsi.length - trashed, results };
    };
    // ITALIANO: `txtSulDisco(percorsoTxt)` = c'e' il .txt accanto alla foto? Senza, il canale manca (codice di prima).
    //           Se risponde con un testo, e' il contenuto del .txt (come il canale vero); 'saltato' = il
    //           .txt c'e' ma non si legge ({ skipped: true }, senza contenuto).
    // ENGLISH: `txtSulDisco(txtPath)` = is the .txt beside the photo there? Without it the channel is absent (previous code).
    //          If it answers with a text, that is the .txt's content (as the real channel); 'saltato' = the
    //          .txt is there but cannot be read ({ skipped: true }, with no content).
    if (typeof txtSulDisco === 'function') {
        a.readSidecarTags = async (percorsi) => percorsi.map(p => p.replace(/\.[^.\\]+$/, '.txt'))
            .map(p => [p, txtSulDisco(p)]).filter(([, v]) => v || v === '')
            .map(([p, v]) => ({ name: p.slice(p.lastIndexOf('\\') + 1), dir: p.slice(0, p.lastIndexOf('\\')), tags: [],
                ...(v === 'saltato' ? { skipped: true } : typeof v === 'string' ? { content: v } : {}) }));
    }
    a.restoreTrashed = async (percorsi) => {
        a.ripristini.push([...percorsi]);
        await new Promise(ok => setTimeout(ok, 0));
        if (typeof ripristino === 'function') return ripristino(percorsi);
        return { results: percorsi.map(p => ({ percorso: p, esito: 'ok' })) };
    };
    return a;
};

/* ITALIANO: l'app finta con queste foto. render() da' le funzioni vere viste dallo stato di adesso;
   stato e' lo stato; notifiche e revocati registrano cosa l'utente vede e quali anteprime sono
   state liberate; attendi() lascia passare il tempo (le chiamate al processo, gli aggiornamenti).
   ENGLISH: the fake app with these photos. render() gives the real functions as seen from the
   current state; stato is the state; notifiche and revocati record what the user sees and which
   thumbnails were released; attendi() lets time pass (calls to the main process, updates). */
export const creaApp = (immagini, { api = null } = {}) => {
    const stato = {
        images: immagini, history: [], historyIndex: -1, ultimoSvuotamento: null, ripristinoInCorso: false, globalTriggers: [],
        isEmptyingTrash: false, selectedForBulk: [], confirmDialog: { isOpen: false }, isTrashOpen: true,
    };
    const r = { stato, notifiche: [], revocati: [], avvisi: [] };
    const refs = { imagesRef: { current: immagini }, isUndoRedoAction: { current: false }, fotoChiuseRef: { current: new Map() }, ripristinoInCorsoRef: { current: false }, discoNotoRef: { current: new Map() },
        globalTriggersRef: { current: [] }, triggerHistoryRef: { current: [] }, progettoGenRef: { current: 0 },
        aiCancelRequestedRef: { current: false }, aiAbortControllerRef: { current: null } };
    const nulla = () => { };
    const memoria = { getItem: () => null, setItem: nulla, removeItem: nulla };
    const coda = [];
    let programmato = false;
    const finestra = api ? { electronAPI: api } : {};
    const url = { revokeObjectURL: (u) => r.revocati.push(u) };
    const quieto = { log() { }, warn: (...a) => r.avvisi.push(a.map(String).join(' ')), error: (...a) => r.avvisi.push(a.map(String).join(' ')) };
    const scarica = () => {
        programmato = false;
        while (coda.length) {
            const prima = stato.images;
            for (const [k, v] of coda.splice(0)) stato[k] = typeof v === 'function' ? v(stato[k]) : v;
            if (stato.images !== prima) {
                // ITALIANO: gli effetti su [images], nell'ordine di App.tsx: cronologia, poi imagesRef.
                // ENGLISH: the effects on [images], in App.tsx order: history, then imagesRef.
                render().effettoCronologia();
                refs.imagesRef.current = stato.images;
                render().effettoDisco();
            }
        }
    };
    const imposta = (chiave) => (v) => {
        coda.push([chiave, v]);
        if (!programmato) { programmato = true; queueMicrotask(scarica); }
    };
    const render = () => fabbrica(
        stato.images, stato.images.filter(i => i.isTrashed), stato.history, stato.historyIndex, stato.ultimoSvuotamento, stato.ripristinoInCorso,
        imposta('images'), imposta('history'), imposta('historyIndex'), imposta('ultimoSvuotamento'), imposta('ripristinoInCorso'), imposta('isEmptyingTrash'),
        imposta('selectedForBulk'), imposta('confirmDialog'), imposta('isTrashOpen'),
        (x) => r.notifiche.push([x.message, x.type]),
        (m, tipo = 'info') => r.notifiche.push([m, tipo]),
        refs.imagesRef, refs.isUndoRedoAction, refs.fotoChiuseRef, refs.ripristinoInCorsoRef, t, { pop() { }, chime() { } }, P.sidecarTagFileName, H.purgeIdsFromHistory,
        H.withLiveOriginalTags, H.nearestDifferentStep, refs.discoNotoRef, stato.globalTriggers, imposta('globalTriggers'), refs.globalTriggersRef, refs.triggerHistoryRef,
        refs.progettoGenRef, refs.aiCancelRequestedRef, nulla, refs.aiAbortControllerRef, memoria, nulla,
        nulla, nulla, nulla, nulla, nulla,
        (f) => f, finestra, url, quieto, G.backupDopoChiusura || nulla, stato.isEmptyingTrash,
        H.addPhotosToHistory || ((h) => h),
        S.parseSidecarText, S.tagDopoEditor);
    // ITALIANO: il montaggio: l'effetto della cronologia gira una volta con l'elenco iniziale.
    // ENGLISH: the mount: the history effect runs once with the initial list.
    render().effettoCronologia();
    render().effettoDisco();
    scarica();
    r.render = render;
    r.refs = refs;
    r.attendi = async (giri = 5) => { for (let i = 0; i < giri; i++) await new Promise(ok => setTimeout(ok, 0)); };
    // ITALIANO: un'altra azione dell'utente sulle foto (cestinarne una, cambiare dei tag): passa da
    //           setImages come nell'app, quindi entra nella cronologia.
    // ENGLISH: another user action on the photos (trashing one, editing tags): it goes through
    //          setImages as in the app, so it enters the history.
    r.modifica = (f) => imposta('images')(f);
    r.cestina = (id) => r.modifica(prev => prev.map(i => (i.id === id ? { ...i, isTrashed: true } : i)));
    // ITALIANO: quello che mostra la galleria: id e se sta nel cestino.
    // ENGLISH: what the gallery shows: id and whether it is in the trash.
    r.vista = () => stato.images.map(i => i.id + (i.isTrashed ? '(cestino)' : ''));
    return r;
};
