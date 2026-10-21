/* ITALIANO: PROVA DEL TESTO SCRITTO SENZA INVIO NEL PANNELLO IN BLOCCO
   Pannello in blocco: si clicca la pillola "smile" (compare "Conferma"), si scrive "red dress" nella
   casella "Scrivi un tag da aggiungere..." senza premere Invio e si clicca "Conferma". Arrivava solo
   "smile": il pannello si chiudeva da solo e "red dress" spariva senza nessun avviso (la casella
   passava il testo ai tag solo con Invio o con la virgola). Ora "Conferma" prende anche il testo
   rimasto nella casella, diviso come con Invio (splitTagInput) e senza doppioni.
   Si esegue il testo VERO di applyBulkTags preso da src/App.tsx, con le regole vere di
   src/utils/tagCase.ts e i testi veri di src/constants.ts.
   Uso:  node scripts/test-bulk-pending-input.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TEXT TYPED WITHOUT ENTER IN THE BULK PANEL
   Bulk panel: the "smile" pill is clicked ("Confirm" appears), "red dress" is typed into the "Type a
   tag to add..." box without pressing Enter and "Confirm" is clicked. Only "smile" arrived: the panel
   closed by itself and "red dress" vanished with no notice (the box handed the text over only on
   Enter or a comma). Now "Confirm" also takes the text left in the box, split as with Enter
   (splitTagInput) and without duplicates.
   The REAL text of applyBulkTags taken from src/App.tsx is run, with the real rules of
   src/utils/tagCase.ts and the real strings of src/constants.ts.
   Usage:  node scripts/test-bulk-pending-input.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const C = await carica('src/utils/tagCase.ts');
const t = (await carica('src/constants.ts')).translations.en;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const i0 = sorgente.indexOf('    const applyBulkTags = () => {');
const fine = /\r?\n    \};\r?\n/g;
fine.lastIndex = Math.max(i0, 0);
const f0 = i0 < 0 ? null : fine.exec(sorgente);
if (!f0) { console.log('NO  applyBulkTags non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(i0, f0.index + f0[0].length), { loader: 'ts' })).code;
const fabbrica = new Function('images', 'selectedForBulk', 'stagedBulkTags', 'globalTriggers', 'setImages', 'setStagedBulkTags', 'setSelectedForBulk',
    'soundManager', 'showNotification', 't', 'uniqueTagsIgnoringCase', 'countNewTagsIgnoringCase', 'bulkAddInputRef', 'splitTagInput', 'hasTagIgnoringCase',
    codice + '\nreturn applyBulkTags;');

// ITALIANO: preme Conferma con `inPreparazione` (le pillole segnate) e `scritto` nella casella.
// ENGLISH: presses Confirm with `inPreparazione` (the marked pills) and `scritto` in the box.
const conferma = (foto, inPreparazione, scritto) => {
    const casella = { value: scritto };
    const r = { foto, notifiche: [], casella };
    fabbrica(foto, foto.map(f => f.id), inPreparazione, [], (fn) => { r.foto = fn(r.foto); }, () => { }, () => { },
        { chime() { }, pop() { } }, (m, tipo) => r.notifiche.push([m, tipo]), t, C.uniqueTagsIgnoringCase, C.countNewTagsIgnoringCase,
        { current: casella }, C.splitTagInput, C.hasTagIgnoringCase)();
    return r;
};
const cinque = () => Array.from({ length: 5 }, (_, i) => ({ id: 'f' + i, isTrashed: false, tags: ['1girl'] }));
const aggiunti = (tags, images) => [[t.bulkTagsAdded.replace('{tags}', String(tags)).replace('{images}', String(images)), 'success']];

console.log('\n--- pillola segnata e testo scritto senza Invio ---');
{
    const r = conferma(cinque(), ['smile'], 'red dress');
    dice('le 5 foto ricevono "smile" E "red dress"', true, r.foto.every(f => f.tags.includes('smile') && f.tags.includes('red dress')));
    dice('avviso "Tag aggiunti: 2. Foto interessate: 5."', aggiunti(2, 5), r.notifiche);
    dice('la casella resta vuota', '', r.casella.value);
}
{
    const r = conferma(cinque(), ['smile'], 'red dress, blue eyes');
    dice('un elenco con le virgole diventa un tag per voce, come con Invio', ['1girl', 'blue eyes', 'red dress', 'smile'], r.foto[0].tags);
}
{
    const r = conferma(cinque(), ['smile'], 'Smile');
    dice('testo uguale a una pillola (maiuscole a parte): nessun doppione', [['1girl', 'smile'], aggiunti(1, 5)], [r.foto[0].tags, r.notifiche]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = conferma(cinque(), ['smile'], '   ');
    dice('casella vuota: solo le pillole, come prima', [['1girl', 'smile'], aggiunti(1, 5)], [r.foto[0].tags, r.notifiche]);
}
{
    const r = conferma(cinque(), ['1girl'], '1GIRL');
    dice('niente di nuovo (anche dal testo): messaggio neutro, foto invariate', [[[t.bulkTagsNothingNew, 'info']], ['1girl']], [r.notifiche, r.foto[0].tags]);
}

process.exit(esito());
