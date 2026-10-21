/* ITALIANO: PROVA DELL'IGIENE DEL REPOSITORY (voce 21 dell'analisi di luglio 2026)
   - metadata.json era un avanzo dello strumento con cui il progetto e' nato: nessuno lo legge.
   - Le due immagini di lavoro della copertina Civitai (anteprima e controllo) le rifa' lo script a
     ogni lancio: non vanno nel repository pubblico.
   - Lo script "clean" cancella dist e release/win-unpacked, MAI tutta release: su Windows
     "release" e "Release" sono la stessa cartella, e lanciato dalla cartella principale del
     progetto cancellerebbe le consegne (portable e installer).
   Uso:  node scripts/test-repo-hygiene.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE REPOSITORY'S HYGIENE (item 21 of the July 2026 analysis)
   metadata.json was a leftover nobody reads; the Civitai cover work images are rebuilt by their
   script on every run; the "clean" script removes dist and release/win-unpacked, NEVER the whole
   release folder: on Windows "release" and "Release" are the same folder, and run from the
   project's main folder it would delete the deliveries. */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const git = (...a) => spawnSync('git', a, { cwd: radice, encoding: 'utf8' });
const seguiti = git('ls-files', '-z').stdout.split('\0').filter(Boolean);
dice('premessa: git risponde', true, seguiti.length > 50);
dice('metadata.json non e\' nel repository', false, seguiti.includes('metadata.json'));
for (const f of ['docs/img/civitai-cover-anteprima.jpg', 'docs/img/civitai-cover-controllo.jpg']) {
    dice(`${f}: non nel repository e ignorata`, [false, 0], [seguiti.includes(f), git('check-ignore', '-q', f).status]);
}
const clean = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).scripts.clean || '';
const elenco = (/\[([^\]]*)\]/.exec(clean) || ['', ''])[1];
const cartelle = [...elenco.matchAll(/'([^']+)'/g)].map(m => m[1]);
dice('"clean" cancella dist e release/win-unpacked', ['dist', 'release/win-unpacked'], cartelle);
dice('"clean" non cancella MAI tutta release (Release, con le consegne, su Windows e\' la stessa)', false, cartelle.some(c => /^release\/?$/i.test(c)));
process.exit(esito());
