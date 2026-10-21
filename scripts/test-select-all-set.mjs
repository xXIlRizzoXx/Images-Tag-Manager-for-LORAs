/* ITALIANO: PROVA CHE "TUTTE SELEZIONATE?" USI L'INSIEME DELLA SELEZIONE
   Il tasto "Seleziona tutte" decide il suo colore a ogni disegno della pagina chiedendo, per ogni
   foto visibile, se e' selezionata. Con selectedForBulk.includes era una scansione dell'elenco per
   ogni foto: con migliaia di foto selezionate, milioni di confronti a ogni tasto premuto. Il file
   ha gia' l'insieme selectedForBulkSet (una ricerca per foto): lo usano anche questi due punti.
   Uso:  node scripts/test-select-all-set.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT "ALL SELECTED?" USES THE SELECTION SET
   The "Select all" button decides its colour on every render by asking, for each visible photo,
   whether it is selected. With selectedForBulk.includes it was a scan of the list per photo. The
   file already has selectedForBulkSet (one lookup per photo): these two places use it too. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const s = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

const allSelected = [...s.matchAll(/const allSelected = [^\n]+/g)].map(m => m[0]);
dice('due calcoli di "tutte selezionate" (il tasto e il suo colore)', 2, allSelected.length);
dice('nessuno scorre l\'elenco della selezione con includes', [], allSelected.filter(r => r.includes('selectedForBulk.includes')));
dice('tutti e due usano selectedForBulkSet.has', [true, true], allSelected.map(r => r.includes('selectedForBulkSet.has(')));

process.exit(esito());
