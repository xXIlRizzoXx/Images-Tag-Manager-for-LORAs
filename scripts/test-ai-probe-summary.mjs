/* ITALIANO: PROVA DEL RIEPILOGO E DEL NOME DEL PULSANTE DELLA PROVA DEI MODELLI
   1. Il riepilogo sotto il pulsante contava insieme i modelli "da riprovare" (Google occupato)
      e quelli mai provati: dopo una prova fermata al secondo modello diceva "Da riprovare: 20"
      quando gli occupati erano 1 e i mai provati 19 (visto sul programma vero). Ora sono due
      voci separate, in tutte e 9 le lingue.
   2. Il pulsante si chiamava "Prova tutti i modelli", ma la prova tiene solo le ultime tre
      versioni di Gemini: il nome non deve piu' promettere "tutti".
   Uso:  node scripts/test-ai-probe-summary.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SUMMARY AND THE BUTTON NAME OF THE MODEL PROBE
   1. The summary under the button counted the "to retry" models (Google busy) together with the
      never-tested ones: after a probe stopped at the second model it said "To retry: 20" when 1
      was busy and 19 never tested (seen on the real app). Now they are two separate entries, in
      all 9 languages.
   2. The button was called "Test all models", but the probe keeps only the latest three Gemini
      versions: the name must no longer promise "all".
   Usage:  node scripts/test-ai-probe-summary.mjs      (exits with code 1 if anything is off) */

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
const testi = fs.readFileSync(path.join(radice, 'src/constants.ts'), 'utf8');
const valori = (chiave) => [...testi.matchAll(new RegExp(`^\\s*${chiave}: "(.*)",\\s*$`, 'gm'))].map(m => m[1]);

console.log('\n--- riepilogo ---');
dice('"da riprovare" conta solo i modelli occupati', true,
    /\.replace\('\{occ\}', String\(modelliProvati\.filter\(m => m\.stato === 'occupato'\)\.length\)\)/.test(app));
dice('i mai provati hanno la loro voce', true,
    /\.replace\('\{np\}', String\(modelliProvati\.filter\(m => !m\.stato\)\.length\)\)/.test(app));
const riepiloghi = valori('aiProbeSummary');
dice('il riepilogo esiste in 9 lingue', 9, riepiloghi.length);
dice('...e in ognuna ha sia {occ} sia {np}', 9, riepiloghi.filter(v => v.includes('{occ}') && v.includes('{np}')).length);
const gruppiMaiProvati = valori('aiGroupUntested');
dice('...e chiama i mai provati come il gruppo della tendina', 9,
    riepiloghi.filter((v, i) => Boolean(gruppiMaiProvati[i]) && [':', ' :', '：'].some(d => v.includes(gruppiMaiProvati[i] + d))).length);

console.log('\n--- nome del pulsante ---');
const nomi = valori('aiProbeAll');
dice('il nome del pulsante esiste in 9 lingue', 9, nomi.length);
const vecchi = ['tutti i modelli', 'all models', 'tous les modèles', 'todos los modelos', 'Alle Modelle', '所有模型', 'すべてのモデル', 'todos os modelos', 'все модели'];
dice('nessuna lingua promette piu\' "tutti i modelli"', [], nomi.filter(n => vecchi.some(v => n.includes(v))));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
