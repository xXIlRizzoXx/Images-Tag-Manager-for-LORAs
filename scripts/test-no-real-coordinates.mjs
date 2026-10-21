/* ITALIANO: PROVA CHE NEL REPOSITORY NON CI SIANO COORDINATE GPS VERE
   Il repository e' pubblico: le prove sui dati nascosti delle foto non devono mai usare come
   "segreto" di esempio una posizione GPS che esiste davvero, perche' legherebbe l'account a un
   luogo. Le prove devono usare coordinate chiaramente finte. Qui si cercano, in tutti i
   file di testo del repository, le coppie "gradi N/S + gradi E/W" con i decimali, e si accettano
   solo i valori finti dell'elenco qui sotto (65.4321 E e' in mezzo al mare).
   Gira senza rete: legge solo i file del repository (l'elenco di git, o la cartella se git non c'e').
   Uso:  node scripts/test-no-real-coordinates.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE REPOSITORY HOLDS NO REAL GPS COORDINATES
   The repository is public: tests of the photos' hidden data must never use a GPS position
   that really exists as their sample "secret", because it would tie the account to a place.
   Tests must use obviously fake coordinates. This looks, in every text file of the repository,
   for "degrees N/S + degrees E/W" pairs with decimals, and accepts only the fake values listed
   below (65.4321 E is in the middle of the sea).
   Runs without network: it only reads the repository's files (git's list, or the folder when
   git is not there).
   Usage:  node scripts/test-no-real-coordinates.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ITALIANO: la cartella da controllare: quella del progetto, o quella data come primo argomento (la
//           usa scripts/test-no-real-coordinates-untracked.mjs su un repository finto).
// ENGLISH: the folder to check: the project's, or the one given as first argument (used by
//          scripts/test-no-real-coordinates-untracked.mjs on a fake repository).
const radice = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTO = /\.(mjs|cjs|js|ts|tsx|json|md|html|css|nsh|txt|yml|yaml)$/i;
const FINTE = new Set(['12.3456N 65.4321E', '0.0000N 0.0000E']);
const COPPIA = /(\d{1,2}\.\d{2,})\s*°?\s*([NS])[\s,;]+(\d{1,3}\.\d{2,})\s*°?\s*([EW])/g;

// ITALIANO: i file seguiti da git E quelli nuovi non ancora aggiunti (--others), senza gli ignorati:
//           un test nuovo e' proprio in quello stato quando le prove girano prima del commit.
//           Senza git (copia esportata) la cartella, senza le parti ignorate.
// ENGLISH: the files git tracks AND the new ones not added yet (--others), minus the ignored ones: a
//          new test is in exactly that state when the suite runs before the commit. Without git (an
//          exported copy) the folder, minus the ignored parts.
const elenco = () => {
    const g = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: radice, encoding: 'utf8' });
    if (g.status === 0 && g.stdout) return g.stdout.split('\0').filter(Boolean);
    const fuori = new Set(['node_modules', 'dist', 'Release', 'release', 'Civitai', 'NOTES.md']);
    const out = [];
    const giro = (rel) => {
        for (const voce of fs.readdirSync(path.join(radice, rel), { withFileTypes: true })) {
            if (voce.name.startsWith('.') || fuori.has(voce.name) || /^ANALISI-/.test(voce.name)) continue;
            const r = rel ? rel + '/' + voce.name : voce.name;
            if (voce.isDirectory()) giro(r); else out.push(r);
        }
    };
    giro('');
    return out;
};

const file = elenco().filter(f => TESTO.test(f));
const trovate = [];
for (const rel of file) {
    let testo;
    try { testo = fs.readFileSync(path.join(radice, rel), 'utf8'); } catch { continue; }
    for (const m of testo.matchAll(COPPIA)) {
        const forma = `${m[1]}${m[2]} ${m[3]}${m[4]}`;
        if (FINTE.has(forma)) continue;
        const riga = testo.slice(0, m.index).split('\n').length;
        trovate.push(`${rel}:${riga}  ${m[0]}`);
    }
}

let guai = 0;
const dice = (cosa, ok, dettaglio = '') => {
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok || !dettaglio ? '' : '\n        ' + dettaglio));
};
dice('i file di testo del repository sono stati letti', file.length > 50, String(file.length));
dice('nessuna coordinata GPS che non sia chiaramente finta', trovate.length === 0, trovate.join('\n        '));
// ITALIANO: la ricerca vede davvero una coppia vera (non un'espressione che non trova mai niente).
// ENGLISH: the search really sees a real pair (not a pattern that never finds anything).
const campione = ['GPS ', '48.8584', 'N 2.2945', 'E'].join('');
dice('la ricerca riconosce una coppia vera', [...campione.matchAll(COPPIA)].length === 1);

console.log(`\n${guai === 0 ? 'nessuna coordinata vera' : guai + ' controlli falliti'}`);
process.exit(guai === 0 ? 0 : 1);
