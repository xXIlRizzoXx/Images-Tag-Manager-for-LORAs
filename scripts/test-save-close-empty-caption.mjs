/* ITALIANO: PROVA DI "SALVA E CHIUDI" QUANDO IL SALVATAGGIO SVUOTA UN .TXT
   Togliendo tutti i tag a una foto il cui .txt ne aveva e premendo "Chiudi progetto" -> "Salva e
   chiudi", il salvataggio svuota quel .txt e lo dice ("Una foto ora ha un .txt vuoto: Kohya
   interrompe l'addestramento..."), ma subito dopo la chiusura mostrava il verde "Progetto chiuso"
   nello stesso istante: c'e' un solo posto per gli avvisi, e l'avviso di Kohya non si vedeva mai.
   Ora, chiuso il progetto, resta a schermo l'avviso del .txt vuoto.
   Si eseguono i testi VERI di performSave, handleSaveAndCloseProject e chiudiFinestraSeRichiesto
   presi da src/App.tsx, con i testi veri di src/constants.ts; la chiusura del progetto e' finta e
   mostra "Progetto chiuso" come quella vera.
   Uso:  node scripts/test-save-close-empty-caption.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "SAVE AND CLOSE" WHEN THE SAVE EMPTIES A .TXT
   Removing every tag from a photo whose .txt had some and pressing "Close project" -> "Save and
   close", the save empties that .txt and says so ("One photo now has an empty .txt: Kohya stops
   training..."), but right after it the close showed the green "Project closed" in the same instant:
   there is a single slot for notices, and the Kohya warning was never seen. Now, once the project
   is closed, the empty .txt warning stays on screen.
   The REAL text of performSave, handleSaveAndCloseProject and chiudiFinestraSeRichiesto taken from
   src/App.tsx is run, with the real strings of src/constants.ts; the project close is a fake that
   shows "Project closed" like the real one.
   Usage:  node scripts/test-save-close-empty-caption.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const P = await carica('src/utils/pathUtils.ts');
const t = (await carica('src/constants.ts')).translations.en;
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const jsSalva = await ritaglia('    const performSave = async (imagesToSave: any[]');
const jsChiudi = (await ritaglia('    const chiudiFinestraSeRichiesto = ')) + '\n' + (await ritaglia('    const handleSaveAndCloseProject = async '));
const muto = { log() { }, warn() { }, error() { } };

// ITALIANO: una cartella aperta: `file` = i .txt che ci sono (nome -> testo).
// ENGLISH: an open folder: `file` = the .txt files present (name -> text).
const cartella = (presenti = {}) => {
    const c = { file: new Map(Object.entries(presenti)) };
    c.getFileHandle = async (nome, opz) => {
        if (!c.file.has(nome) && !(opz && opz.create)) throw new DOMException('not found', 'NotFoundError');
        return { createWritable: async () => { let testo = ''; return { write: async (s) => { testo += String(s); }, close: async () => { c.file.set(nome, testo); } }; } };
    };
    return c;
};

// ITALIANO: un'app ridotta con un solo posto per gli avvisi, come il Toast vero (vince l'ultimo).
//           `salva` = cosa fa "Salva modifiche" (di solito il performSave vero sulle foto date).
// ENGLISH: a trimmed app with a single slot for notices, like the real Toast (the last one wins).
//          `salva` = what "Save changes" does (usually the real performSave on the given photos).
const app = ({ dalla = 'progetto' } = {}) => {
    const a = { notifiche: [], chiusi: 0, progettiChiusi: 0, finestra: { isOpen: true, isSaving: false } };
    const avvisoSalvataggioRef = { current: '' };
    const showNotification = (m, tipo) => a.notifiche.push([m, tipo]);
    a.performSave = new Function('setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
        'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'isUndoRedoAction', 'avvisoSalvataggioRef', 'gemelliDelTxt',
        jsSalva + '\nreturn performSave;')(() => { }, () => { }, showNotification, t, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        {}, () => { }, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, { current: false }, avvisoSalvataggioRef, async () => () => { });
    a.salva = async () => true;
    const f = new Function('isSavingRef', 'showNotification', 't', 'setSaveCloseDialog', 'handleSaveChanges', 'closeProjectNow', 'console',
        'chiusuraFinestraRef', 'permettiChiusuraRef', 'window', 'avvisoSalvataggioRef', 'images', 'imagesRef', 'globalTriggersRef', 'fotoDaSalvare', jsChiudi + '\nreturn handleSaveAndCloseProject;')(
        { current: false }, showNotification, t, (d) => { a.finestra = d; }, () => a.salva(),
        () => { a.progettiChiusi++; showNotification(t.closeAllDone, 'success'); }, muto,
        { current: dalla === 'finestra' }, { current: false }, { close: () => { a.chiusi++; } }, avvisoSalvataggioRef, [], { current: [] }, { current: [] }, () => false);
    a.salvaEChiudi = f;
    a.ultimo = () => a.notifiche[a.notifiche.length - 1] || null;
    return a;
};

console.log('\n--- "Salva e chiudi" svuota un .txt che aveva dei tag ---');
{
    const a = app();
    const dir = cartella({ 'a.txt': 'smile, hat,' });
    a.salva = () => a.performSave([{ id: 'a', file: { name: 'a.png' }, tags: [], originalTags: ['smile', 'hat'], dirHandle: dir }]);
    await a.salvaEChiudi();
    dice('premessa: il .txt si svuota e il progetto si chiude', ['', 1, false], [dir.file.get('a.txt'), a.progettiChiusi, a.finestra.isOpen]);
    dice('l\'ultimo avviso a schermo e\' quello del .txt vuoto (non solo "Progetto chiuso"), in blu', [true, 'info'],
        [!!a.ultimo() && a.ultimo()[0].includes(t.saveEmptyCaptionOne), a.ultimo() && a.ultimo()[1]]);
    const b = app();
    const due = cartella({ 'a.txt': 'x,', 'b.txt': 'y,' });
    b.salva = () => b.performSave(['a', 'b'].map(id => ({ id, file: { name: id + '.png' }, tags: [], originalTags: ['z'], dirHandle: due })));
    await b.salvaEChiudi();
    dice('due foto: resta la frase al plurale con 2', true, !!b.ultimo() && b.ultimo()[0].includes(t.saveEmptyCaptionMany.replace('{n}', '2')));
    const c = app({ dalla: 'finestra' });
    c.salva = () => c.performSave([{ id: 'a', file: { name: 'a.png' }, tags: [], originalTags: ['smile'], dirHandle: cartella({ 'a.txt': 'smile,' }) }]);
    await c.salvaEChiudi();
    dice('dalla X della finestra: la finestra si chiude come prima', [1, 1], [c.progettiChiusi, c.chiusi]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app();
    const dir = cartella({ 'a.txt': 'smile,' });
    a.salva = () => a.performSave([{ id: 'a', file: { name: 'a.png' }, tags: ['smile', 'hat'], originalTags: ['smile'], dirHandle: dir }]);
    await a.salvaEChiudi();
    dice('un salvataggio normale: resta il verde "Progetto chiuso"', [t.closeAllDone, 'success'], a.ultimo());
    // ITALIANO: un avviso di un salvataggio di prima non torna fuori alla chiusura dopo.
    // ENGLISH: a warning from an earlier save does not come back at a later close.
    const b = app();
    await b.performSave([{ id: 'a', file: { name: 'a.png' }, tags: [], originalTags: ['smile'], dirHandle: cartella({ 'a.txt': 'smile,' }) }]);
    b.salva = async () => true;
    await b.salvaEChiudi();
    dice('"Salva modifiche" che svuota un .txt, poi "Salva e chiudi" senza niente da salvare: solo "Progetto chiuso"', [t.closeAllDone, 'success'], b.ultimo());
    const c = app();
    c.salva = async () => false;
    await c.salvaEChiudi();
    dice('salvataggio fallito: il progetto resta aperto, nessun avviso in piu\'', [0, true, []], [c.progettiChiusi, c.finestra.isOpen, c.notifiche]);
}

process.exit(esito());
