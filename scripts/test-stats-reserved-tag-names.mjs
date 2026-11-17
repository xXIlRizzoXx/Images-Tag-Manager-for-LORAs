/* ITALIANO: PROVA DELLE STATISTICHE CON TAG CHIAMATI COME I NOMI DI JAVASCRIPT
   Le Statistiche contavano i tag in un oggetto semplice ({}): un tag «constructor», «toString» o
   «valueOf» trovava gia' la funzione ereditata, e il conteggio diventava un testo («function
   Object() { [native code] }1»): «Media tag/immagine» diceva NaN e le barre restavano a zero. Con
   «__proto__» il conteggio era un oggetto, e React mandava la finestra alla schermata d'errore.
   Si esegue il blocco VERO di src/App.tsx (da `const tagUsage` al `return (` delle Statistiche).
   Uso:  node scripts/test-stats-reserved-tag-names.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE STATISTICS WITH TAGS NAMED LIKE JAVASCRIPT NAMES
   The Statistics counted tags in a plain object ({}): a tag "constructor", "toString" or "valueOf"
   already found the inherited function, and the count became a string ("function Object() { [native
   code] }1"): "Avg tags/image" said NaN and the bars stayed at zero. With "__proto__" the count was
   an object, and React sent the window to the error screen.
   The REAL block of src/App.tsx (from `const tagUsage` to the Statistics' `return (`) is run.
   Usage:  node scripts/test-stats-reserved-tag-names.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const { dice, esito } = creaControlli();

const inizio = sorgente.search(/ +const tagUsage\b/);
const fine = inizio < 0 ? -1 : sorgente.indexOf('return (', inizio);
if (inizio < 0 || fine < 0) { console.log('NO  blocco di tagUsage non trovato in src/App.tsx'); process.exit(1); }
const blocco = (await esbuild.transform(sorgente.slice(inizio, fine), { loader: 'ts' })).code;
const statistiche = new Function('statsImages', 'statsUniqueTags', 'totalImages', 'taggedImages', 'lang', 'deferredStatsSearch', 'statsSort',
    blocco + '\nreturn { barData, avgTagsPerImage, maxUsage, singletonCount, fullTagList, totalTagInstances };');
const conta = (immagini, lang = 'it') => {
    const unici = [...new Set(immagini.flatMap(i => i.tags))].sort((a, b) => a.localeCompare(b));
    return statistiche(immagini, unici, immagini.length, immagini.filter(i => i.tags.length > 0).length, lang, '', 'count');
};
const numero = (x) => typeof x === 'number' && Number.isFinite(x);

console.log('\n--- tag «constructor», «toString», «valueOf», «hasOwnProperty», «__proto__» ---');
{
    const r = conta([
        { tags: ['constructor', 'toString', 'cat'] },
        { tags: ['constructor', '__proto__', 'valueOf', 'hasOwnProperty'] },
        { tags: ['cat'] },
    ]);
    dice('media tag/immagine: un numero con la virgola (8 tag su 3 foto)', '2,7', r.avgTagsPerImage);
    dice('istanze totali', 8, r.totalTagInstances);
    dice('massimo: un numero', [true, 2], [numero(r.maxUsage), r.maxUsage]);
    // ITALIANO: coppie [tag, conteggio], non un oggetto: in un oggetto «__proto__» non sarebbe una chiave.
    // ENGLISH: [tag, count] pairs, not an object: in an object "__proto__" would not be a key.
    const coppie = new Map(r.fullTagList.map(x => [x.tag, x.count]));
    dice('elenco completo: ogni conteggio e\' un numero', [], r.fullTagList.filter(x => !numero(x.count)).map(x => x.tag));
    dice('conteggi giusti', [['constructor', 2], ['toString', 1], ['valueOf', 1], ['hasOwnProperty', 1], ['__proto__', 1], ['cat', 2]],
        ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'cat'].map(n => [n, coppie.get(n)]));
    dice('Top 10: ogni valore e\' un numero', [], r.barData.filter(x => !numero(x.value)).map(x => x.name));
    dice('Top 10: c\'e\' anche «__proto__»', true, r.barData.some(x => x.name === '__proto__' && x.value === 1));
    dice('tag usati una volta sola', 4, r.singletonCount);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = conta([{ tags: ['a', 'b'] }, { tags: ['a'] }, { tags: [] }], 'en');
    dice('tag normali: media, massimo, conteggi', ['1.0', 2, [['a', 2], ['b', 1]]], [r.avgTagsPerImage, r.maxUsage, r.fullTagList.map(x => [x.tag, x.count])]);
    dice('Top 10 in ordine di uso', [['a', 2], ['b', 1]], r.barData.map(x => [x.name, x.value]));
    const vuoto = conta([]);
    dice('nessuna foto: media «0», massimo 0', ['0', 0], [vuoto.avgTagsPerImage, vuoto.maxUsage]);
}

process.exit(esito());
