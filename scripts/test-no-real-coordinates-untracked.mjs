/* ITALIANO: PROVA CHE IL CONTROLLO ANTI-COORDINATE GUARDI ANCHE I FILE NON ANCORA AGGIUNTI A GIT
   scripts/test-no-real-coordinates.mjs leggeva solo i file gia' seguiti da git. Un test nuovo, prima
   del commit, non lo e' ancora: proprio quando le prove girano per decidere se committare, una
   coordinata vera dentro un file nuovo passava. Qui si costruisce un repository finto in una
   cartella temporanea (51 file seguiti + 1 nuovo con una coordinata vera di un monumento) e si
   lancia il controllo vero su quella cartella: deve fallire e nominare il file nuovo. Un file
   ignorato da .gitignore resta fuori. La cartella temporanea viene cancellata alla fine.
   Uso:  node scripts/test-no-real-coordinates-untracked.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE COORDINATE GUARD ALSO READS FILES NOT YET ADDED TO GIT
   scripts/test-no-real-coordinates.mjs only read files git already tracks. A new test, before the
   commit, is not tracked yet: right when the suite runs to decide whether to commit, a real
   coordinate inside a new file went through. This builds a fake repository in a temporary folder
   (51 tracked files + 1 new one holding the real coordinate of a landmark) and runs the real guard
   on it: it must fail and name the new file. A file ignored by .gitignore stays out. The temporary
   folder is deleted at the end. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const guardia = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-no-real-coordinates.mjs');
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-coordinate-'));
let codice = 1;
try {
    const git = (...a) => spawnSync('git', a, { cwd: cartella, encoding: 'utf8' });
    git('init', '-q');
    for (let i = 0; i < 51; i++) fs.writeFileSync(path.join(cartella, `nota${i}.txt`), 'niente di speciale\n');
    fs.writeFileSync(path.join(cartella, '.gitignore'), 'ignorato.txt\n');
    git('add', '.');
    const vera = ['48.8584', 'N 2.2945', 'E'].join('');
    fs.writeFileSync(path.join(cartella, 'test-nuovo.mjs'), `const esempio = 'GPS ${vera}';\n`);
    fs.writeFileSync(path.join(cartella, 'ignorato.txt'), `GPS ${vera}\n`);

    const r = spawnSync(process.execPath, [guardia, cartella], { encoding: 'utf8' });
    const testo = (r.stdout || '') + (r.stderr || '');
    dice('il controllo fallisce: c\'e\' una coordinata vera in un file nuovo', 1, r.status);
    dice('e nomina il file nuovo', true, testo.includes('test-nuovo.mjs'));
    dice('il file ignorato da .gitignore resta fuori', false, testo.includes('ignorato.txt'));

    fs.rmSync(path.join(cartella, 'test-nuovo.mjs'));
    const pulito = spawnSync(process.execPath, [guardia, cartella], { encoding: 'utf8' });
    dice('tolto il file, il controllo passa', 0, pulito.status);
    codice = esito();
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
