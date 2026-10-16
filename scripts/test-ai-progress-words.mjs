/* ITALIANO: PROVA DELL'AVANZAMENTO DI "TAGGA TUTTE CON AI" SCRITTO A PAROLE
   La riga dell'avanzamento diceva "Tagging… 12/40 · ✗ 2 · ⊘ 5": simboli che nessuna lingua
   spiegava (lo stesso difetto gia' tolto dall'avviso di fine import). Ora dice "Non riuscite: 2" e
   "Saltate: 5", come il riepilogo finale, in tutte e 9 le lingue.
   Uso:  node scripts/test-ai-progress-words.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "AUTO-TAG ALL WITH AI" PROGRESS IN WORDS
   The progress line said "Tagging… 12/40 · ✗ 2 · ⊘ 5": symbols no language explained. It now says
   "Failed: 2" and "Skipped: 5", like the final summary, in all 9 languages. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const codice = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').split(/\r?\n/).filter(r => !/^\s*\/\//.test(r)).join('\n');
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;

dice('nel codice (commenti esclusi) non restano i simboli ✗ e ⊘', [], [...codice.matchAll(/[✗⊘]/g)].map(m => m[0]));
dice('l\'avanzamento usa le due frasi', [true, true], [codice.includes('t.aiProgressFailed.replace('), codice.includes('t.aiProgressSkipped.replace(')]);
dice('le due frasi esistono in 9 lingue, con {n}', [], Object.keys(lingue).filter(l =>
    !String(lingue[l].aiProgressFailed || '').includes('{n}') || !String(lingue[l].aiProgressSkipped || '').includes('{n}')));
process.exit(esito());
