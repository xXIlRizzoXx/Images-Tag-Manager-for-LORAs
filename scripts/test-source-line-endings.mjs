/* ITALIANO: PROVA CHE LE PROVE CHE LEGGONO IL TESTO DI src/App.tsx PASSINO CON TUTTE E DUE LE FINE RIGA
   Nel repository src/App.tsx e' salvato con fine riga LF: diventa CRLF solo sui PC Windows con
   core.autocrlf=true. Chi scarica lo ZIP da GitHub, clona senza conversione o lavora su Linux o macOS
   ha un App.tsx LF. test-history-strictmode cercava un testo di due righe con "\r\n" scritto dentro:
   su una copia LF non lo trovava, usciva con 1 e fermava "npm test" (e quindi "electron:build").
   Qui si lanciano le prove VERE che cercano testi di piu' righe in App.tsx, una volta con i sorgenti
   letti come LF e una volta come CRLF: devono passare tutte e due le volte. I file su disco non si
   toccano: un piccolo modulo caricato prima della prova (--import) cambia solo il testo che
   fs.readFileSync restituisce per i file .ts/.tsx dentro src/.
   Uso:  node scripts/test-source-line-endings.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE TESTS READING THE TEXT OF src/App.tsx PASS WITH BOTH LINE ENDINGS
   In the repository src/App.tsx is stored with LF line endings: it becomes CRLF only on Windows PCs
   with core.autocrlf=true. Whoever downloads the ZIP from GitHub, clones without conversion or works
   on Linux or macOS gets an LF App.tsx. test-history-strictmode searched for a two-line text with
   "\r\n" written inside: on an LF copy it did not find it, exited with 1 and stopped "npm test" (and
   so "electron:build"). Here the REAL tests that search multi-line texts in App.tsx run once with
   the sources read as LF and once as CRLF: they must pass both times. Files on disk are not touched:
   a small module loaded before the test (--import) only changes the text fs.readFileSync returns
   for the .ts/.tsx files inside src/.
   Usage:  node scripts/test-source-line-endings.mjs      (exits with code 1 if anything is off) */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: il modulo caricato prima della prova: converte le fine riga dei sorgenti letti come testo.
// ENGLISH: the module loaded before the test: converts the line endings of sources read as text.
const precarica = `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const modo = process.env.ITM_PROVA_FINE_RIGA;
const originale = fs.readFileSync;
fs.readFileSync = function (file, ...resto) {
    const r = originale.call(this, file, ...resto);
    if (typeof r !== 'string' || typeof file !== 'string' || !/(^|[\\\\/])src[\\\\/].*\\.tsx?$/.test(file)) return r;
    const lf = r.replace(/\\r\\n/g, '\\n');
    return modo === 'crlf' ? lf.replace(/\\n/g, '\\r\\n') : lf;
};
syncBuiltinESMExports();
`;
const argPrecarica = '--import=data:text/javascript;base64,' + Buffer.from(precarica).toString('base64');
const lancia = (modo, arg) => spawnSync(process.execPath, [argPrecarica, ...arg],
    { cwd: radice, encoding: 'utf8', env: { ...process.env, ITM_PROVA_FINE_RIGA: modo } });

// ITALIANO: prima si controlla che il trucco funzioni davvero, altrimenti la prova non proverebbe niente.
// ENGLISH: first check that the trick really works, otherwise the test would prove nothing.
for (const modo of ['lf', 'crlf']) {
    const r = lancia(modo, ['-e', "const t = require('fs').readFileSync(require('path').join('src', 'App.tsx'), 'utf8'); console.log(JSON.stringify([t.includes('\\r\\n'), /[^\\r]\\n/.test(t)]));"]);
    dice(`${modo}: App.tsx viene letto con le fine riga volute`, modo === 'lf' ? [false, true] : [true, false],
        r.status === 0 ? JSON.parse(r.stdout.trim()) : r.stderr);
}

// ITALIANO: la prova del difetto e le sue vicine che cercano gia' testi di piu' righe con le due forme.
// ENGLISH: the test of the defect and its neighbours that already search multi-line texts in both forms.
const prove = ['test-history-strictmode.mjs', 'test-drag-page-image.mjs', 'test-drop-overlay-esc.mjs', 'test-drop-folder.mjs'];
for (const modo of ['lf', 'crlf']) {
    for (const nome of prove) {
        const r = lancia(modo, [path.join(radice, 'scripts', nome)]);
        const ultima = String(r.stdout || '').trim().split('\n').filter(Boolean).pop() || String(r.stderr || '').trim();
        dice(`${modo}: ${nome} passa (${ultima})`, 0, r.status);
    }
}

process.exit(esito());
