/* ITALIANO: PROVA CHE LE SCHEDE ILLUSTRATE DEL README DICANO IL VERO SU MODIFICA IN BLOCCO E ORDINAMENTO
   Due schede di scripts/make-feature-cards.mjs (le immagini docs/img/features del README) promettevano
   cose che il programma non fa. "Bulk tagging" diceva che un clic su un tag lo mette su tutte le foto
   e un secondo clic lo toglie da tutte: in realta' il clic segna soltanto il tag, i tag arrivano sulle
   foto con il pulsante Conferma (applyBulkTags, che aggiunge e basta) e un secondo clic toglie solo il
   segno. "Two views" diceva "Sort by name or by date added": l'ordinamento per data usa la data di
   modifica del file sul disco (file.lastModified), non la data in cui la foto e' entrata nel progetto.
   Si controllano prima le premesse sul codice VERO di src/App.tsx, poi il testo delle due schede, e
   che la scheda nomini il pulsante con la sua etichetta inglese vera.
   Uso:  node scripts/test-feature-cards-claims.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE README FEATURE CARDS TELL THE TRUTH ABOUT BULK TAGGING AND SORTING
   Two cards of scripts/make-feature-cards.mjs (the docs/img/features images of the README) promised
   things the program does not do. "Bulk tagging" said one click on a tag puts it on every photo and a
   second click removes it from all of them: in fact the click only marks the tag, the tags reach the
   photos with the Confirm button (applyBulkTags, which only adds) and a second click only removes the
   mark. "Two views" said "Sort by name or by date added": sorting by date uses the file's modification
   date on disk (file.lastModified), not the date the photo joined the project.
   The premises are checked on the REAL code of src/App.tsx first, then the text of the two cards, and
   that the card names the button by its real English label.
   Usage:  node scripts/test-feature-cards-claims.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8').replace(/\r\n/g, '\n');

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const { translations } = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const app = leggi('src/App.tsx');
const schede = leggi('scripts/make-feature-cards.mjs');

// ITALIANO: la scheda con quel nome, dal suo "nome:" alla chiusura del suo oggetto.
// ENGLISH: the card with that name, from its "nome:" to the end of its object.
const scheda = (nome) => {
    const i = schede.indexOf(`nome: '${nome}'`);
    return i < 0 ? '' : schede.slice(i, schede.indexOf('\n    },', i));
};

// ITALIANO: premesse sul codice: come funziona davvero il pannello in blocco e come si ordina per data.
// ENGLISH: premises on the code: how the bulk panel really works and how sorting by date works.
dice('premessa: il clic su un tag del pannello in blocco segna o toglie il segno e basta', true,
    app.includes('onClick={() => setStagedBulkTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}'));
dice('premessa: i tag arrivano sulle foto con il pulsante Conferma (applyBulkTags)', true,
    /<button onClick=\{applyBulkTags\}[^\n]*\n[^\n]*\n\s*<span>\{t\.confirm\}<\/span>/.test(app));
const i = app.indexOf('const applyBulkTags = () => {');
const corpo = i < 0 ? '' : app.slice(i, app.indexOf('\n    };', i));
dice('premessa: applyBulkTags aggiunge e non toglie (unisce i tag della foto con quelli segnati)', true,
    corpo.includes('uniqueTagsIgnoringCase([...img.tags, ...daAggiungere], globalTriggers)')
    && corpo.includes('const daAggiungere = [...stagedBulkTags, ') && !/tags\.filter\(/.test(corpo));
dice('premessa: l\'ordinamento per data usa la data di modifica del file', true,
    /order === 'date-asc'\) list\.sort\(\(a, b\) => a\.file\.lastModified - b\.file\.lastModified\)/.test(app));

// ITALIANO: la scheda della modifica in blocco.
// ENGLISH: the bulk tagging card.
const blocco = scheda('03-bulk-tagging');
dice('premessa: la scheda 03-bulk-tagging esiste', true, blocco.length > 0);
dice('la scheda in blocco non promette che un secondo clic toglie il tag da tutte', false, /click again|gone from all|removed from all/i.test(blocco));
dice('la scheda in blocco non dice che il clic basta a mettere il tag', false, /click a tag: it lands/i.test(blocco));
dice(`la scheda in blocco nomina il pulsante con la sua etichetta vera ("${translations.en.confirm}")`, true, blocco.includes(translations.en.confirm));

// ITALIANO: la scheda delle due viste.
// ENGLISH: the two views card.
const viste = scheda('11-views');
dice('premessa: la scheda 11-views esiste', true, viste.length > 0);
dice('la scheda delle viste non parla di "date added"', false, /date added|added date/i.test(viste));
dice('la scheda delle viste dice che si ordina per data del file', true, /by file date/.test(viste));

process.exit(esito());
