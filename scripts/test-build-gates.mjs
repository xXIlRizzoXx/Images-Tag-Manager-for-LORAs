/* ITALIANO: PROVA CHE LA COSTRUZIONE DEL PROGRAMMA PASSI DAI CONTROLLI DEL PROGETTO
   "Provato" in questo progetto vuol dire: tipi a posto, nove lingue con le stesse chiavi e prove
   automatiche passate. Ma `npm run electron:build` faceva solo il controllo dei tipi, e nessuno
   script npm lanciava il controllo delle lingue o le prove: con una chiave mancante in una lingua
   (letta da un componente senza tipo) o con la scelta del modello rotta, uscivano lo stesso i due
   .exe. La regola: esiste `npm test` con i due controlli, la costruzione lo lancia prima di
   impacchettare, e CONTRIBUTING lo nomina. Si legge il package.json VERO, senza eseguire niente
   (lanciare `npm test` da qui farebbe girare questa stessa prova all'infinito).
   Uso:  node scripts/test-build-gates.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT BUILDING THE APP GOES THROUGH THE PROJECT'S CHECKS
   "Tested" in this project means: types clean, nine languages with the same keys and automated
   tests passing. But `npm run electron:build` ran only the type check, and no npm script ran the
   language check or the tests: with a key missing in one language (read by an untyped component)
   or with the model selection broken, both .exe files were still produced. The rule: `npm test`
   exists with both checks, the build runs it before packaging, and CONTRIBUTING names it. The
   REAL package.json is read, nothing is run (starting `npm test` from here would run this very
   test forever).
   Usage:  node scripts/test-build-gates.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');

const script = JSON.parse(leggi('package.json')).scripts || {};
const prova = String(script.test || '');
const costruzione = String(script['electron:build'] || '');

// ITALIANO: premessa: i due controlli esistono davvero, altrimenti pretenderli non avrebbe senso.
// ENGLISH: premise: both checks really exist, otherwise requiring them would make no sense.
dice('esiste scripts/check-translations.mjs', true, fs.existsSync(path.join(radice, 'scripts/check-translations.mjs')));
dice('esiste scripts/run-tests.mjs', true, fs.existsSync(path.join(radice, 'scripts/run-tests.mjs')));

dice('package.json ha lo script "test"', true, prova.length > 0);
dice('"test" lancia il controllo delle nove lingue', true, prova.includes('scripts/check-translations.mjs'));
dice('"test" lancia le prove automatiche', true, prova.includes('scripts/run-tests.mjs'));
// ITALIANO: con `;` o `&` un controllo fallito non fermerebbe il successivo: servono solo `&&`.
// ENGLISH: with `;` or `&` a failed check would not stop the next one: only `&&` will do.
dice('"test" concatena i comandi solo con &&', false, /;|(^|[^&])&([^&]|$)/.test(prova));

// ITALIANO: dove compare ogni passo della costruzione (-1 = assente).
// ENGLISH: where each build step appears (-1 = missing).
const passo = (re) => { const m = costruzione.match(re); return m ? m.index : -1; };
const iTest = passo(/npm (run )?test\b/);
const iBuild = passo(/npm run build\b/);
const iPacchetto = passo(/electron-builder\b/);
dice('electron:build impacchetta con electron-builder', true, iPacchetto >= 0);
dice('electron:build lancia npm test', true, iTest >= 0);
dice('npm test viene prima di electron-builder', true, iTest >= 0 && iTest < iPacchetto);
dice('npm test viene prima di npm run build', true, iTest >= 0 && iBuild >= 0 && iTest < iBuild);
dice('electron:build concatena i comandi solo con &&', false, /;|(^|[^&])&([^&]|$)/.test(costruzione));

dice('CONTRIBUTING nomina npm test', true, /\bnpm test\b/.test(leggi('CONTRIBUTING.md')));

process.exit(esito());
