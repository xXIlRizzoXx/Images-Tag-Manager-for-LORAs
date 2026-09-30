/* ITALIANO: BANCO DI PROVA DEL CESTINO DELL'APP (Svuota cestino, la X su una foto, Annulla lo
   svuotamento, Ctrl+Z)
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
   Ctrl+Z)
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
// ITALIANO: il modulo della cronologia puo' non esserci ancora (codice di prima): allora resta vuoto.
// ENGLISH: the history module may not exist yet (previous code): then it stays empty.
let H = {};
try { H = await carica('src/utils/historyUtils.ts'); } catch (_) { H = {}; }
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
    'handleDeletePermanently', 'annullaSvuotamento', 'handleEmptyTrash', 'chiediEliminazioneDefinitiva', 'eliminaPerSempre', 'handleRestoreAll'];
// ITALIANO: funzioni che il codice di prima non aveva: se mancano si va avanti senza.
// ENGLISH: functions the previous code did not have: when missing, carry on without them.
const FACOLTATIVE = ['fraseCestinoWindows'];
const testi = [];
for (const nome of [...FUNZIONI, ...FACOLTATIVE]) {
    const testo = ritaglia(`    const ${nome} = `);
    if (!testo && FUNZIONI.includes(nome)) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
    if (testo) testi.push(testo);
}
const undo = ritaglia('    const handleUndo = useCallback(', /\r?\n    \}, \[history, historyIndex, t\]\);\r?\n/g);
// ITALIANO: l'effetto della cronologia e' anonimo: lo si trova dalla sua prima riga.
// ENGLISH: the history effect is anonymous: it is found from its first line.
const iPrima = sorgente.indexOf('        if (isUndoRedoAction.current) {');
const iUso = sorgente.lastIndexOf('    useEffect(() => {', iPrima);
const iFine = sorgente.indexOf('    }, [images]);', iPrima);
if (!undo || iPrima < 0 || iUso < 0 || iFine < 0) { console.log('NO  handleUndo o l\'effetto della cronologia non trovati in src/App.tsx'); process.exit(1); }
testi.push(undo, 'const effettoCronologia = ' + sorgente.slice(iUso + '    useEffect('.length, iFine + '    }'.length) + ';');

const nomiFacoltativi = FACOLTATIVE.filter(n => testi.some(x => x.startsWith(`    const ${n} = `)));
const NOMI = ['images', 'trashedImages', 'history', 'historyIndex', 'ultimoSvuotamento', 'ripristinoInCorso',
    'setImages', 'setHistory', 'setHistoryIndex', 'setUltimoSvuotamento', 'setRipristinoInCorso', 'setIsEmptyingTrash',
    'setSelectedForBulk', 'setConfirmDialog', 'setIsTrashOpen', 'setToast', 'showNotification',
    'imagesRef', 'isUndoRedoAction', 'fotoChiuseRef', 't', 'soundManager', 'sidecarTagFileName', 'purgeIdsFromHistory',
    'useCallback', 'window', 'URL', 'console'];
const codice = (await esbuild.transform(testi.join('\n'), { loader: 'ts' })).code;
const fabbrica = new Function(...NOMI, codice + '\nreturn { ' + [...FUNZIONI, ...nomiFacoltativi, 'handleUndo', 'effettoCronologia'].join(', ') + ' };');

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
export const apiFinta = ({ esitoDi = () => 'ok', prima = null, ripristino = null } = {}) => {
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
        images: immagini, history: [], historyIndex: -1, ultimoSvuotamento: null, ripristinoInCorso: false,
        isEmptyingTrash: false, selectedForBulk: [], confirmDialog: { isOpen: false }, isTrashOpen: true,
    };
    const r = { stato, notifiche: [], revocati: [], avvisi: [] };
    const refs = { imagesRef: { current: immagini }, isUndoRedoAction: { current: false }, fotoChiuseRef: { current: new Map() } };
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
        refs.imagesRef, refs.isUndoRedoAction, refs.fotoChiuseRef, t, { pop() { }, chime() { } }, P.sidecarTagFileName, H.purgeIdsFromHistory,
        (f) => f, finestra, url, quieto);
    // ITALIANO: il montaggio: l'effetto della cronologia gira una volta con l'elenco iniziale.
    // ENGLISH: the mount: the history effect runs once with the initial list.
    render().effettoCronologia();
    scarica();
    r.render = render;
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
