/* ITALIANO: PROVA DI ALCUNE FRASI TRADOTTE (francese, tedesco, portoghese, russo)
   - Francese: davanti a "!" ci vuole lo spazio, come il blocco fa gia' per "?" e ":".
   - Tedesco: l'avviso della funzione sperimentale parla di risultati imprecisi, non incompleti.
   - Portoghese: "tag" e' femminile in tutto il programma; la legenda dei tag in blocco e le due
     etichette delle Statistiche devono accordarsi al femminile.
   - Russo: l'etichetta "tag usati 1 volta" delle Statistiche e' un nome di categoria (participio
     lungo), non una frase compiuta.
   Si legge il vero src/constants.ts. Uso: node scripts/test-translation-wording-r1.mjs

   ENGLISH: TEST OF A FEW TRANSLATED SENTENCES (French, German, Portuguese, Russian)
   - French: "!" needs a space before it, as the block already does for "?" and ":".
   - German: the experimental-feature hint speaks of imprecise results, not incomplete ones.
   - Portuguese: "tag" is feminine everywhere in the app; the bulk legend and the two Statistics
     labels must agree in the feminine.
   - Russian: the Statistics "tags used once" label is a category name (long participle), not a
     full sentence.
   Reads the real src/constants.ts. Usage: node scripts/test-translation-wording-r1.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src', 'constants.ts'), 'utf8');

const order = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
function block(lang) {
  const start = src.indexOf(`\n    ${lang}: {`);
  if (start < 0) throw new Error(`blocco ${lang} non trovato`);
  const next = order[order.indexOf(lang) + 1];
  const end = next ? src.indexOf(`\n    ${next}: {`, start + 1) : src.length;
  return src.slice(start, end);
}
function value(lang, key) {
  const m = block(lang).match(new RegExp(`\\n\\s+${key}: "([^"]*)"`));
  return m ? m[1] : null;
}

let problems = 0;
let checks = 0;
function check(ok, msg) {
  checks++;
  if (!ok) { problems++; console.log('PROBLEMA: ' + msg); }
}

// Francese: nessun "!" attaccato a una lettera, e le quattro voci di riuscita lo hanno con lo spazio.
const fr = block('fr');
const glued = [...fr.matchAll(/\n\s+(\w+): "[^"\n]*\p{L}![^"\n]*"/gu)].map((m) => m[1]);
check(glued.length === 0, `fr: punto esclamativo attaccato alla parola in ${glued.join(', ')}`);
for (const k of ['successSaveChanges', 'completed', 'successSaveSingle', 'zipSuccess']) {
  const v = value('fr', k);
  check(v !== null && /[  ]!$/.test(v), `fr.${k} deve finire con " !": ${JSON.stringify(v)}`);
}
// Caso vicino: le altre lingue latine non prendono lo spazio.
check(!/ !"/.test(block('en')), 'en: nessuno spazio prima di "!"');
check(!/ !"/.test(block('es')), 'es: nessuno spazio prima di "!"');

// Tedesco
const de = value('de', 'aiBetaHint');
check(de !== null && !/unvollständig/.test(de) && /ungenaue Ergebnisse/.test(de), `de.aiBetaHint: ${JSON.stringify(de)}`);

// Portoghese
check(value('pt', 'legendStaged') === 'Será adicionada a todas as selecionadas', `pt.legendStaged: ${JSON.stringify(value('pt', 'legendStaged'))}`);
check(value('pt', 'statsTotalTags') === 'Total de tags únicas', `pt.statsTotalTags: ${JSON.stringify(value('pt', 'statsTotalTags'))}`);
check(value('pt', 'statsTopTags') === 'Top 10 tags mais usadas', `pt.statsTopTags: ${JSON.stringify(value('pt', 'statsTopTags'))}`);
// Caso vicino: le voci femminili gia' giuste restano.
check(value('pt', 'statsSingletonTags') === 'Tags usadas 1 vez', 'pt.statsSingletonTags invariata');

// Russo
const ru = value('ru', 'statsSingletonTags');
check(ru === 'Теги, использованные 1 раз', `ru.statsSingletonTags: ${JSON.stringify(ru)}`);

if (problems) {
  console.log(`PROBLEMI: ${problems} (${checks} controlli)`);
  process.exit(1);
}
console.log(`OK: ${checks} controlli`);
