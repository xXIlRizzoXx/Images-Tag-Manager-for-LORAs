/* ITALIANO: PROVA DEL CONTATORE "N immagini aperte" NELLA BARRA IN ALTO
   Con 5 foto caricate e 2 messe nel cestino, la barra diceva "5 immagini aperte" mentre la
   galleria ne mostrava 3, le Statistiche dicevano "Totale immagini: 3" e il cestino 2. Scrivendo
   un tag nella ricerca, lo stesso contatore passava a "3 / 3": due totali diversi per lo stesso
   progetto. Le foto nel cestino restano nell'elenco dell'app (con isTrashed) finche' non si
   svuota, e il ramo senza ricerca le contava.
   Ora i due rami contano le stesse foto: quelle fuori dal cestino.
   Si eseguono i testi VERI presi da src/App.tsx: la riga del contatore, il corpo della galleria
   (displayedImages), il conteggio del cestino e le Statistiche, con le scritte vere delle nove
   lingue di src/constants.ts.
   Uso:  node scripts/test-toolbar-count.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "N images opened" COUNTER IN THE TOP BAR
   With 5 photos loaded and 2 moved to the trash, the bar said "5 images opened" while the gallery
   showed 3, Statistics said "Total images: 3" and the trash 2. Typing a tag in the search turned
   the same counter into "3 / 3": two different totals for the same project. Trashed photos stay in
   the app's list (with isTrashed) until the trash is emptied, and the no-search branch counted
   them.
   Now both branches count the same photos: the ones outside the trash.
   The REAL text taken from src/App.tsx runs: the counter line, the gallery body (displayedImages),
   the trash count and Statistics, with the real strings of the nine languages of
   src/constants.ts.
   Usage:  node scripts/test-toolbar-count.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const js = async (testo) => (await esbuild.transform(testo, { loader: 'ts' })).code;
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const lingue = (await carica('src/constants.ts')).translations;
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const righe = app.split(/\r?\n/);

// ITALIANO: i pezzi veri. La riga del contatore e' quella con t.imgOpenedSingle; il conteggio delle
//           foto attive, se c'e', e' la riga "const fotoAttive = ..." (il codice di prima non l'aveva).
// ENGLISH: the real pieces. The counter line is the one holding t.imgOpenedSingle; the active photo
//          count, when present, is the "const fotoAttive = ..." line (the previous code had none).
const rigaContatore = righe.find(r => r.includes('t.imgOpenedSingle')) || '';
const espressione = (rigaContatore.match(/<span[^>]*>\{(.*)\}<\/span>/) || [])[1] || '';
const rigaCestino = righe.find(r => r.includes('const trashedImages = useMemo(')) || '';
const rigaAttive = righe.find(r => /^\s*const fotoAttive = /.test(r)) || '';
const rigaStatistiche = righe.find(r => r.includes('const statsImages = ')) || '';
const INIZIO = 'const displayedImages = useMemo(';
const iInizio = app.indexOf(INIZIO);
const iFine = iInizio < 0 ? -1 : app.indexOf('}, [images, sortOrder, tagSearch]);', iInizio);
console.log('\n--- i pezzi di App.tsx ---');
dice('contatore, galleria, cestino e statistiche trovati', [true, true, true, true], [!!espressione, iFine > 0, !!rigaCestino, !!rigaStatistiche]);
if (!espressione || iFine < 0 || !rigaCestino || !rigaStatistiche) process.exit(esito());

const applySort = (l) => l;
const galleriaDi = new Function('images', 'tagSearch', 'sortOrder', 'applySort',
    await js('const __g = ' + app.slice(iInizio + INIZIO.length, iFine + 1) + ';') + '\nreturn __g();');
const cestinoDi = new Function('images', 'useMemo', await js(rigaCestino.trim()) + '\nreturn trashedImages;');
const attiveDi = rigaAttive ? new Function('images', 'trashedImages', await js(rigaAttive.trim()) + '\nreturn fotoAttive;') : () => undefined;
const statisticheDi = new Function('images', await js(rigaStatistiche.trim()) + '\nreturn statsImages.length;');
const contatoreDi = new Function('tagSearch', 'displayedImages', 'images', 'trashedImages', 'fotoAttive', 't', 'return (' + espressione + ');');

// ITALIANO: quello che l'utente vede con queste foto e questa ricerca, in questa lingua.
// ENGLISH: what the user sees with these photos and this search, in this language.
const schermo = (images, tagSearch, t) => {
    const displayedImages = galleriaDi(images, tagSearch, 'name-asc', applySort);
    const trashedImages = cestinoDi(images, (f) => f());
    return {
        barra: contatoreDi(tagSearch, displayedImages, images, trashedImages, attiveDi(images, trashedImages), t),
        galleria: displayedImages.length,
        statistiche: statisticheDi(images),
        cestino: trashedImages.length,
    };
};
const foto = (n, cestinate) => Array.from({ length: n }, (_, i) => ({
    id: 'f' + i, file: { name: `f${i}.png`, lastModified: i }, tags: i % 2 ? ['girl'] : ['girl', 'smile'], isTrashed: i < cestinate,
}));

console.log('\n--- 5 foto, 2 nel cestino ---');
{
    const t = lingue.it;
    dice('senza ricerca: "3 immagini aperte", come la galleria e le Statistiche', { barra: `3 ${t.imgOpenedPlural}`, galleria: 3, statistiche: 3, cestino: 2 },
        schermo(foto(5, 2), '', t));
    dice('con la ricerca "girl": "3 / 3", lo stesso totale', `3 / 3`, schermo(foto(5, 2), 'girl', t).barra);
    dice('con la ricerca "smile": "2 / 3" (f2 e f4)', `2 / 3`, schermo(foto(5, 2), 'smile', t).barra);
}

console.log('\n--- singolare e plurale, lingua per lingua ---');
for (const [codice, t] of Object.entries(lingue)) {
    dice(`${codice}: 1 foto attiva e 3 nel cestino -> "1 ${t.imgOpenedSingle}"`, `1 ${t.imgOpenedSingle}`, schermo(foto(4, 3), '', t).barra);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const t = lingue.en;
    dice('nessuna foto nel cestino: "5 images opened"', `5 ${t.imgOpenedPlural}`, schermo(foto(5, 0), '', t).barra);
    dice('tutte nel cestino: "0 images opened" sopra la galleria vuota', [`0 ${t.imgOpenedPlural}`, 0], [schermo(foto(3, 3), '', t).barra, schermo(foto(3, 3), '', t).galleria]);
}

process.exit(esito());
