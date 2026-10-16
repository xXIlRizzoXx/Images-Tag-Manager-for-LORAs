/* ITALIANO: PROVA DELLA FASCIA IN ALTO QUANDO LA FINESTRA E' STRETTA
   I tre riquadri in alto (carica / trigger words e AI / pulsanti del progetto) stavano su una riga
   con i laterali larghi fissi 420 px. Alla larghezza minima della finestra (1024 px) quello
   centrale restava largo 46 px e i suoi pulsanti uscivano dal bordo; con laterali piu' stretti
   (360 px) uscivano invece i pulsanti dei laterali in tedesco, francese, spagnolo e russo.
   Misurato nell'anteprima, in tutte e 9 le lingue: ora fra 1024 e 1535 px laterali affiancati e
   centrale sotto, a tutta larghezza e su una riga sola; dai 1536 px la riga unica di prima.
   Uso:  node scripts/test-toolbar-narrow.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TOP BAND WHEN THE WINDOW IS NARROW
   The three top panels (load / trigger words and AI / project buttons) sat on one row with the
   sides fixed at 420 px. At the minimum window width (1024 px) the middle one was 46 px wide and
   its buttons ran out of it; with narrower sides (360 px) the side buttons ran out instead in
   German, French, Spanish and Russian. Measured in the preview, in all 9 languages: now between
   1024 and 1535 px the sides sit side by side and the middle goes below, full width and on one
   row; from 1536 px the single row as before.
   Usage:  node scripts/test-toolbar-narrow.mjs      (exits with code 1 if anything is off) */

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let guai = 0;
let fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK  ' : 'NO  '} ${cosa}${ok ? '' : `  (atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)})`}`);
};

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const fascia = /<div className=\{`p-4 md:p-5 (flex flex-col [^$`]*?) border-b/.exec(app)?.[1] || '';
dice('la fascia in alto si trova', true, fascia.length > 0);
dice('fra 1024 e 1535 px e\' una griglia a due colonne', true, /\blg:grid\b/.test(fascia) && /\blg:grid-cols-2\b/.test(fascia));
dice('dai 1536 px torna una riga sola, con riquadri alti uguali', true, /\b2xl:flex\b/.test(fascia) && /\b2xl:flex-row\b/.test(fascia) && /\b2xl:items-stretch\b/.test(fascia));
dice('la riga unica NON parte prima dei 1536 px (lg/xl)', false, /\b(lg|xl):flex-row\b/.test(fascia));

const lati = [...app.matchAll(/<div className=\{`(w-full [^`$]*?) flex flex-col gap-3 shrink-0 /g)].map(m => m[1]);
dice('i due riquadri laterali si trovano', 2, lati.length);
dice('...sono larghi 420 px solo dai 1536 px (prima pieni nella loro colonna)', [true, true], lati.map(c => /\b2xl:w-\[420px\]/.test(c) && !/\b(lg|xl):w-\[/.test(c)));

const centro = /<div className=\{`(flex-1 w-full flex flex-col gap-3 min-w-0 [^$`]*?) \$\{isDarkMode/.exec(app)?.[1] || '';
dice('il riquadro centrale si trova', true, centro.length > 0);
dice('...fra 1024 e 1535 px va sotto, a tutta larghezza', true, /\blg:col-span-2\b/.test(centro) && /\blg:order-last\b/.test(centro) && /\b2xl:order-none\b/.test(centro));
dice('...e li\' sta su una riga (campo e pulsanti affiancati)', true, /\blg:flex-row\b/.test(centro) && /\b2xl:flex-col\b/.test(centro));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
