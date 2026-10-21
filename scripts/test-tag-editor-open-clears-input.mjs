/* ITALIANO: PROVA DELL'EDITOR DEI FILE DI TAG: APRIRE UN ALTRO FILE SVUOTA LA CASELLA
   Nell'editor e' aperto X.txt e nella casella c'e' "red dress", scritto senza Invio. Apri chiede
   se scartare le modifiche (il testo in attesa conta come modifica) e l'utente sceglie "Chiudi
   senza salvare". Si apriva Y.txt con i suoi tag, ma "red dress" restava nella casella, e il primo
   Salva (o "Salva e chiudi") lo scriveva DENTRO Y.txt: il testo che l'utente aveva deciso di
   buttare finiva in un altro file. Ora aprire un file parte sempre con la casella vuota; un file
   illeggibile non tocca niente (ne' tag ne' casella).
   Si eseguono i testi VERI di caricaTesto, inAttesa e salva presi da
   src/components/TagFileEditor.tsx (compilati con esbuild), con uno stato finto.
   Uso:  node scripts/test-tag-editor-open-clears-input.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR: OPENING ANOTHER FILE EMPTIES THE INPUT BOX
   X.txt is open in the editor and the box holds "red dress", typed without Enter. Open asks
   whether to discard the edits (pending text counts as an edit) and the user picks "Close without
   saving". Y.txt opened with its tags, but "red dress" stayed in the box, and the first Save (or
   "Save and close") wrote it INTO Y.txt: the text the user had chosen to throw away landed in
   another file. Now opening a file always starts with an empty box; an unreadable file touches
   nothing (neither tags nor box).
   The REAL texts of caricaTesto, inAttesa and salva taken from src/components/TagFileEditor.tsx
   are run (compiled with esbuild) with a fake state.
   Usage:  node scripts/test-tag-editor-open-clears-input.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');

const ritaglia = (intestazione, chiusura) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log('NO  non trovato in src/components/TagFileEditor.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return sorgente.slice(inizio, fine.index + fine[0].length).replace(/^export /, '');
};
const fuori = /\r?\n\};\r?\n/g;
const dentro = /\r?\n    \};\r?\n/g;
const testo = [
    ritaglia('const SEMBRA_JSON = ', /;\r?\n/g),
    ritaglia('export const parseTagFile = (', fuori),
    ritaglia('export const parseTagTriggers = (', fuori),
    ritaglia('export const serializeTagFile = (', fuori),
    ritaglia('    const inAttesa = (): string[] => ', /;\r?\n/g),
    ritaglia('    const caricaTesto = (', dentro),
    ritaglia('    const salva = async (forzaNuovoFile = false): Promise<boolean> => {', dentro),
].join('\n');
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const fabbrica = new Function('inputValue', 'tags', 'fileName', 'rileggendo', 'handleRef', 'triggersRef', 'savedTagsRef', 'tagsRef',
    'setDirty', 'setFileName', 'setTags', 'setInputValue', 'onImportTagsToProject', 'soundManager', 'showNotification', 't', 'onFileSaved',
    'window', 'document', 'URL', 'Blob', 'uniqueTagsIgnoringCase', 'hasTagIgnoringCase',
    codice + '\nreturn { caricaTesto, inAttesa, salva };');

// ITALIANO: l'editor finto: `stato` tiene tag, casella e nome; render() da' le funzioni vere viste
//           dallo stato di adesso, come un render di React. `scritture` = cosa finisce nel file.
// ENGLISH: the fake editor: `stato` holds tags, box and name; render() gives the real functions as
//          seen from the current state, like a React render. `scritture` = what lands in the file.
const editor = (tags, casella, nome) => {
    const stato = { tags, casella, nome, scritture: [], notifiche: [] };
    const handle = { async createWritable() { return { async write(c) { stato.scritture.push(c); }, async close() { } }; } };
    const refs = { handleRef: { current: handle }, triggersRef: { current: [] }, savedTagsRef: { current: [...tags] }, tagsRef: { current: tags } };
    stato.render = () => fabbrica(stato.casella, stato.tags, stato.nome, false, refs.handleRef, refs.triggersRef, refs.savedTagsRef, refs.tagsRef,
        () => { }, (v) => { stato.nome = v; }, (v) => { stato.tags = v; refs.tagsRef.current = v; }, (v) => { stato.casella = v; },
        () => { }, { chime() { }, pop() { } }, (m, tipo) => stato.notifiche.push([m, tipo]),
        { tagEditorSaved: 'File saved', tagEditorSaveError: 'Could not save', tagEditorDownloaded: 'A copy was downloaded ({name}).' },
        () => { }, {}, {}, URL, Blob, (l) => [...new Set(l)], (l, x) => l.includes(x));
    return stato;
};

console.log('\n--- testo in attesa scartato, poi si apre Y.txt ---');
{
    const e = editor(['blue sky'], 'red dress', 'X.txt');
    dice('premessa: con "red dress" nella casella c\'e\' un testo in attesa', ['red dress'], e.render().inAttesa());
    // ITALIANO: "Chiudi senza salvare" esegue l'azione di Apri, che legge Y.txt con caricaTesto.
    // ENGLISH: "Close without saving" runs the Open action, which reads Y.txt with caricaTesto.
    e.render().caricaTesto('cat, smile,', 'Y.txt');
    dice('Y.txt si apre con i suoi tag', [['cat', 'smile'], 'Y.txt'], [e.tags, e.nome]);
    dice('...e la casella e\' vuota: il testo scartato non resta', '', e.casella);
    dice('...quindi non c\'e\' piu\' niente in attesa', [], e.render().inAttesa());
    dice('Salva su Y.txt scrive solo i tag di Y.txt (niente "red dress")', true, await e.render().salva(false));
    dice('...contenuto scritto', ['cat, smile,'], e.scritture);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const e = editor(['blue sky'], 'red dress', 'X.txt');
    let errore = null;
    try { e.render().caricaTesto('{"tags": "non un elenco"', 'Y.json'); } catch (err) { errore = err; }
    dice('un file illeggibile lancia un errore (chi chiama avvisa)', true, errore !== null);
    dice('...e non tocca ne\' tag, ne\' nome, ne\' casella', [['blue sky'], 'X.txt', 'red dress'], [e.tags, e.nome, e.casella]);
    const s = editor(['blue sky'], 'red dress', 'X.txt');
    dice('senza aprire altro, Salva scrive anche il testo in attesa (come prima)', true, await s.render().salva(false));
    dice('...contenuto scritto', ['blue sky, red dress,'], s.scritture);
    const v = editor([], '', '');
    v.render().caricaTesto('1girl, smile,', 'a.txt');
    dice('aprire con la casella gia\' vuota resta come prima', [['1girl', 'smile'], ''], [v.tags, v.casella]);
}

process.exit(esito());
