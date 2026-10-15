/* ITALIANO: PROVA DEL CONSIGLIO DATO PER UN .TXT RIMASTO VUOTO
   Dopo un salvataggio che lascia un .txt vuoto, l'avviso diceva "aggiungi almeno un tag o sposta
   la foto nel cestino". Ma il cestino del programma lascia la foto e il suo .txt nella cartella
   (lo dice trashInfo): chi seguiva il consiglio e poi addestrava aveva ancora il .txt vuoto, e
   Kohya si fermava lo stesso. Toglie davvero la foto dalla cartella solo "Svuota Cestino".
   La regola: in tutte e nove le lingue, le due frasi (una foto / piu' foto) nominano il pulsante
   "Svuota Cestino" con la sua etichetta vera, e dicono che nel solo cestino del programma la foto
   resta nella cartella. Si leggono i testi VERI di src/constants.ts.
   Uso:  node scripts/test-empty-caption-advice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE ADVICE GIVEN FOR A .TXT LEFT EMPTY
   After a save that leaves an empty .txt, the notice said "add at least one tag or move the photo
   to the trash". But the app's trash leaves the photo and its .txt in the folder (trashInfo says
   so): whoever followed the advice and then trained still had the empty .txt, and Kohya stopped
   all the same. Only "Empty Trash" really takes the photo out of the folder.
   The rule: in all nine languages, the two sentences (one photo / several photos) name the
   "Empty Trash" button with its real label, and say that in the app's trash alone the photo stays
   in the folder. The REAL texts of src/constants.ts are read.
   Usage:  node scripts/test-empty-caption-advice.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const LINGUE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];

// ITALIANO: premessa: il cestino del programma dice da se' che le foto restano nella cartella.
// ENGLISH: premise: the app's trash itself says the photos stay in the folder.
dice('premessa: trashInfo (en) dice che le foto restano nella cartella', true, /still in your folder on disk/.test(lingue.en.trashInfo));

// ITALIANO: in ogni lingua, le parole che dicono "resta nella cartella" (frase per una foto e per piu' foto).
// ENGLISH: in each language, the words saying "stays in the folder" (sentence for one photo and for several).
const RESTA = {
    it: [/restano nella cartella/, /restano nella cartella/],
    en: [/stay in the folder/, /stay in the folder/],
    fr: [/restent dans le dossier/, /restent dans le dossier/],
    es: [/siguen en la carpeta/, /siguen en la carpeta/],
    de: [/bleiben das Foto und seine \.txt im Ordner/, /bleiben die Fotos und ihre \.txt-Dateien im Ordner/],
    zh: [/仍留在文件夹里/, /仍留在文件夹里/],
    ja: [/フォルダーに残ったまま/, /フォルダーに残ったまま/],
    pt: [/continuam na pasta/, /continuam na pasta/],
    ru: [/остаются в папке/, /остаются в папке/],
};

for (const l of LINGUE) {
    const t = lingue[l];
    const una = String(t.saveEmptyCaptionOne || '');
    const tante = String(t.saveEmptyCaptionMany || '');
    console.log(`\n--- ${l} ---`);
    dice(`${l}: la frase per una foto nomina "${t.emptyTrash}"`, true, una.includes(t.emptyTrash));
    dice(`${l}: la frase per piu' foto nomina "${t.emptyTrash}"`, true, tante.includes(t.emptyTrash));
    dice(`${l}: la frase per una foto dice che nel solo cestino resta nella cartella`, true, RESTA[l][0].test(una));
    dice(`${l}: la frase per piu' foto dice che nel solo cestino restano nella cartella`, true, RESTA[l][1].test(tante));
    // ITALIANO: quello che non deve cambiare: Kohya, il .txt, il numero solo nella frase al plurale.
    // ENGLISH: what must not change: Kohya, the .txt, the number only in the plural sentence.
    dice(`${l}: restano Kohya e .txt, {n} solo al plurale`, [true, true, false, true],
        [una.includes('Kohya') && tante.includes('Kohya'), una.includes('.txt') && tante.includes('.txt'), una.includes('{n}'), tante.includes('{n}')]);
}

process.exit(esito());
