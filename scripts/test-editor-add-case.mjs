/* ITALIANO: PROVA DEI TAG CHE DIFFERISCONO SOLO PER LE MAIUSCOLE NELL'EDITOR DEI FILE DI TAG
   Aprendo 0001.txt ("blue eyes, smile") nell'editor e scrivendo "Smile" (o premendo "Aggiungi i
   tag del progetto" mentre un'altra foto ha "Smile"), l'editor mostrava le due grafie e Salva
   scriveva "blue eyes, smile, Smile,". Nel resto dell'app (scheda, visore, pannello in blocco,
   incolla, import) le due grafie si uniscono e resta la prima: ora anche nell'editor.
   Si eseguono i testi VERI di aggiungiTag e aggiungiTagProgetto presi da
   src/components/TagFileEditor.tsx (compilati con esbuild), con src/utils/tagCase.ts vero.
   Uso:  node scripts/test-editor-add-case.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TAGS THAT DIFFER ONLY IN CASE IN THE TAG FILE EDITOR
   Opening 0001.txt ("blue eyes, smile") in the editor and typing "Smile" (or pressing "Add
   project tags" while another photo has "Smile"), the editor showed both spellings and Save wrote
   "blue eyes, smile, Smile,". Everywhere else in the app (card, viewer, bulk panel, paste, import)
   the two spellings are merged and the first one stays: now in the editor too.
   The REAL text of aggiungiTag and aggiungiTagProgetto taken from
   src/components/TagFileEditor.tsx is run (compiled with esbuild), with the real
   src/utils/tagCase.ts.
   Usage:  node scripts/test-editor-add-case.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const C = await carica('src/utils/tagCase.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log('NO  non trovato in src/components/TagFileEditor.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const testo = (await ritaglia('    const aggiungiTag = () => {')) + '\n' + (await ritaglia('    const aggiungiTagProgetto = () => {'));
const fabbrica = new Function('inputValue', 'setInputValue', 'setTags', 'setDirty', 'soundManager', 'projectTags', 'showNotification', 't',
    'uniqueTagsIgnoringCase', 'hasTagIgnoringCase', testo + '\nreturn { aggiungiTag, aggiungiTagProgetto };');

const editor = (tags, inputValue = '', projectTags = []) => {
    const r = { tags: [...tags], notifiche: [], dirty: false };
    r.fn = fabbrica(inputValue, () => { }, (f) => { r.tags = typeof f === 'function' ? f(r.tags) : f; }, (d) => { r.dirty = d; },
        { pop() { }, click() { } }, projectTags, (m, tipo) => r.notifiche.push([m, tipo]), t, C.uniqueTagsIgnoringCase, C.hasTagIgnoringCase);
    return r;
};

console.log('\n--- scrivere un tag che c\'e\' gia\' con altre maiuscole ---');
{
    const r = editor(['blue eyes', 'smile'], 'Smile');
    r.fn.aggiungiTag();
    dice('"Smile" su [blue eyes, smile]: resta un solo smile, la grafia del file', ['blue eyes', 'smile'], r.tags);
    const due = editor(['smile'], 'SMILE, Hat, hat');
    due.fn.aggiungiTag();
    dice('"SMILE, Hat, hat" su [smile]: smile, Hat', ['smile', 'Hat'], due.tags);
}

console.log('\n--- "Aggiungi i tag del progetto" con un\'altra grafia ---');
{
    const r = editor(['smile'], '', ['Smile', 'hat', 'Hat']);
    r.fn.aggiungiTagProgetto();
    dice('[smile] + progetto [Smile, hat, Hat]: smile, hat', ['smile', 'hat'], r.tags);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = editor(['smile'], 'blue eyes,red dress\nhat');
    r.fn.aggiungiTag();
    dice('tag nuovi in coda, in ordine', ['smile', 'blue eyes', 'red dress', 'hat'], r.tags);
    dice('il file risulta modificato', true, r.dirty);
    const doppio = editor(['smile'], 'smile');
    doppio.fn.aggiungiTag();
    dice('lo stesso tag identico: resta uno', ['smile'], doppio.tags);
    const vuoto = editor([], '', []);
    vuoto.fn.aggiungiTagProgetto();
    dice('progetto senza tag: avviso noTagsInProject', [[t.noTagsInProject, 'info']], vuoto.notifiche);
    const ohwx = editor(['OHWX'], 'Eiffel Tower');
    ohwx.fn.aggiungiTag();
    dice('le grafie restano come scritte', ['OHWX', 'Eiffel Tower'], ohwx.tags);
    const disco = editor(['smile', 'Smile'], 'hat');
    disco.fn.aggiungiTag();
    dice('un file che ha gia\' due grafie resta com\'e\' (si aggiunge solo hat)', ['smile', 'Smile', 'hat'], disco.tags);
}

process.exit(esito());
