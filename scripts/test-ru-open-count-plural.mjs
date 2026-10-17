/* ITALIANO: PROVA DEL CONTATORE "N foto aperte" IN RUSSO
   Il contatore della barra sceglie fra due sole forme (1 / tutto il resto). Il russo ne ha tre:
   con "изображение" uscivano "3 изображений открыто" e "21 изображений открыто", sbagliati (le forme
   giuste sono "3 изображения" e "21 изображение"). Ora il russo usa "фото", che non si declina:
   "1 фото открыто", "3 фото открыто", "21 фото открыто" sono tutte corrette.
   Si esegue l'espressione VERA del contatore presa da src/App.tsx, con le scritte vere di
   src/constants.ts, per molti numeri. Casi vicini che non devono cambiare: italiano e inglese
   (singolare con 1, plurale con gli altri numeri) e la forma "N / M" quando c'e' una ricerca.
   Uso:  node scripts/test-ru-open-count-plural.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "N photos opened" COUNTER IN RUSSIAN
   The bar counter picks between two forms only (1 / everything else). Russian has three: with
   "изображение" it showed "3 изображений открыто" and "21 изображений открыто", both wrong (the right
   forms are "3 изображения" and "21 изображение"). Russian now uses "фото", which does not decline:
   "1 фото открыто", "3 фото открыто", "21 фото открыто" are all correct.
   The REAL counter expression taken from src/App.tsx runs with the real strings of
   src/constants.ts, for many numbers. Neighbouring cases that must not change: Italian and English
   (singular with 1, plural otherwise) and the "N / M" form while a search is active.
   Usage:  node scripts/test-ru-open-count-plural.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const righe = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').split(/\r?\n/);

// ITALIANO: l'espressione vera dentro lo <span> del contatore (la riga con t.imgOpenedSingle).
// ENGLISH: the real expression inside the counter <span> (the line holding t.imgOpenedSingle).
const riga = righe.find(r => r.includes('t.imgOpenedSingle')) || '';
const espressione = (riga.match(/<span[^>]*>\{(.*)\}<\/span>/) || [])[1] || '';
console.log('\n--- il contatore di App.tsx ---');
dice('espressione del contatore trovata', true, !!espressione);
if (!espressione) process.exit(esito());
const contatore = new Function('tagSearch', 'displayedImages', 'fotoAttive', 't', `return ${espressione};`);

// ITALIANO: la forma giusta di "изображение" per ogni numero, secondo le regole del russo.
// ENGLISH: the right form of "изображение" for each number, by the Russian plural rules.
const regole = new Intl.PluralRules('ru');
const formaGiusta = { one: 'изображение', few: 'изображения', many: 'изображений' };
const sostantivoGiusto = (n, testo) => {
    const parola = (testo.match(/изображ\S*/) || [])[0];
    if (!parola) return /(^|\s)фото(\s|$)/.test(testo); // "фото" non si declina / does not decline
    return parola === formaGiusta[regole.select(n)];
};

console.log('\n--- russo ---');
for (const n of [0, 1, 2, 3, 4, 5, 11, 12, 14, 20, 21, 22, 24, 25, 31, 101, 104, 111]) {
    const testo = contatore('', [], n, lingue.ru);
    dice(`ru, ${n}: "${testo}" ha la forma giusta`, true, sostantivoGiusto(n, testo));
}

console.log('\n--- casi vicini ---');
dice('it, 1: "1 immagine aperta"', '1 immagine aperta', contatore('', [], 1, lingue.it));
dice('it, 3: "3 immagini aperte"', '3 immagini aperte', contatore('', [], 3, lingue.it));
dice('en, 1: "1 image opened"', '1 image opened', contatore('', [], 1, lingue.en));
dice('en, 21: "21 images opened"', '21 images opened', contatore('', [], 21, lingue.en));
dice('ru, con una ricerca: "2 / 5"', '2 / 5', contatore('ohwx', [{}, {}], 5, lingue.ru));

process.exit(esito());
