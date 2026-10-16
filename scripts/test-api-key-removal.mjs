/* ITALIANO: PROVA DI "TOGLI LA CHIAVE API" QUANDO LA CHIAVE NON SI PUO' CANCELLARE
   Se il file cifrato della chiave non si poteva riscrivere (attributo di sola lettura, file
   bloccato da un antivirus o da un programma di sincronizzazione), il processo principale
   rispondeva "non cancellata", ma deleteSecret buttava via la risposta e l'app diceva "API key
   rimossa" con il suono di successo. Al riavvio la chiave "tolta" tornava e veniva usata. La
   regola: deleteSecret dice se la chiave e' stata cancellata davvero, e l'app annuncia la
   rimozione solo allora; altrimenti dice, con un errore, che la chiave tornera' al prossimo
   avvio. In ogni caso la sessione smette subito di usarla.
   Si provano il codice VERO di src/utils/secureStorage.ts e il testo VERO di handleClearApiKey
   preso da src/App.tsx (compilati con esbuild), con un archivio cifrato finto: niente Electron,
   niente chiavi vere, niente rete.
   Uso:  node scripts/test-api-key-removal.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "REMOVE THE API KEY" WHEN THE KEY CANNOT BE DELETED
   If the key's encrypted file could not be rewritten (read-only attribute, file locked by an
   antivirus or a sync program), the main process answered "not deleted", but deleteSecret threw
   the answer away and the app said "API key removed" with the success sound. On restart the
   "removed" key came back and was used. The rule: deleteSecret says whether the key was really
   deleted, and the app announces the removal only then; otherwise it says, with an error, that the
   key will come back at the next start. Either way the session stops using it at once.
   The REAL code of src/utils/secureStorage.ts and the REAL text of handleClearApiKey taken from
   src/App.tsx are tested (compiled with esbuild), with a fake encrypted store: no Electron, no
   real keys, no network.
   Usage:  node scripts/test-api-key-removal.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
// ITALIANO: i messaggi del modulo sui fallimenti simulati sono ATTESI: si mettono da parte.
// ENGLISH: the module's messages about the simulated failures are EXPECTED: set them aside.
const muto = { log() { }, warn() { }, error() { } };
console.error = () => { };
const S = await carica('src/utils/secureStorage.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();

const K = 'geminiApiKey';
const memoria = () => {
    const m = new Map();
    globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
    return m;
};
const conArchivio = (cancella) => { globalThis.window = { electronAPI: { isElectron: true, secureStorage: { get: async () => '', set: async () => true, delete: cancella } } }; };

console.log('\n--- deleteSecret dice se la chiave e\' stata cancellata davvero ---');
{
    const m = memoria();
    conArchivio(async () => true);
    dice('archivio cifrato che cancella: vero', true, await S.deleteSecret(K));
    conArchivio(async () => false);
    m.set(K, 'residuo-in-chiaro');
    dice('archivio cifrato che non riesce a riscrivere il file: falso', false, await S.deleteSecret(K));
    dice('...e un residuo in chiaro in localStorage sparisce lo stesso', null, m.get(K) ?? null);
    conArchivio(async () => { throw new Error('canale rotto'); });
    dice('canale che si rompe: falso', false, await S.deleteSecret(K));
    globalThis.window = {};
    dice('anteprima nel browser (nessun archivio cifrato, niente da cancellare): vero', true, await S.deleteSecret(K));
}

// ITALIANO: il testo vero di handleClearApiKey, dalla sua intestazione al suo "}, [t]);".
// ENGLISH: the real text of handleClearApiKey, from its header to its "}, [t]);".
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleClearApiKey = useCallback(');
const chiusura = /\r?\n    \}, \[t\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  handleClearApiKey non trovato in src/App.tsx'); process.exit(1); }
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const NOMI = ['aiCancelRequestedRef', 'setAiCancelRequested', 'aiAbortControllerRef', 'deleteSecret', 'setGeminiApiKey', 'setIsAIBusy',
    'setIsGlobalAITagging', 'setGlobalAIProgress', 'soundManager', 'showNotification', 't', 'useCallback', 'console',
    'provaModelliRef', 'geminiApiKeyRef'];
const togli = async (cancellata) => {
    const r = { notifiche: [], suoni: [], chiave: 'AIza-finta', fermato: false, prova: new AbortController(), chiaveRef: { current: 'AIza-finta' } };
    const nulla = () => { };
    const f = new Function(...NOMI, js + '\nreturn handleClearApiKey;')(
        { current: false }, () => { r.fermato = true; }, { current: null }, async () => cancellata, (v) => { r.chiave = v; }, nulla,
        nulla, nulla, { chime: () => r.suoni.push('chime'), pop: () => r.suoni.push('pop') }, (m, tipo) => r.notifiche.push([m, tipo]),
        t, (fn) => fn, muto, { current: r.prova }, r.chiaveRef);
    await f();
    return r;
};

console.log('\n--- "Togli la chiave API" nelle impostazioni ---');
{
    const r = await togli(false);
    dice('chiave NON cancellata: niente "API key removed", un errore che dice che tornera\'', [[t.aiKeyNotRemoved, 'error']], r.notifiche);
    dice('...senza il suono di successo', [], r.suoni);
    dice('...e la sessione smette comunque di usarla (chiave in memoria vuota, tagging fermato)', ['', true], [r.chiave, r.fermato]);
    dice('il messaggio c\'e\' davvero', true, typeof t.aiKeyNotRemoved === 'string' && t.aiKeyNotRemoved.length > 20);
}
{
    const r = await togli(true);
    dice('chiave cancellata: "API key removed" come prima', [[t.aiKeyCleared, 'success']], r.notifiche);
    dice('...con il suono di successo', ['chime'], r.suoni);
    dice('...e la chiave in memoria vuota', '', r.chiave);
    // ITALIANO: anche la prova dei modelli e il controllo del modello smettono di usarla (vedi
    //           test-api-key-removal-stops-checks.mjs). ENGLISH: the model test and check stop using it too.
    dice('...e ferma "Prova i modelli recenti" e svuota subito la chiave letta dai controlli', [true, ''], [r.prova.signal.aborted, r.chiaveRef.current]);
}

process.exit(esito());
