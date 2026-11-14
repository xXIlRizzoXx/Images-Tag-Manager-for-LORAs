/* ITALIANO: PROVA DEL DECIMALE DI «MEDIA TAG/IMMAGINE» NELLE STATISTICHE
   La media era scritta con toFixed(1), quindi con il punto in tutte le lingue («12.5» anche in
   italiano), mentre formatoPeso (il peso dell'esportazione) usa la virgola fuori da inglese, cinese e
   giapponese. Si valuta la riga VERA di avgTagsPerImage presa da src/App.tsx con lingue diverse.
   Uso:  node scripts/test-stats-average-decimal.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE DECIMAL OF "AVG TAGS/IMAGE" IN THE STATISTICS
   The average was written with toFixed(1), so with a point in every language ("12.5" in Italian
   too), while formatoPeso (the export size) uses a comma outside English, Chinese and Japanese.
   The REAL avgTagsPerImage line taken from src/App.tsx is evaluated with different languages.
   Usage:  node scripts/test-stats-average-decimal.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(process.argv[2] || path.join(radice, 'src/App.tsx'), 'utf8');
const { dice, esito } = creaControlli();

const riga = sorgente.match(/const avgTagsPerImage = ([^\r\n]+);/);
if (!riga) { console.log('NO  riga di avgTagsPerImage non trovata in src/App.tsx'); process.exit(1); }
const media = new Function('lang', 'totalImages', 'totalTagInstances', 'return ' + riga[1] + ';');

const formato = sorgente.match(/const virgola = ([^\r\n]+);/);
if (!formato) { console.log('NO  regola di formatoPeso non trovata in src/App.tsx'); process.exit(1); }
const virgolaPeso = new Function('lang', 'return ' + formato[1] + ';');

console.log('\n--- 125 tag su 10 foto ---');
for (const lang of ['it', 'fr', 'es', 'de', 'pt', 'ru']) dice(lang + ': «12,5»', '12,5', media(lang, 10, 125));
for (const lang of ['en', 'zh', 'ja']) dice(lang + ': «12.5»', '12.5', media(lang, 10, 125));

console.log('\n--- casi vicini ---');
dice('nessuna foto: «0»', '0', media('it', 0, 0));
dice('media intera in italiano: «3,0» (una cifra decimale come prima)', '3,0', media('it', 4, 12));
for (const lang of ['it', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru', 'en'])
    dice(lang + ': stesso separatore del peso dell\'esportazione', virgolaPeso(lang), media(lang, 10, 125).charAt(2));

process.exit(esito());
