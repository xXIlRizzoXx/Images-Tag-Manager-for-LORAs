/* ITALIANO: BANCO DI PROVA DI Ctrl+Z / Ctrl+Shift+Z (cronologia, salvataggio, visualizzatore)
   Ritaglia da src/App.tsx i testi VERI dell'effetto che registra la cronologia, di handleUndo e
   handleRedo, del salvataggio (performSave, handleSaveChanges, il "Salva file .txt" del
   visualizzatore e la sincronizzazione dell'editor di tag), della chiusura del progetto e del clic
   su un tag suggerito, li compila con esbuild e li esegue con i testi veri di src/constants.ts.
   Al posto di React c'e' un piccolo stato che si comporta come lui nelle cose che contano qui:
   - ogni "render" crea funzioni NUOVE che vedono lo stato di QUEL momento;
   - gli aggiornamenti non si applicano subito ma tutti insieme poco dopo (in un microtask); dopo
     ogni gruppo girano gli effetti nello stesso ordine in cui stanno in App.tsx: la cronologia e
     imagesRef quando cambia `images`, poi l'effetto con dipendenze [selectedImageId, images] se
     il sorgente ce l'ha (il codice di prima non lo aveva: allora semplicemente non gira).
   Il disco e' finto: ogni cartella annota cosa ci viene scritto. Nessuna finestra, nessun file
   toccato, nessuna rete. Non e' una prova: run-tests.mjs lancia solo i file test-*.mjs.

   ENGLISH: TEST BENCH FOR Ctrl+Z / Ctrl+Shift+Z (history, saving, viewer)
   Cuts the REAL text of the effect that records the history, of handleUndo and handleRedo, of the
   saving (performSave, handleSaveChanges, the viewer's "Save .txt file" and the tag editor sync),
   of the project close and of the click on a suggested tag out of src/App.tsx, compiles it with
   esbuild and runs it with the real strings of src/constants.ts. Instead of React there is a
   small state that behaves like it in what matters here:
   - every "render" creates NEW functions that see the state of THAT moment;
   - updates are not applied at once but all together a moment later (in a microtask); after every
     batch the effects run in the same order as in App.tsx: the history and imagesRef when
     `images` changes, then the effect with dependencies [selectedImageId, images] if the source
     has it (the previous code did not: then it simply does not run).
   The disk is fake: every folder records what is written into it. No window, no file touched, no
   network. Not a test: run-tests.mjs only runs test-*.mjs files. */

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
export const t = (await carica('src/constants.ts')).translations.en;
const P = await carica('src/utils/pathUtils.ts');
const H = await carica('src/utils/historyUtils.ts');
export const cronologia = H;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
export const sorgenteApp = sorgente;

// ITALIANO: un pezzo vero, dalla sua intestazione fino alla riga che lo chiude.
// ENGLISH: a real piece, from its header down to the line that closes it.
const ritaglia = (intestazione, chiusura = /\r?\n    \};\r?\n/g) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) return '';
    chiusura.lastIndex = inizio + intestazione.length;
    const fine = chiusura.exec(sorgente);
    return fine ? sorgente.slice(inizio, fine.index + fine[0].length) : '';
};
// ITALIANO: un effetto anonimo, trovato dalla riga delle sue dipendenze.
// ENGLISH: an anonymous effect, found from the line holding its dependencies.
const effetto = (rigaDipendenze, daRiga = null) => {
    const iFine = daRiga ? sorgente.indexOf(rigaDipendenze, sorgente.indexOf(daRiga)) : sorgente.indexOf(rigaDipendenze);
    if (iFine < 0) return '';
    const iUso = sorgente.lastIndexOf('    useEffect(() => {', iFine);
    if (iUso < 0) return '';
    return sorgente.slice(iUso + '    useEffect('.length, iFine + '    }'.length);
};

const FINE_CALLBACK = /\r?\n    \}, \[history, historyIndex, t\]\);\r?\n/g;
const PEZZI = {
    handleUndo: ritaglia('    const handleUndo = useCallback(', FINE_CALLBACK),
    handleRedo: ritaglia('    const handleRedo = useCallback(', FINE_CALLBACK),
    getOrderedTagString: ritaglia('    const getOrderedTagString = '),
    performSave: ritaglia('    const performSave = async '),
    handleSaveChanges: ritaglia('    const handleSaveChanges = async '),
    handleCloseProject: ritaglia('    const handleCloseProject = () => {'),
    updateOriginalTags: ritaglia('    const updateOriginalTags = ', /\r?\n/g),
    handleTagEditorSaved: ritaglia('    const handleTagEditorSaved = async '),
    handleSuggestedTagClick: ritaglia('    const handleSuggestedTagClick = '),
};
for (const [nome, testo] of Object.entries(PEZZI)) {
    if (!testo) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
}
const testoCronologia = effetto('    }, [images]);', '        if (isUndoRedoAction.current) {');
if (!testoCronologia) { console.log('NO  l\'effetto della cronologia non trovato in src/App.tsx'); process.exit(1); }
const visualizzatore = effetto('    }, [selectedImageId, images]);');
export const haEffettoVisualizzatore = Boolean(visualizzatore);

const testi = [...Object.values(PEZZI), 'const effettoCronologia = ' + testoCronologia + ';'];
if (visualizzatore) testi.push('const effettoVisualizzatore = ' + visualizzatore + ';');
const NOMI = ['images', 'history', 'historyIndex', 'selectedImageId', 'selectedForBulk', 'stagedBulkTags', 'globalTriggers',
    'setImages', 'setHistory', 'setHistoryIndex', 'setToast', 'setSelectedImageId', 'setStagedBulkTags',
    'setSaveCloseDialog', 'setConfirmDialog', 'setIsSaving', 'setImportProgress',
    'showNotification', 'updateImageTags', 'closeProjectNow', 't', 'soundManager', 'imagesRef', 'isUndoRedoAction',
    'sidecarTagFileName', 'buildTagFileName', 'purgeIdsFromHistory', 'withLiveOriginalTags',
    'useCallback', 'window', 'document', 'URL', 'Blob', 'console'];
const codice = (await esbuild.transform(testi.join('\n'), { loader: 'ts' })).code;
const fabbrica = new Function(...NOMI, codice + '\nreturn { ' + [...Object.keys(PEZZI), 'effettoCronologia',
    ...(visualizzatore ? ['effettoVisualizzatore'] : [])].join(', ') + ' };');

/* ITALIANO: una cartella finta: `scritti` = nome del file -> ultimo contenuto scritto.
   ENGLISH: a fake folder: `scritti` = file name -> last content written. */
export const cartellaFinta = () => {
    const c = { name: 'dataset', scritti: new Map() };
    c.getFileHandle = async (nome) => ({
        nome,
        createWritable: async () => ({ write: async (s) => { c.scritti.set(nome, String(s)); }, close: async () => { } }),
    });
    return c;
};

/* ITALIANO: una foto finta con i suoi tag, uguali a quelli nel .txt su disco.
   ENGLISH: a fake photo with its tags, the same as the ones in the .txt on disk. */
export const foto = (id, tags, cartella = null) => ({
    id, file: { name: id + '.png' }, thumb: 'blob:finto/' + id, tags: [...tags], originalTags: [...tags],
    isTrashed: false, dirHandle: cartella, width: 1024, height: 1024,
});

/* ITALIANO: l'app finta. Si monta vuota, come quella vera, e poi importa `immagini`: il primo passo
   della cronologia e' la galleria vuota, il secondo l'import. render() da' le funzioni vere viste
   dallo stato di adesso; notifiche, finestre e aggiornamenti registrano quello che l'utente vede.
   ENGLISH: the fake app. It mounts empty, like the real one, then imports `immagini`: the first
   history step is the empty gallery, the second one the import. render() gives the real functions
   as seen from the current state; notifiche, finestre and aggiornamenti record what the user sees. */
export const creaApp = (immagini, { trigger = [] } = {}) => {
    const stato = {
        images: [], history: [], historyIndex: -1, selectedImageId: null, selectedForBulk: [], stagedBulkTags: [],
        globalTriggers: trigger, saveCloseDialog: { isOpen: false }, confirmDialog: { isOpen: false },
    };
    const r = { stato, notifiche: [], tagSuFotoAperta: [] };
    const refs = { imagesRef: { current: [] }, isUndoRedoAction: { current: false } };
    const coda = [];
    let programmato = false;
    const quieto = { log() { }, warn() { }, error() { } };
    const url = { createObjectURL: () => 'blob:finto/download', revokeObjectURL() { } };
    const scarica = () => {
        programmato = false;
        while (coda.length) {
            const primaImmagini = stato.images;
            const primaAperta = stato.selectedImageId;
            for (const [k, v] of coda.splice(0)) stato[k] = typeof v === 'function' ? v(stato[k]) : v;
            if (stato.images !== primaImmagini) {
                // ITALIANO: gli effetti su [images], nell'ordine di App.tsx: cronologia, poi imagesRef.
                // ENGLISH: the effects on [images], in App.tsx order: history, then imagesRef.
                render().effettoCronologia();
                refs.imagesRef.current = stato.images;
            }
            if ((stato.images !== primaImmagini || stato.selectedImageId !== primaAperta) && haEffettoVisualizzatore) {
                render().effettoVisualizzatore();
            }
        }
    };
    const imposta = (chiave) => (v) => {
        coda.push([chiave, v]);
        if (!programmato) { programmato = true; queueMicrotask(scarica); }
    };
    const render = () => fabbrica(
        stato.images, stato.history, stato.historyIndex, stato.selectedImageId, stato.selectedForBulk, stato.stagedBulkTags, stato.globalTriggers,
        imposta('images'), imposta('history'), imposta('historyIndex'), () => { }, imposta('selectedImageId'), imposta('stagedBulkTags'),
        imposta('saveCloseDialog'), imposta('confirmDialog'), () => { }, () => { },
        (m, tipo = 'info') => r.notifiche.push([m, tipo]),
        (id, tags) => r.tagSuFotoAperta.push([id, tags]),
        () => { }, t, { pop() { }, chime() { }, click() { } }, refs.imagesRef, refs.isUndoRedoAction,
        P.sidecarTagFileName, P.buildTagFileName, H.purgeIdsFromHistory, H.withLiveOriginalTags,
        (f) => f, {}, { createElement: () => ({ click() { } }), body: { appendChild() { }, removeChild() { } } }, url, Blob, quieto);
    // ITALIANO: il montaggio (galleria vuota), poi l'import.
    // ENGLISH: the mount (empty gallery), then the import.
    render().effettoCronologia();
    r.render = render;
    r.attendi = async (giri = 5) => { for (let i = 0; i < giri; i++) await new Promise(ok => setTimeout(ok, 0)); };
    // ITALIANO: un'azione dell'utente sulle foto: passa da setImages come nell'app.
    // ENGLISH: a user action on the photos: it goes through setImages as in the app.
    r.modifica = (f) => imposta('images')(f);
    r.apri = (id) => imposta('selectedImageId')(id);
    r.seleziona = (ids) => imposta('selectedForBulk')(ids);
    r.importa = () => imposta('images')(immagini);
    r.fotoCon = (id) => stato.images.find(i => i.id === id);
    return r;
};
