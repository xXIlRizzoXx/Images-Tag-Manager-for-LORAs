/* ITALIANO: PROVA CHE LE PROVE NON DIPENDANO DA UN NODE CHE TOGLIE I TIPI TYPESCRIPT DA SOLO
   Da Node 22.18 / 23.6 import() di un file .ts funziona senza opzioni, perche' Node toglie i tipi da
   solo; con Node 20 o un Node 22 piu' vecchio da' ERR_UNKNOWN_FILE_EXTENSION. Il progetto non
   dichiara una versione minima di Node: una prova che importa un .ts direttamente fallisce solo su
   quei computer, e con lei "npm test" e "npm run electron:build". Le prove caricano i sorgenti .ts
   passando da esbuild.
   (1) Nessuna scripts/test-*.mjs chiama import() con un percorso .ts/.tsx (salvo un indirizzo data:,
       cioe' il risultato di esbuild).
   (2) test-modal-backdrop-drag, l'unica che lo faceva, passa anche con --no-experimental-strip-types
       (come su un Node senza quella funzione).
   Uso:  node scripts/test-tests-without-type-stripping.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE TESTS DO NOT DEPEND ON A NODE THAT STRIPS TYPESCRIPT TYPES ON ITS OWN
   Since Node 22.18 / 23.6 import() of a .ts file works without flags, because Node strips the types;
   on Node 20 or an older Node 22 it gives ERR_UNKNOWN_FILE_EXTENSION. The project declares no minimum
   Node version: a test that imports a .ts directly fails only on those computers, and with it
   "npm test" and "npm run electron:build". Tests load the .ts sources through esbuild.
   (1) No scripts/test-*.mjs calls import() with a .ts/.tsx path (except a data: URL, i.e. the
       esbuild output).
   (2) test-modal-backdrop-drag, the only one that did it, passes with --no-experimental-strip-types
       too (as on a Node without that feature).
   Usage:  node scripts/test-tests-without-type-stripping.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const cartella = path.dirname(fileURLToPath(import.meta.url));
const radice = path.resolve(cartella, '..');
const { dice, esito } = creaControlli();

// ---------------------------------------------------------------------------------------------
// 1. Nessun import() diretto di un .ts/.tsx / No direct import() of a .ts/.tsx
// ---------------------------------------------------------------------------------------------
// ITALIANO: argomento di import( con le parentesi bilanciate (le stringhe non contano).
// ENGLISH: argument of import( with balanced parentheses (strings are skipped).
const argomento = (s, da) => {
    let livello = 1, i = da, quota = null;
    for (; i < s.length && livello > 0; i++) {
        const c = s[i];
        if (quota) { if (c === '\\') i++; else if (c === quota) quota = null; continue; }
        if (c === '"' || c === "'" || c === '`') quota = c;
        else if (c === '(') livello++;
        else if (c === ')') livello--;
    }
    return s.slice(da, i - 1);
};
// ITALIANO: il testo con commenti e stringhe sostituiti da spazi (stesse posizioni), per non
//           scambiare per codice un "import (" scritto in un commento o dentro una stringa.
//           Una stringa con ' o " finisce comunque a fine riga (una / di un'espressione regolare
//           non la tiene aperta oltre).
// ENGLISH: the text with comments and strings replaced by spaces (same positions), so an
//          "import (" written in a comment or inside a string is not taken for code. A ' or "
//          string ends at the end of the line anyway (a regex quote cannot keep it open further).
const soloCodice = (s) => {
    const out = s.split('');
    for (let i = 0; i < s.length; i++) {
        const c = s[i], d = s[i + 1];
        let fine = -1;
        if (c === '/' && d === '/') { fine = s.indexOf('\n', i); if (fine < 0) fine = s.length; }
        else if (c === '/' && d === '*') { fine = s.indexOf('*/', i + 2); fine = fine < 0 ? s.length : fine + 2; }
        else if (c === '"' || c === "'" || c === '`') {
            let j = i + 1;
            for (; j < s.length; j++) {
                if (s[j] === '\\') { j++; continue; }
                if (s[j] === c) break;
                if (c !== '`' && s[j] === '\n') break;
            }
            fine = j + 1;
        }
        if (fine > i) { for (let k = i; k < fine && k < s.length; k++) if (s[k] !== '\n') out[k] = ' '; i = fine - 1; }
    }
    return out.join('');
};
const diretti = [];
for (const nome of fs.readdirSync(cartella).filter(f => /^test-.+\.mjs$/.test(f)).sort()) {
    const testo = fs.readFileSync(path.join(cartella, nome), 'utf8');
    for (const m of soloCodice(testo).matchAll(/\bimport\s*\(/g)) {
        const arg = argomento(testo, m.index + m[0].length).trim();
        if (/^['"`]data:/.test(arg)) continue;
        if (/\.tsx?['"`]/.test(arg)) diretti.push(`${nome}: import(${arg.slice(0, 80)})`);
    }
}
dice('nessuna prova chiama import() con un percorso .ts/.tsx', [], diretti);

// ---------------------------------------------------------------------------------------------
// 2. La prova vera senza la rimozione dei tipi / The real test without type stripping
// ---------------------------------------------------------------------------------------------
// ITALIANO: su un Node che non ha l'opzione la rimozione dei tipi non c'e' proprio: basta lanciarla.
// ENGLISH: on a Node without the flag there is no type stripping at all: just run it.
const haOpzione = process.allowedNodeEnvironmentFlags.has('--experimental-strip-types');
const opzioni = haOpzione ? ['--no-experimental-strip-types'] : [];
if (haOpzione) {
    // ITALIANO: premessa: con l'opzione un .ts importato direttamente non si carica davvero.
    // ENGLISH: premise: with the flag a directly imported .ts really does not load.
    const p = spawnSync(process.execPath, [...opzioni, '--input-type=module', '-e',
        "import { pathToFileURL } from 'node:url'; try { await import(pathToFileURL('src/utils/backdropClose.ts').href); console.log('CARICATO'); } catch (e) { console.log(e && e.code); }"],
    { cwd: radice, encoding: 'utf8' });
    dice('premessa: con --no-experimental-strip-types un .ts non si carica', 'ERR_UNKNOWN_FILE_EXTENSION', String(p.stdout).trim());
}
const r = spawnSync(process.execPath, [...opzioni, path.join(cartella, 'test-modal-backdrop-drag.mjs')], { cwd: radice, encoding: 'utf8' });
const righe = String(r.stdout || '').trim().split('\n');
dice('test-modal-backdrop-drag passa senza la rimozione dei tipi di Node',
    { codice: 0, no: [] },
    { codice: r.status, no: righe.filter(l => /^NO\b/.test(l) || /non caricato/.test(l)).map(l => l.trim()) });

process.exit(esito());
