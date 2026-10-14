/* ITALIANO: PROVA DELLA CUSTODIA DELLA CHIAVE API
   La chiave API non deve MAI finire in chiaro in localStorage. Dentro Electron va nello
   storage cifrato (safeStorage); fuori da Electron (l'anteprima nel browser) uno storage
   cifrato non c'e', quindi la chiave resta solo in memoria per la sessione e setSecret
   risponde false, cosi' l'app mostra l'avviso "la chiave NON e' stata salvata".
   Si prova il codice VERO di src/utils/secureStorage.ts compilato con esbuild, con un
   localStorage e un safeStorage finti: niente rete, niente Electron, niente dati veri.
   Uso:  node scripts/test-secure-storage.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF HOW THE API KEY IS KEPT
   The API key must NEVER end up in clear text in localStorage. Inside Electron it goes to the
   encrypted storage (safeStorage); outside Electron (the browser preview) there is no
   encrypted storage, so the key stays in memory for the session only and setSecret answers
   false, so the app shows the "the key was NOT saved" notice.
   The REAL code of src/utils/secureStorage.ts is tested, compiled with esbuild, with a fake
   localStorage and a fake safeStorage: no network, no Electron, no real data.
   Usage:  node scripts/test-secure-storage.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ITALIANO: i messaggi del modulo sui fallimenti simulati sono ATTESI: si mettono da parte.
// ENGLISH: the module's messages about the simulated failures are EXPECTED: set them aside.
console.error = () => {};

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/secureStorage.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

let guai = 0, fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok ? '' : `\n        atteso: ${JSON.stringify(atteso)}\n        avuto:  ${JSON.stringify(avuto)}`));
};

// ITALIANO: un localStorage finto che tiene tutto in una Map, per vedere cosa verrebbe scritto su disco.
// ENGLISH: a fake localStorage keeping everything in a Map, to see what would be written to disk.
const discoFinto = () => {
    const disco = new Map();
    globalThis.localStorage = {
        getItem: (k) => (disco.has(k) ? disco.get(k) : null),
        setItem: (k, v) => { disco.set(k, String(v)); },
        removeItem: (k) => { disco.delete(k); },
    };
    return disco;
};
const K = 'geminiApiKey';
const V = 'AIza' + 'f'.repeat(35);

// =============================================================================
console.log('\n--- anteprima nel browser: nessuno storage cifrato ---');
{
    const disco = discoFinto();
    globalThis.window = {};
    dice('fuori da Electron', false, S.isElectronEnvironment());
    dice('salvare la chiave risponde false (l\'app avvisa che NON e salvata)', false, await S.setSecret(K, V));
    dice('...e in localStorage NON finisce niente', null, disco.get(K) ?? null);
    disco.set(K, V);
    dice('un residuo in chiaro di prima NON viene letto', '', await S.getSecret(K));
    // ITALIANO: nell'anteprima la chiave non c'e', quindi la X "togli chiave" non compare e il
    //           salvataggio non parte: il residuo in chiaro restava su disco per sempre. Si toglie
    //           alla lettura; si puo' sempre incollare di nuovo la chiave da Google AI Studio.
    // ENGLISH: in the preview there is no key, so the "remove key" X does not show and the save
    //          never runs: the clear-text leftover stayed on disk forever. It is removed on read;
    //          the key can always be pasted again from Google AI Studio.
    dice('...e il residuo in chiaro viene tolto subito, alla lettura', null, disco.get(K) ?? null);
    dice('salvando di nuovo la chiave il residuo in chiaro sparisce', [false, null], [await S.setSecret(K, V), disco.get(K) ?? null]);
    disco.set(K, V);
    dice('togliere la chiave (valore vuoto) riesce e pulisce il residuo', [true, null], [await S.setSecret(K, ''), disco.get(K) ?? null]);
    disco.set(K, V);
    await S.deleteSecret(K);
    dice('Rimuovi chiave pulisce il residuo', null, disco.get(K) ?? null);
}

// =============================================================================
console.log('\n--- Electron con lo storage cifrato: tutto come prima ---');
{
    const disco = discoFinto();
    const cassaforte = new Map();
    globalThis.window = { electronAPI: { isElectron: true, secureStorage: {
        get: async (k) => cassaforte.get(k) || '',
        set: async (k, v) => { if (v) cassaforte.set(k, v); else cassaforte.delete(k); return true; },
        delete: async (k) => { cassaforte.delete(k); return true; },
    } } };
    dice('dentro Electron', true, S.isElectronEnvironment());
    dice('salvare la chiave riesce', true, await S.setSecret(K, V));
    dice('...la chiave sta nello storage cifrato', V, cassaforte.get(K));
    dice('...e localStorage resta vuoto', null, disco.get(K) ?? null);
    dice('rileggerla la restituisce', V, await S.getSecret(K));
    cassaforte.clear();
    disco.set(K, 'vecchia-in-chiaro');
    dice('un residuo delle versioni vecchie viene restituito...', 'vecchia-in-chiaro', await S.getSecret(K));
    dice('...spostato nello storage cifrato...', 'vecchia-in-chiaro', cassaforte.get(K));
    dice('...e tolto da localStorage', null, disco.get(K) ?? null);
}

// =============================================================================
console.log('\n--- Electron con lo storage cifrato guasto: nessun salvataggio in chiaro ---');
{
    const disco = discoFinto();
    globalThis.window = { electronAPI: { secureStorage: {
        get: async () => '', set: async () => false, delete: async () => true,
    } } };
    dice('salvare la chiave risponde false', false, await S.setSecret(K, V));
    dice('...e localStorage resta vuoto', null, disco.get(K) ?? null);
    globalThis.window = { electronAPI: { secureStorage: {
        get: async () => '', set: async () => { throw new Error('guasto'); }, delete: async () => true,
    } } };
    disco.set(K, V);
    dice('anche se lo storage cifrato si rompe: false, e il residuo in chiaro sparisce', [false, null], [await S.setSecret(K, V), disco.get(K) ?? null]);
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
