/* ITALIANO: PROVA: ALL'AVVIO LA CHIAVE API APPENA LETTA NON SI RISCRIVE
   All'avvio la chiave letta dall'archivio cifrato entrava nello stato, e l'effetto che salva la
   chiave "appena cambia" la riscriveva subito, identica. Con secrets.json non scrivibile (sola
   lettura, bloccato da un antivirus o da un programma di sincronizzazione) a ogni avvio compariva
   in rosso "chiave NON salvata", ma la chiave era salvata; e anche quando tutto va bene il file
   veniva riscritto a ogni avvio senza motivo. Ora si salva solo un valore diverso da quello che
   si sa essere sul disco. Si eseguono i testi VERI dei due effetti di src/App.tsx (lettura
   all'avvio e salvataggio) con src/utils/secureStorage.ts vero e un archivio cifrato finto.
   Casi vicini che non devono cambiare: una chiave nuova si salva (e se non si puo' l'avviso
   compare), togliere la chiave scrive ancora, la stessa chiave rimessa dopo un salvataggio fallito
   si ritenta, un residuo in chiaro di versioni vecchie che non si e' potuto spostare si ritenta.
   Uso:  node scripts/test-api-key-no-resave-at-start.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: AT START THE API KEY JUST READ IS NOT WRITTEN AGAIN
   At start the key read from the encrypted store went into the state, and the effect that saves
   the key "on every change" wrote it again at once, identical. With a non-writable secrets.json
   (read-only, locked by an antivirus or a sync program) a red "key NOT saved" showed at every
   start, though the key was saved; and even when all is well the file was rewritten at every start
   for no reason. Now only a value different from the one known to be on disk is saved. The REAL
   text of the two effects of src/App.tsx (read at start and save) runs with the real
   src/utils/secureStorage.ts and a fake encrypted store.
   Neighbouring cases that must not change: a new key is saved (and if it cannot be, the notice
   shows), removing the key still writes, the same key put back after a failed save is retried, a
   clear-text leftover of old versions that could not be moved is retried.
   Usage:  node scripts/test-api-key-no-resave-at-start.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
console.error = () => { };
const S = await carica('src/utils/secureStorage.ts');
const t = (await carica('src/constants.ts')).translations.en;

// ITALIANO: i corpi dei due effetti, dal sorgente vero. ENGLISH: the two effect bodies, from the real source.
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const pezzo = (inizioTesto, fineTesto) => {
    const a = app.indexOf(inizioTesto);
    const b = a < 0 ? -1 : app.indexOf(fineTesto, a);
    if (a < 0 || b < 0) { console.log('NO  pezzo non trovato in src/App.tsx: ' + inizioTesto.trim()); process.exit(1); }
    return app.slice(a, b);
};
const tsInJs = async (codice) => (await esbuild.transform(codice, { loader: 'ts' })).code;
const caricamento = await tsInJs(pezzo("        getSecret('geminiApiKey').then((value) => {", '        return () => { cancelled = true; };'));
const salvataggio = await tsInJs(pezzo('        if (!apiKeyLoadedRef.current) return;', '    }, [geminiApiKey]);'));
// ITALIANO: i ref dichiarati accanto ad apiKeyLoadedRef che i due pezzi possono leggere (nessuno nel codice di prima).
// ENGLISH: the refs declared next to apiKeyLoadedRef that the two pieces may read (none in the old code).
const refNuovi = [...new Set([...(caricamento + salvataggio).matchAll(/\b(chiave\w*Ref)\b/g)].map(m => m[1]))];

const attendi = () => new Promise(r => setTimeout(r, 10));
// ITALIANO: un'app finta come React: lo stato della chiave, e l'effetto di salvataggio che gira
//           dopo ogni cambio vero (Object.is).
// ENGLISH: a fake React-like app: the key state, and the save effect running after every real
//          change (Object.is).
const avvia = async ({ suDisco, scriveOk = true, residuo = null }) => {
    const mem = new Map();
    if (residuo !== null) mem.set('geminiApiKey', residuo);
    globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
    const r = { scritture: [], notifiche: [], scriveOk, disco: suDisco };
    globalThis.window = { electronAPI: { secureStorage: {
        get: async () => r.disco,
        set: async (_k, v) => { r.scritture.push(v); if (!r.scriveOk) return false; r.disco = v; return true; },
        delete: async () => { if (!r.scriveOk) return false; r.disco = ''; return true; },
    } } };
    const apiKeyLoadedRef = { current: false };
    const ref = Object.fromEntries(refNuovi.map(n => [n, { current: null }]));
    let geminiApiKey = '';
    const corpo = new Function('apiKeyLoadedRef', 'setSecret', 'geminiApiKey', 'showNotification', 't', 'console', ...refNuovi, salvataggio);
    const setGeminiApiKey = (v) => {
        if (Object.is(v, geminiApiKey)) return;
        geminiApiKey = v;
        // ITALIANO: come React, l'effetto gira dopo il disegno, non dentro setGeminiApiKey.
        // ENGLISH: like React, the effect runs after the render, not inside setGeminiApiKey.
        setTimeout(() => corpo(apiKeyLoadedRef, S.setSecret, v, (m, tipo) => r.notifiche.push([m, tipo]), t, console, ...refNuovi.map(n => ref[n])), 0);
    };
    new Function('getSecret', 'setGeminiApiKey', 'apiKeyLoadedRef', 'setChiaveApiCaricata', 'cancelled', 'localStorage', ...refNuovi, caricamento)(
        S.getSecret, setGeminiApiKey, apiKeyLoadedRef, () => { }, false, globalThis.localStorage, ...refNuovi.map(n => ref[n]));
    await attendi();
    r.cambia = async (v) => { setGeminiApiKey(v); await attendi(); };
    r.chiave = () => geminiApiKey;
    r.mem = mem;
    return r;
};
const K1 = 'AIza-finta-chiave-gia-salvata';
const K2 = 'AIza-finta-chiave-nuova';

console.log('\n--- avvio con la chiave salvata e secrets.json non scrivibile ---');
{
    const r = await avvia({ suDisco: K1, scriveOk: false });
    dice('la chiave e\' letta', K1, r.chiave());
    dice('nessuna scrittura all\'avvio', [], r.scritture);
    dice('nessun "chiave NON salvata" all\'avvio', [], r.notifiche);
}

console.log('\n--- avvio con la chiave salvata e tutto a posto ---');
{
    const r = await avvia({ suDisco: K1 });
    dice('il file della chiave non si riscrive a ogni avvio', [], r.scritture);
    await r.cambia(K2);
    dice('una chiave nuova si salva, una volta', [K2], r.scritture);
    dice('...senza avvisi', [], r.notifiche);
    await r.cambia('');
    dice('togliere la chiave scrive ancora (valore vuoto)', [K2, ''], r.scritture);
    await r.cambia(K1);
    dice('rimettere una chiave dopo averla tolta la salva', [K2, '', K1], r.scritture);
}

console.log('\n--- salvataggio che fallisce dopo l\'avvio ---');
{
    const r = await avvia({ suDisco: K1, scriveOk: false });
    await r.cambia(K2);
    dice('chiave nuova non salvabile: l\'avviso compare come prima', [[t.apiKeyNotSaved, 'error']], r.notifiche);
    r.scriveOk = true;
    await r.cambia(K1);
    dice('dopo un salvataggio fallito il contenuto del disco non e\' piu\' certo: la chiave scelta si scrive', [K2, K1], r.scritture);
    await r.cambia(K2);
    dice('la chiave che non si era salvata si ritenta', [K2, K1, K2], r.scritture);
    await r.cambia(K2);
    dice('...e una volta salvata non si riscrive', [K2, K1, K2], r.scritture);
}

console.log('\n--- avvio senza chiave ---');
{
    const r = await avvia({ suDisco: '' });
    dice('nessuna scrittura', [], r.scritture);
    await r.cambia(K2);
    dice('la prima chiave si salva', [K2], r.scritture);
}

console.log('\n--- residuo in chiaro di una versione vecchia che non si e\' potuto spostare ---');
{
    const r = await avvia({ suDisco: '', scriveOk: false, residuo: K1 });
    dice('la chiave del residuo e\' usata', K1, r.chiave());
    dice('lo spostamento si ritenta e l\'avviso dice che non e\' salvata (come prima)', [true, [[t.apiKeyNotSaved, 'error']]],
        [r.scritture.length >= 2, r.notifiche]);
    dice('...e il residuo in chiaro sparisce comunque', false, r.mem.has('geminiApiKey'));
}

process.exit(esito());
