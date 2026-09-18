/* ITALIANO: ESEGUE TUTTE LE PROVE AUTOMATICHE DEL PROGETTO
   Lancia uno dopo l'altro tutti i file scripts/test-*.mjs e dice quali passano. Un test nuovo
   entra da solo: basta chiamarlo test-<qualcosa>.mjs e farlo uscire con codice 1 se fallisce.
   Le prove NON devono usare la rete, il Cestino di Windows, %APPDATA% o aprire finestre.
   Uso:  node scripts/run-tests.mjs      (esce con codice 1 se anche una sola prova fallisce)

   ENGLISH: RUNS EVERY AUTOMATED TEST OF THE PROJECT
   Runs every scripts/test-*.mjs file in turn and reports which pass. A new test joins on its
   own: name it test-<something>.mjs and make it exit with code 1 on failure.
   Tests must NOT use the network, the Windows Recycle Bin, %APPDATA%, or open any window.
   Usage:  node scripts/run-tests.mjs      (exits with code 1 if even one test fails) */

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cartella = path.dirname(fileURLToPath(import.meta.url));
const radice = path.resolve(cartella, '..');
const prove = readdirSync(cartella).filter(f => /^test-.+\.mjs$/.test(f)).sort();

if (prove.length === 0) {
    console.log('Nessuna prova trovata in scripts/test-*.mjs');
    process.exit(1);
}

let fallite = 0;
for (const nome of prove) {
    const r = spawnSync(process.execPath, [path.join(cartella, nome)], { cwd: radice, encoding: 'utf8' });
    const ok = r.status === 0;
    if (!ok) fallite++;
    const ultima = String(r.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
    console.log(`${ok ? 'PASSA ' : 'FALLISCE'}  ${nome}  —  ${ultima}`);
    if (!ok) {
        // ITALIANO: di una prova fallita si mostra tutto, altrimenti non si capisce cosa correggere.
        // ENGLISH: a failing test prints everything, otherwise nobody can tell what to fix.
        console.log(String(r.stdout || ''));
        console.log(String(r.stderr || ''));
    }
}

console.log(`\nESITO PROVE: ${fallite === 0 ? 'TUTTE PASSATE' : fallite + ' FALLITE'} (${prove.length} file)`);
process.exit(fallite === 0 ? 0 : 1);
