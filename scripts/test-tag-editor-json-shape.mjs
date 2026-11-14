/* ITALIANO: PROVA DELLA FORMA DI UN .JSON RISALVATO DALL'EDITOR DEI FILE DI TAG
   L'editor apre sia un elenco semplice ["1girl","solo"] sia un oggetto con "tags", ma Salva riscriveva
   ogni .json nella forma del programma ({app, type, version, globalTriggers, tags}): l'elenco non era
   piu' un elenco (un altro programma che lo leggeva non lo leggeva piu') e i campi di un altro
   programma ("notes", "weights") sparivano, con l'avviso verde «File salvato». Ora Salva sullo stesso
   file tiene la forma letta: un elenco resta un elenco, un oggetto tiene i suoi campi e cambia solo
   "tags" (e "globalTriggers" se c'era). «Nuovo» e «Salva come» con un altro nome scrivono la forma
   del programma, come prima. Si eseguono i testi VERI di parseTagFile, parseTagTriggers,
   parseTagShape, serializeTagFile, inAttesa, caricaTesto e salva presi da
   src/components/TagFileEditor.tsx.
   Uso:  node scripts/test-tag-editor-json-shape.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SHAPE OF A .JSON SAVED BACK BY THE TAG FILE EDITOR
   The editor opens both a plain list ["1girl","solo"] and an object with "tags", but Save rewrote
   every .json in the program's shape ({app, type, version, globalTriggers, tags}): the list was no
   longer a list (another program reading it could not read it any more) and another program's
   fields ("notes", "weights") vanished, with the green "File saved" notice. Now Save on the same
   file keeps the shape it read: a list stays a list, an object keeps its fields and only "tags" (and
   "globalTriggers" when present) change. "New" and "Save as" under another name write the program's
   shape, as before. The REAL texts of parseTagFile, parseTagTriggers, parseTagShape,
   serializeTagFile, inAttesa, caricaTesto and salva from src/components/TagFileEditor.tsx are run.
   Usage:  node scripts/test-tag-editor-json-shape.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(process.argv[2] || path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');

const ritaglia = (intestazione, chiusura, riserva) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        if (riserva !== undefined) return riserva;
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
    // ITALIANO: sul codice di prima non c'e': la prova mostra lo stesso il comportamento sbagliato.
    // ENGLISH: absent in the old code: the test still shows the wrong behaviour.
    ritaglia('export const parseTagShape = (', fuori, 'const parseTagShape = () => null;'),
    ritaglia('export const serializeTagFile = (', fuori),
    ritaglia('    const inAttesa = (): string[] => ', /;\r?\n/g),
    ritaglia('    const caricaTesto = (', dentro),
    ritaglia('    const salva = async (forzaNuovoFile = false): Promise<boolean> => {', dentro),
].join('\n');
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const fabbrica = new Function('inputValue', 'tags', 'fileName', 'rileggendo', 'handleRef', 'triggersRef', 'formaJsonRef', 'savedTagsRef', 'tagsRef',
    'setDirty', 'setFileName', 'setTags', 'setInputValue', 'onImportTagsToProject', 'soundManager', 'showNotification', 't', 'onFileSaved',
    'window', 'document', 'URL', 'Blob', 'uniqueTagsIgnoringCase', 'hasTagIgnoringCase',
    codice + '\nreturn { caricaTesto, inAttesa, salva, serializeTagFile };');

// ITALIANO: l'editor finto: apre `contenuto` con il nome `nome` (come Apri con il selettore), poi
//           `aggiungi` aggiunge un tag e `salva` riscrive; `scritture` = cosa finisce nel file.
// ENGLISH: the fake editor: opens `contenuto` named `nome` (like Open with the picker), then
//          `aggiungi` adds a tag and `salva` writes back; `scritture` = what lands in the file.
const editor = (contenuto, nome, nomeSalvaCome = 'altro.json') => {
    const stato = { tags: [], casella: '', nome: '', scritture: [], notifiche: [] };
    const handle = { name: nome, async createWritable() { return { async write(c) { stato.scritture.push(c); }, async close() { } }; } };
    const nuovo = { name: nomeSalvaCome, async createWritable() { return { async write(c) { stato.scritture.push(c); }, async close() { } }; } };
    const refs = { handleRef: { current: null }, triggersRef: { current: [] }, formaJsonRef: { current: null }, savedTagsRef: { current: [] }, tagsRef: { current: [] } };
    stato.refs = refs;
    stato.render = () => fabbrica(stato.casella, stato.tags, stato.nome, false, refs.handleRef, refs.triggersRef, refs.formaJsonRef, refs.savedTagsRef, refs.tagsRef,
        () => { }, (v) => { stato.nome = v; }, (v) => { stato.tags = v; refs.tagsRef.current = v; }, (v) => { stato.casella = v; },
        () => { }, { chime() { }, pop() { } }, (m, tipo) => stato.notifiche.push([m, tipo]),
        { tagEditorSaved: 'File saved', tagEditorSaveError: 'Could not save', tagEditorDownloaded: 'A copy was downloaded ({name}).' },
        () => { }, { async showSaveFilePicker() { return nuovo; } }, {}, URL, Blob, (l) => [...new Set(l)], (l, x) => l.includes(x));
    stato.render().caricaTesto(contenuto, nome);
    refs.handleRef.current = handle;
    stato.aggiungi = (tag) => { stato.tags = [...stato.tags, tag]; refs.tagsRef.current = stato.tags; };
    stato.ultimo = () => JSON.parse(stato.scritture[stato.scritture.length - 1]);
    return stato;
};

console.log('\n--- un elenco semplice ---');
{
    const e = editor('["1girl","solo","smile"]', 'lista.json');
    e.aggiungi('new tag');
    dice('premessa: il salvataggio riesce', true, await e.render().salva());
    dice('Salva sullo stesso file: resta un elenco con il tag nuovo', ['1girl', 'solo', 'smile', 'new tag'], e.ultimo());
    e.aggiungi('another');
    await e.render().salva();
    dice('...anche al secondo Salva', ['1girl', 'solo', 'smile', 'new tag', 'another'], e.ultimo());
}

console.log('\n--- l\'oggetto di un altro programma ---');
{
    const e = editor(JSON.stringify({ tags: ['1girl', 'solo'], notes: 'keep me', weights: { '1girl': 1.2 } }), 'altrui.json');
    e.aggiungi('smile');
    await e.render().salva();
    dice('Salva tiene notes e weights e cambia solo tags',
        { tags: ['1girl', 'solo', 'smile'], notes: 'keep me', weights: { '1girl': 1.2 } }, e.ultimo());
    dice('...senza aggiungere i campi del programma', [], ['app', 'type', 'version', 'globalTriggers'].filter(k => k in e.ultimo()));
}
{
    const e = editor(JSON.stringify({ name: 'set', globalTriggers: ['ohwx'], tags: ['a'], extra: [1, 2] }), 'conTrigger.JSON');
    e.aggiungi('b');
    await e.render().salva();
    dice('oggetto con globalTriggers: trigger e campi propri restano al loro posto',
        { name: 'set', globalTriggers: ['ohwx'], tags: ['a', 'b'], extra: [1, 2] }, e.ultimo());
}

console.log('\n--- quello che non deve cambiare ---');
{
    const proprio = JSON.stringify({ app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: ['ohwx'], tags: ['a'] }, null, 2);
    const e = editor(proprio, 'progetto.json');
    e.aggiungi('b');
    await e.render().salva();
    dice('il file del programma resta identico nella forma',
        JSON.stringify({ app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: ['ohwx'], tags: ['a', 'b'] }, null, 2),
        e.scritture[0]);
}
{
    const e = editor('["1girl","solo"]', 'lista.json', 'copia.json');
    await e.render().salva(true);
    dice('«Salva come» con un altro nome: la forma del programma, come prima',
        { app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: [], tags: ['1girl', 'solo'] }, e.ultimo());
    await e.render().salva();
    dice('...e il file nuovo resta in quella forma ai Salva dopo', 'project-tags', e.ultimo().type);
}
{
    const e = editor('["1girl","solo"]', 'lista.json', 'lista.txt');
    await e.render().salva(true);
    dice('«Salva come» .txt: tag separati da virgole', '1girl, solo,', e.scritture[0]);
}
{
    const e = editor('1girl, solo,', 'a.txt');
    e.aggiungi('smile');
    await e.render().salva();
    dice('un .txt resta un .txt', '1girl, solo, smile,', e.scritture[0]);
}
{
    const e = editor('["a"]', 'lista.json');
    const s = e.render().serializeTagFile(['x'], 'nuovo.json', []);
    dice('serializeTagFile senza forma letta (Nuovo): forma del programma', 'project-tags', JSON.parse(s).type);
}

process.exit(esito());
