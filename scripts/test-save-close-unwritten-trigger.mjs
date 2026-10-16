/* ITALIANO: PROVA: "SALVA E CHIUDI" NON COPRE LA FRASE DELLE FOTO A CUI LA TRIGGER NON ARRIVA
   Una foto il cui .txt non si e' potuto leggere all'apertura, che ha in piu' solo la trigger, non
   si scrive: "Salva" lo dice con una frase che la nomina (2.0.1). Con "Chiudi progetto" -> "Salva e
   chiudi" il salvataggio riusciva (le altre foto si scrivevano) e subito dopo "Progetto chiuso"
   prendeva l'unico posto degli avvisi: la frase non si vedeva, e chi addestra non sapeva che quel
   .txt era rimasto senza trigger. Lo stesso con solo quella foto (niente da scrivere). Ora, chiuso
   il progetto, la frase resta a schermo, come gia' l'avviso dei .txt svuotati (insieme se ci sono
   tutte e due). Casi vicini che non cambiano: un salvataggio normale lascia "Progetto chiuso"; con
   una modifica vera su una foto col .txt non letto il progetto non si chiude.
   Si eseguono i testi VERI di performSave, handleSaveChanges, handleSaveAndCloseProject e
   chiudiFinestraSeRichiesto presi da src/App.tsx; la chiusura del progetto e' finta e mostra
   "Progetto chiuso" come quella vera.
   Uso:  node scripts/test-save-close-unwritten-trigger.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: "SAVE AND CLOSE" DOES NOT COVER THE SENTENCE ON PHOTOS THE TRIGGER DOES NOT REACH
   A photo whose .txt could not be read at opening, whose only extra is the trigger, is not
   written: "Save" says so with a sentence naming it (2.0.1). With "Close project" -> "Save and
   close" the save succeeded (the other photos were written) and right after "Project closed" took
   the single notice slot: the sentence was never seen, and the trainer did not know that .txt
   stayed without the trigger. The same with that photo alone (nothing to write). Now, once the
   project is closed, the sentence stays on screen, like the emptied-.txt warning already does
   (together when both are there). Neighbouring cases that do not change: a normal save leaves
   "Project closed"; with a real edit on a photo with an unread .txt the project does not close.
   The REAL texts of performSave, handleSaveChanges, handleSaveAndCloseProject and
   chiudiFinestraSeRichiesto taken from src/App.tsx are run.
   Usage:  node scripts/test-save-close-unwritten-trigger.mjs      (exits with code 1 if anything is off) */

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
const S = await carica('src/utils/sidecarTags.ts');
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
const codice = [
    await ritaglia('    const performSave = async (imagesToSave: any[]'),
    await ritaglia('    const handleSaveChanges = async (): Promise<boolean> => {'),
    await ritaglia('    const chiudiFinestraSeRichiesto = '),
    await ritaglia('    const handleSaveAndCloseProject = async '),
].join('\n');
const NOMI = ['setIsSaving', 'setImportProgress', 'showNotification', 't', 'getOrderedTagString', 'window', 'setImages', 'soundManager', 'console',
    'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'isUndoRedoAction', 'avvisoSalvataggioRef', 'gemelliDelTxt',
    'images', 'fotoDaSalvare', 'globalTriggers', 'txtNonLettoInVigore',
    'isSavingRef', 'setSaveCloseDialog', 'closeProjectNow', 'chiusuraFinestraRef', 'permettiChiusuraRef'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { handleSaveAndCloseProject };');
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
// ITALIANO: una foto col .txt non letto all'import: originalTags e baseTxtNonLetto sono lo STESSO array.
// ENGLISH: a photo with a .txt not read at import: originalTags and baseTxtNonLetto are the SAME array.
const nonLetta = (nome, tags, dir) => { const base = []; return { id: nome, file: { name: nome }, tags, originalTags: base, baseTxtNonLetto: base, dirHandle: dir }; };

// ITALIANO: un'app ridotta con un solo posto per gli avvisi, come il Toast vero (vince l'ultimo).
// ENGLISH: a trimmed app with a single slot for notices, like the real Toast (the last one wins).
const app = (images, trigger, { dalla = 'progetto' } = {}) => {
    const a = { notifiche: [], chiusi: 0, progettiChiusi: 0, finestra: { isOpen: true, isSaving: false } };
    const showNotification = (m, tipo) => a.notifiche.push([m, tipo]);
    const nulla = () => { };
    a.salvaEChiudi = fabbrica(nulla, nulla, showNotification, t, (tags) => (tags.length ? tags.join(', ') + ',' : ''), { close: () => { a.chiusi++; } },
        nulla, { chime() { } }, muto, P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, { current: false }, { current: '' }, async () => () => { },
        images, S.fotoDaSalvare, trigger, S.txtNonLettoInVigore,
        { current: false }, (d) => { a.finestra = d; }, () => { a.progettiChiusi++; showNotification(t.closeAllDone, 'success'); },
        { current: dalla === 'finestra' }, { current: false }).handleSaveAndCloseProject;
    a.ultimo = () => a.notifiche[a.notifiche.length - 1] || null;
    return a;
};
const fraseUna = (nome) => t.saveUnreadTxtOne.replace('{names}', nome);

console.log('\n--- una foto davvero modificata + una col .txt non letto e la sola trigger ---');
{
    const dir = cartella({ 'a.txt': 'smile,' });
    const a = app([
        { id: 'a', file: { name: 'a.png' }, tags: ['ohwx', 'smile', 'hat'], originalTags: ['smile'], dirHandle: dir },
        nonLetta('b.png', ['ohwx'], dir),
    ], ['ohwx']);
    await a.salvaEChiudi();
    dice('premessa: a.txt scritto, b.txt no, progetto chiuso', ['ohwx, smile, hat,', false, 1], [dir.file.get('a.txt'), dir.file.has('b.txt'), a.progettiChiusi]);
    dice('l\'ultimo avviso a schermo nomina b.png (non solo "Progetto chiuso")', [true, 'info'],
        [!!a.ultimo() && a.ultimo()[0].includes(fraseUna('b.png')), a.ultimo() && a.ultimo()[1]]);
}

console.log('\n--- solo la foto col .txt non letto e la trigger (niente da scrivere) ---');
{
    const a = app([nonLetta('b.png', ['ohwx'], cartella())], ['ohwx']);
    await a.salvaEChiudi();
    dice('il progetto si chiude e resta a schermo la frase su b.png', [1, [fraseUna('b.png'), 'info']], [a.progettiChiusi, a.ultimo()]);
}

console.log('\n--- .txt svuotato E foto senza trigger: tutte e due le frasi ---');
{
    const dir = cartella({ 'a.txt': 'smile,' });
    const a = app([
        { id: 'a', file: { name: 'a.png' }, tags: [], originalTags: ['smile'], dirHandle: dir },
        nonLetta('b.png', ['ohwx'], dir),
    ], ['ohwx']);
    await a.salvaEChiudi();
    dice('l\'ultimo avviso ha la frase del .txt vuoto e quella su b.png', [true, true],
        [!!a.ultimo() && a.ultimo()[0].includes(t.saveEmptyCaptionOne), !!a.ultimo() && a.ultimo()[0].includes(fraseUna('b.png'))]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const dir = cartella({ 'a.txt': 'smile,' });
    const a = app([{ id: 'a', file: { name: 'a.png' }, tags: ['smile', 'hat'], originalTags: ['smile'], dirHandle: dir }], []);
    await a.salvaEChiudi();
    dice('un salvataggio normale: resta il verde "Progetto chiuso"', [t.closeAllDone, 'success'], a.ultimo());
}
{
    const dir = cartella({ 'a.txt': 'smile,' });
    const a = app([
        { id: 'a', file: { name: 'a.png' }, tags: ['smile', 'hat'], originalTags: ['smile'], dirHandle: dir },
        nonLetta('b.png', ['ohwx', 'red dress'], dir),
    ], ['ohwx']);
    await a.salvaEChiudi();
    dice('una modifica vera su una foto col .txt non letto: il progetto NON si chiude', [0, true], [a.progettiChiusi, a.finestra.isOpen]);
}
{
    const a = app([nonLetta('b.png', ['ohwx'], cartella())], ['ohwx'], { dalla: 'finestra' });
    await a.salvaEChiudi();
    dice('dalla X della finestra: la finestra si chiude come prima', [1, 1], [a.progettiChiusi, a.chiusi]);
}

process.exit(esito());
