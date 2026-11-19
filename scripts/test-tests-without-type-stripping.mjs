/* ITALIANO: PROVA CHE LE PROVE NON DIPENDANO DA UN NODE CHE TOGLIE I TIPI TYPESCRIPT DA SOLO
   Da Node 22.18 / 23.6 import() di un file .ts funziona senza opzioni, perche' Node toglie i tipi da
   solo; con Node 20 o un Node 22 piu' vecchio da' ERR_UNKNOWN_FILE_EXTENSION. Il progetto non
   dichiara una versione minima di Node: una prova che importa un .ts direttamente fallisce solo su
   quei computer, e con lei "npm test" e "npm run electron:build". Le prove caricano i sorgenti .ts
   passando da esbuild.
   (1) Nessuna prova o banco di scripts/ carica direttamente un .ts/.tsx: ne' con un import statico
       (import/export ... from '...ts', import '...ts'), ne' con import()/require() con il percorso
       scritto dentro o messo prima in una variabile (salvo un indirizzo data:, cioe' il risultato di
       esbuild). La guardia si prova anche da sola, su casi finti e sui casi vicini permessi.
   (2) test-modal-backdrop-drag, l'unica che lo faceva, passa anche con --no-experimental-strip-types
       (come su un Node senza quella funzione).
   Uso:  node scripts/test-tests-without-type-stripping.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE TESTS DO NOT DEPEND ON A NODE THAT STRIPS TYPESCRIPT TYPES ON ITS OWN
   Since Node 22.18 / 23.6 import() of a .ts file works without flags, because Node strips the types;
   on Node 20 or an older Node 22 it gives ERR_UNKNOWN_FILE_EXTENSION. The project declares no minimum
   Node version: a test that imports a .ts directly fails only on those computers, and with it
   "npm test" and "npm run electron:build". Tests load the .ts sources through esbuild.
   (1) No test or harness in scripts/ loads a .ts/.tsx directly: neither with a static import
       (import/export ... from '...ts', import '...ts') nor with import()/require() with the path
       written inside or first put in a variable (except a data: URL, i.e. the esbuild output). The
       guard is also tested on its own, on fake cases and on the allowed neighbouring cases.
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
// 1. Nessun caricamento diretto di un .ts/.tsx / No direct load of a .ts/.tsx
// ---------------------------------------------------------------------------------------------
// ITALIANO: argomento di import( o require( con le parentesi bilanciate (le stringhe non contano).
// ENGLISH: argument of import( or require( with balanced parentheses (strings are skipped).
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
//           non la tiene aperta oltre). Accanto al testo ripulito, l'elenco delle stringhe
//           (posizione e contenuto).
// ENGLISH: the text with comments and strings replaced by spaces (same positions), so an
//          "import (" written in a comment or inside a string is not taken for code. A ' or "
//          string ends at the end of the line anyway (a regex quote cannot keep it open further).
//          Next to the cleaned text, the list of the strings (position and content).
const analizza = (s) => {
    const out = s.split('');
    const stringhe = [];
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
            stringhe.push({ da: i, a: Math.min(fine, s.length), dentro: s.slice(i + 1, Math.min(j, s.length)) });
        }
        if (fine > i) { for (let k = i; k < fine && k < s.length; k++) if (s[k] !== '\n') out[k] = ' '; i = fine - 1; }
    }
    return { codice: out.join(''), stringhe };
};
const finisceInTs = (x) => /\.tsx?$/.test(x.dentro);
// ITALIANO: trova i caricamenti diretti di un .ts/.tsx in un file:
//           (a) import ... from '...ts', export ... from '...ts', import '...ts' (gli import statici:
//               Node li risolve prima di eseguire la prova, che si ferma subito);
//           (b) import(...) e require(...) con un percorso .ts scritto dentro l'argomento;
//           (c) import(...) e require(...) con il percorso messo prima in una variabile
//               (const file = path.resolve('src/x.ts'); import(pathToFileURL(file).href)): si seguono
//               fino a tre passaggi le variabili dell'argomento dichiarate nel file con const/let/var,
//               ma non quelle che sono un indirizzo data: o il risultato di esbuild (sono JavaScript).
//           Commenti e stringhe non contano: un "import ... .ts" dentro il testo dato a esbuild
//           (stdin.contents) non e' un caricamento di Node.
//           Restano fuori i percorsi passati come argomento di una funzione: non si seguono.
// ENGLISH: finds the direct loads of a .ts/.tsx in a file:
//          (a) import ... from '...ts', export ... from '...ts', import '...ts' (the static imports:
//              Node resolves them before running the test, which stops at once);
//          (b) import(...) and require(...) with a .ts path written inside the argument;
//          (c) import(...) and require(...) with the path first put in a variable
//              (const file = path.resolve('src/x.ts'); import(pathToFileURL(file).href)): the
//              argument's variables declared in the file with const/let/var are followed for up to
//              three steps, but not those that are a data: URL or the output of esbuild (JavaScript).
//          Comments and strings do not count: an "import ... .ts" inside the text given to esbuild
//          (stdin.contents) is not a Node load.
//          Left out: paths passed as a function argument, which are not followed.
const caricamentiDiretti = (testo) => {
    const { codice, stringhe } = analizza(testo);
    const trovati = new Set();
    // (a) import/export statici / static import/export
    for (const m of codice.matchAll(/(?<![.\w$])(import|export)\b/g)) {
        const dopo = codice.slice(m.index + m[0].length);
        if (m[1] === 'import' && /^\s*[(.]/.test(dopo)) continue; // import() e import.meta
        const lit = stringhe.find(x => x.da >= m.index + m[0].length);
        if (!lit) continue;
        const fra = codice.slice(m.index + m[0].length, lit.da);
        if (fra.includes(';')) continue;
        const statico = /\bfrom\s*$/.test(fra) || (m[1] === 'import' && fra.trim() === '');
        if (statico && finisceInTs(lit)) trovati.add(`${m[1]} ... '${lit.dentro}'`);
    }
    // (b) e (c) import() e require() / import() and require()
    const inizializzatore = (nome) => {
        const d = new RegExp(`(?<![.\\w$])(?:const|let|var)\\s+${nome.replace(/\$/g, '\\$')}\\s*=`).exec(codice);
        if (!d) return null;
        const da = d.index + d[0].length;
        let a = codice.indexOf('\n', da);
        if (a < 0) a = codice.length;
        const pv = codice.indexOf(';', da);
        if (pv >= 0 && pv < a) a = pv;
        return testo.slice(da, a);
    };
    const escluso = (pezzo) => /^\s*['"`]data:/.test(pezzo) || /\besbuild\b/.test(analizza(pezzo).codice);
    for (const m of codice.matchAll(/(?<![.\w$])(import|require)\s*\(/g)) {
        const arg = argomento(testo, m.index + m[0].length).trim();
        if (escluso(arg)) continue;
        const visti = new Set();
        let pezzi = [arg];
        let trovato = null;
        for (let passo = 0; passo <= 3 && pezzi.length && !trovato; passo++) {
            const prossimi = [];
            for (const p of pezzi) {
                const a = analizza(p);
                const ts = a.stringhe.find(finisceInTs);
                if (ts) { trovato = ts.dentro; break; }
                for (const [nome] of a.codice.matchAll(/(?<![.\w$])[A-Za-z_$][\w$]*/g)) {
                    if (visti.has(nome)) continue;
                    visti.add(nome);
                    const init = inizializzatore(nome);
                    if (init !== null && !escluso(init)) prossimi.push(init);
                }
            }
            pezzi = prossimi;
        }
        if (trovato) trovati.add(`${m[1]}(${arg.replace(/\s+/g, ' ').slice(0, 60)}) -> '${trovato}'`);
    }
    return [...trovati];
};

// ITALIANO: la guardia stessa, su casi finti: deve vedere ognuno dei caricamenti diretti e tacere sui
//           casi vicini che le prove usano davvero.
// ENGLISH: the guard itself, on fake cases: it must see each direct load and stay silent on the
//          neighbouring cases the tests really use.
const casi = [
    ['import statico', "import { gestoriSfondo } from '../src/utils/backdropClose.ts';", 1],
    ['import statico su piu\' righe', "import {\n    a,\n    b,\n} from \"../src/x.tsx\"\nconst c = 1;", 1],
    ['import solo per gli effetti', "import '../src/utils/x.ts';", 1],
    ['re-export', "export { a } from './src/a.ts';\nexport * from './src/b.ts';", 2],
    ['import() con il percorso in una variabile', "const file = path.resolve('src/utils/x.ts');\nawait import(pathToFileURL(file).href);", 1],
    ['import() con due passaggi di variabili', "const nome = 'src/utils/x.ts';\nconst file = path.resolve(radice, nome);\nconst url = pathToFileURL(file).href;\nawait import(url);", 1],
    ['import() con il percorso scritto dentro', "await import(pathToFileURL('src/utils/x.ts').href);", 1],
    ['require() di un .ts', "const m = require('../src/x.ts');", 1],
    ['caso vicino: import() del risultato di esbuild', "const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/x.ts')], write: false });\nconst M = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));", 0],
    ['caso vicino: indirizzo data: messo in una variabile', "const u = esbuild.build({ entryPoints: ['src/x.ts'] });\nconst js = 'data:text/javascript,' + u;\nawait import(js);", 0],
    ['caso vicino: import statici di .mjs e di pacchetti', "import fs from 'node:fs';\nimport { creaControlli } from './main-harness.mjs';\nexport const x = 'src/a.ts';", 0],
    ['caso vicino: import() di un .mjs con variabili', "const radice = path.resolve('..');\nawait import(pathToFileURL(path.join(radice, 'scripts/csp-produzione.mjs')).href);", 0],
    ['caso vicino: .ts dentro il testo per esbuild e nei commenti', "// import x from './a.ts'\nawait esbuild.build({ stdin: { contents: `import { L } from './src/L.tsx';` } });", 0],
    ['caso vicino: un .ts che e\' solo un dato', "const voci = ['src/a.ts'];\nconst testo = fs.readFileSync(path.join(radice, 'src/b.ts'), 'utf8');\nawait import('./ai-batch-harness.mjs');", 0],
];
for (const [nome, testo, quanti] of casi) dice(`guardia: ${nome}`, quanti, caricamentiDiretti(testo).length);

// ITALIANO: tutte le prove e i banchi di scripts/ (anche i banchi sono importati dalle prove).
// ENGLISH: every test and harness in scripts/ (the harnesses are imported by the tests too).
const diretti = [];
for (const nome of fs.readdirSync(cartella).filter(f => /\.mjs$/.test(f)).sort()) {
    for (const x of caricamentiDiretti(fs.readFileSync(path.join(cartella, nome), 'utf8'))) diretti.push(`${nome}: ${x}`);
}
dice('nessuna prova o banco di scripts/ carica direttamente un .ts/.tsx', [], diretti);

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
