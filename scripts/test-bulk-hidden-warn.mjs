/* ITALIANO: PROVA DELL'AVVISO SULLE FOTO SELEZIONATE NASCOSTE DALLA RICERCA
   Selezionate 5 foto a mano, cercato un tag e premuto "Seleziona tutte", il pannello in blocco
   diceva "Foto selezionate nascoste dalla ricerca: 5. I tag vengono aggiunti comunque." Ma anche il
   tasto "Elimina selezionate" dello stesso pannello vale per tutta la selezione (lo dice il commento
   sopra handleMoveSelectedToTrash) e spostava nel cestino le 5 foto che non si vedevano, senza che
   l'avviso lo dicesse. Ora l'avviso, in tutte e nove le lingue, nomina quel tasto con la sua
   etichetta vera. Si leggono i testi veri di src/constants.ts e il pannello vero di src/App.tsx.
   Uso:  node scripts/test-bulk-hidden-warn.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NOTICE ABOUT SELECTED PHOTOS HIDDEN BY THE SEARCH
   With 5 photos selected by hand, a tag searched and "Select all" pressed, the bulk panel said
   "Selected photos hidden by the search: 5. The tags are added to them too." But the "Delete
   selected" button of the same panel also works on the whole selection (the comment above
   handleMoveSelectedToTrash says so) and moved the 5 photos nobody could see to the trash, with no
   word in the notice. The notice now names that button with its real label, in all nine
   languages. The real strings of src/constants.ts and the real panel of src/App.tsx are read.
   Usage:  node scripts/test-bulk-hidden-warn.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'))).translations;

// ITALIANO: premessa: il tasto che sposta nel cestino la selezione si legge t.deleteSelected, e
//           l'avviso sta nello stesso pannello. Se un giorno cambiasse etichetta, la prova va rivista.
// ENGLISH: premise: the button that moves the selection to the trash reads t.deleteSelected, and
//          the notice sits in the same panel. Should its label change one day, the test must be revised.
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const iAvviso = app.indexOf('t.bulkHiddenWarn');
const iTasto = app.indexOf('<button onClick={handleMoveSelectedToTrash}');
const etichetta = iTasto < 0 ? '' : app.slice(iTasto, app.indexOf('</button>', iTasto));
dice('premessa: l\'avviso e il tasto "Elimina selezionate" stanno nel pannello in blocco, il tasto dice t.deleteSelected',
    [true, true], [iAvviso > 0 && iTasto > iAvviso, etichetta.includes('{t.deleteSelected}')]);

const CODICI = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
for (const c of CODICI) {
    const L = lingue[c] || {};
    const avviso = String(L.bulkHiddenWarn || '');
    dice(`[${c}] l'avviso ha il numero {n} una volta sola`, 1, (avviso.match(/\{n\}/g) || []).length);
    dice(`[${c}] l'avviso nomina il tasto "${L.deleteSelected}" con la sua etichetta vera`, true, Boolean(L.deleteSelected) && avviso.includes(L.deleteSelected));
    dice(`[${c}] l'avviso parla ancora anche dei tag`, true, /tag|etiqueta|标签|タグ|тег/i.test(avviso));
}
process.exit(esito());
