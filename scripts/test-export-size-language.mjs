/* ITALIANO: PROVA DEL PESO DELL'ARCHIVIO NELLA FINESTRA DI "Esporta", LINGUA PER LINGUA
   La finestra di scelta scrive il peso delle due strade ("circa 2,5 GB"). Il peso usciva sempre con
   la virgola decimale, anche in inglese, cinese e giapponese, dove i decimali si scrivono col punto:
   "about 2,5 GB" in inglese si legge come un numero di migliaia. Ora in quelle tre lingue esce
   "2.5 GB", nelle altre sei resta "2,5 GB".
   Si esegue il testo VERO di handleExportAll e formatoPeso (banco export-harness.mjs).
   Casi vicini che non devono cambiare: sotto 1 KB i byte interi, da 10 in su nessun decimale.
   Uso:  node scripts/test-export-size-language.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE ARCHIVE SIZE IN THE "Export" DIALOG, LANGUAGE BY LANGUAGE
   The choice dialog writes the size of both roads ("about 2.5 GB"). The size always came out with a
   decimal comma, even in English, Chinese and Japanese, where decimals take a point: "about 2,5 GB"
   in English reads as thousands. Now those three languages get "2.5 GB", the other six keep "2,5 GB".
   The REAL text of handleExportAll and formatoPeso runs (export-harness.mjs bench).
   Neighbouring cases that must not change: under 1 KB whole bytes, from 10 up no decimals.
   Usage:  node scripts/test-export-size-language.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda } from './export-harness.mjs';

const { dice, esito } = creaControlli();
const GB = 1024 ** 3;

// ITALIANO: una foto con tag del peso dato; il .txt "x," pesa 2 byte.
// ENGLISH: one tagged photo of the given size; the "x," .txt weighs 2 bytes.
const pesi = (byte, lang) => {
    const app = creaApp([{ id: '1', file: { name: 'a.png', size: byte }, tags: ['x'], originalTags: ['x'], isTrashed: false }], creaSonda(), { lang }).apri();
    return app.scelta ? [app.scelta.riepilogo.soloTag.peso, app.scelta.riepilogo.conImmagini.peso] : null;
};

console.log('\n--- 2,5 GB nelle nove lingue ---');
for (const lang of ['en', 'zh', 'ja']) dice(`${lang}: "2.5 GB" con il punto`, ['2 B', '2.5 GB'], pesi(2.5 * GB, lang));
for (const lang of ['it', 'fr', 'es', 'de', 'pt', 'ru']) dice(`${lang}: "2,5 GB" con la virgola`, ['2 B', '2,5 GB'], pesi(2.5 * GB, lang));

console.log('\n--- quello che NON deve cambiare ---');
dice('en: 15 MB senza decimali', ['2 B', '15 MB'], pesi(15 * 1024 ** 2, 'en'));
dice('it: 15 MB senza decimali', ['2 B', '15 MB'], pesi(15 * 1024 ** 2, 'it'));
dice('en: 510 byte restano byte interi', ['2 B', '512 B'], pesi(510, 'en'));
dice('ja: 1,5 KB col punto', ['2 B', '1.5 KB'], pesi(1.5 * 1024 - 2, 'ja'));
dice('de: 1,5 KB con la virgola', ['2 B', '1,5 KB'], pesi(1.5 * 1024 - 2, 'de'));

process.exit(esito());
