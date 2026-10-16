/* ITALIANO: PROVA DEL PESO DEL LOGO
   public/logo.png pesava 3 MB (1634 x 1633 pixel) ed entra nel programma installato, mentre il suo
   uso piu' grande e' 220 pixel (la copertina per Civitai; nell'app al massimo 112). Ora e' 512 x
   512: deve restare leggero, ma abbastanza grande per ogni uso (almeno 256 pixel per lato).
   Uso:  node scripts/test-public-logo-size.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE LOGO'S WEIGHT
   public/logo.png weighed 3 MB (1634 x 1633 pixels) and ships inside the installed program, while
   its largest use is 220 pixels. Now it is 512 x 512: it must stay light, yet big enough for every
   use (at least 256 pixels a side). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const b = fs.readFileSync(path.join(radice, 'public', 'logo.png'));
const lato = (o) => b.readUInt32BE(o);
dice('e\' un PNG', true, b.subarray(1, 4).toString('latin1') === 'PNG');
dice('pesa meno di 600 KB', true, b.length < 600 * 1024);
dice('almeno 256 pixel per lato (il suo uso piu\' grande e\' 220)', true, lato(16) >= 256 && lato(20) >= 256);
process.exit(esito());
