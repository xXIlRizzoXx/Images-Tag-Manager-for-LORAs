/* ITALIANO: PROVA CHE TEMA E SUONI VENGONO RICORDATI TRA UN AVVIO E L'ALTRO
   Si sceglieva il tema chiaro e si spegnevano i suoni; alla riapertura il programma ripartiva
   scuro e con i suoni accesi. Eppure l'installer (pagina dell'installazione pulita, nove lingue)
   dice di cancellare "la lingua scelta, il tema e i suoni", e la scheda del README dice che la
   scelta viene ricordata. La regola: tutte e due le scelte si leggono da localStorage alla
   partenza (senza niente salvato: scuro e suoni accesi, come prima) e ci si riscrivono a ogni
   cambio, con la stessa chiave.
   Si prendono dal sorgente VERO di src/App.tsx il valore iniziale di useState (lo si esegue con un
   localStorage finto) e l'effetto che salva. Il rendering non serve: il valore iniziale e' tutto.
   Uso:  node scripts/test-theme-sound-remembered.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THEME AND SOUNDS ARE REMEMBERED ACROSS LAUNCHES
   Picking the light theme and turning sounds off was lost on the next start: the program came
   back dark with sounds on. Yet the installer (clean install page, nine languages) says it wipes
   "the chosen language, theme and sounds", and the README card says the choice is remembered.
   The rule: both choices are read from localStorage at start (with nothing saved: dark and sounds
   on, as before) and written back on every change, under the same key.
   The initial value of useState (run against a fake localStorage) and the effect that saves are
   taken from the REAL source of src/App.tsx. No rendering needed: the initial value is all.
   Usage:  node scripts/test-theme-sound-remembered.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const { dice, esito } = creaControlli();

// ITALIANO: l'argomento di useState per [nome, setNome], con le parentesi bilanciate.
// ENGLISH: the useState argument for [nome, setNome], with balanced brackets.
const valoreIniziale = (nome) => {
    const m = new RegExp(String.raw`const \[${nome}, set\w+\] = useState(?:<[^>]*>)?\(`).exec(sorgente);
    if (!m) return null;
    let i = m.index + m[0].length, livello = 1;
    const inizio = i;
    for (; i < sorgente.length && livello > 0; i++) {
        if (sorgente[i] === '(') livello++;
        else if (sorgente[i] === ')') livello--;
    }
    return sorgente.slice(inizio, i - 1).trim();
};

// ITALIANO: un localStorage finto: `valori` iniziali, oppure uno che si rifiuta (modalita' privata).
// ENGLISH: a fake localStorage: initial `valori`, or one that refuses (private mode).
const archivio = (valori, rotto = false) => ({
    getItem: (k) => { if (rotto) throw new Error('storage non disponibile'); return Object.prototype.hasOwnProperty.call(valori, k) ? valori[k] : null; },
    setItem: (k, v) => { if (rotto) throw new Error('storage non disponibile'); valori[k] = String(v); },
});

const leggiAvvio = async (testo, ls) => {
    const js = (await esbuild.transform('const x = (' + testo + ');', { loader: 'ts' })).code;
    const x = new Function('localStorage', js + '\nreturn x;')(ls);
    return typeof x === 'function' ? x() : x;
};

// ITALIANO: gli effetti che hanno [nome] come unica dipendenza e scrivono in localStorage.
// ENGLISH: the effects whose only dependency is [nome] and that write to localStorage.
const effettiCheSalvano = (nome) => {
    const fuori = [];
    const fine = `}, [${nome}]);`;
    let da = 0;
    for (;;) {
        const iFine = sorgente.indexOf(fine, da);
        if (iFine < 0) break;
        const iUso = sorgente.lastIndexOf('useEffect(() => {', iFine);
        const corpo = sorgente.slice(iUso, iFine + fine.length);
        if (iUso >= 0 && corpo.includes('localStorage.setItem(')) fuori.push(corpo);
        da = iFine + fine.length;
    }
    return fuori;
};

for (const [nome, spento, etichetta] of [['isDarkMode', false, 'tema'], ['soundEnabled', false, 'suoni']]) {
    console.log(`\n--- ${etichetta} (${nome}) ---`);
    const testo = valoreIniziale(nome);
    if (!testo) { dice(`useState di ${nome} trovato in src/App.tsx`, true, false); continue; }
    const effetti = effettiCheSalvano(nome);
    dice(`un effetto su [${nome}] salva la scelta in localStorage`, 1, effetti.length);
    let chiave = null;
    if (effetti.length === 1) {
        // ITALIANO: l'effetto vero, eseguito con un localStorage finto: che chiave scrive e cosa.
        // ENGLISH: the real effect, run against a fake localStorage: which key it writes and what.
        const iCorpo = effetti[0].indexOf('{') + 1;
        const corpo = effetti[0].slice(iCorpo, effetti[0].lastIndexOf('}, ['));
        const js = (await esbuild.transform(corpo, { loader: 'ts' })).code;
        const valori = {};
        new Function('localStorage', nome, js)(archivio(valori), spento);
        const chiavi = Object.keys(valori);
        dice('l\'effetto scrive una sola chiave, con il valore scelto', [1, String(spento)], [chiavi.length, valori[chiavi[0]]]);
        chiave = chiavi[0] || null;
        let rotto = 'nessun errore';
        try { new Function('localStorage', nome, js)(archivio({}, true), spento); } catch (e) { rotto = 'errore: ' + e.message; }
        dice('con localStorage non disponibile l\'effetto non rompe l\'app', 'nessun errore', rotto);
    }
    if (chiave) {
        dice('riaprendo dopo averlo spento, riparte spento', spento, await leggiAvvio(testo, archivio({ [chiave]: String(spento) })));
        dice('riaprendo dopo averlo acceso, riparte acceso', true, await leggiAvvio(testo, archivio({ [chiave]: 'true' })));
    }
    dice('senza niente di salvato riparte acceso, come prima', true, await leggiAvvio(testo, archivio({})));
    let esitoRotto;
    try { esitoRotto = await leggiAvvio(testo, archivio({}, true)); } catch (e) { esitoRotto = 'errore: ' + e.message; }
    dice('con localStorage non disponibile riparte acceso, senza errori', true, esitoRotto);
}

process.exit(esito());
