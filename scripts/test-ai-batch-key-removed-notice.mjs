/* ITALIANO: PROVA DI "Togli la chiave" MENTRE "Tagga tutte con AI" ASPETTA FRA DUE FOTO
   Il lotto aspetta quasi sempre fra una foto e l'altra (14 richieste al minuto). Premendo la X della
   chiave l'avviso della chiave ("API key rimossa", o l'errore "al prossimo avvio verra' caricata di
   nuovo" se secrets.json non si puo' riscrivere) restava a schermo un decimo di secondo: poi il lotto
   si svegliava e il suo riepilogo "Tagging con AI annullato..." lo copriva (un solo posto per gli
   avvisi). Ora un lotto fermato da una chiave tolta o cambiata non mostra il riepilogo, come quello
   fermato da "Chiudi progetto".
   Qui l'orologio e' VERO (setTimeout e Date reali): conta l'ordine dei due avvisi. Dura meno di 2 s.
   Casi vicini che non devono cambiare: "Annulla" del lotto mostra ancora il riepilogo azzurro.
   Si eseguono i testi VERI di handleAITagAll, handleClearApiKey e handleCancelAITagging (src/App.tsx)
   con il vero geminiService e un Google finto, senza rete.
   Uso:  node scripts/test-ai-batch-key-removed-notice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "Remove the key" WHILE "Tag all with AI" WAITS BETWEEN TWO PHOTOS
   The batch almost always waits between one photo and the next (14 requests a minute). Pressing the
   key's X, the key notice ("API key removed", or the error "it will be loaded again at the next
   start" when secrets.json cannot be rewritten) stayed on screen a tenth of a second: then the batch
   woke up and its "AI tagging cancelled..." summary covered it (a single notice slot). Now a batch
   stopped by a removed or changed key shows no summary, like one stopped by "Close project".
   The clock here is REAL (real setTimeout and Date): the order of the two notices matters. It takes
   under 2 s.
   Neighbouring case that must not change: the batch's "Cancel" still shows the blue summary.
   The REAL text of handleAITagAll, handleClearApiKey and handleCancelAITagging (src/App.tsx) runs with
   the real geminiService and a fake Google, with no network.
   Usage:  node scripts/test-ai-batch-key-removed-notice.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI { constructor() {} get models() { return {
                    list: async () => ({ async *[Symbol.asyncIterator]() { } }),
                    generateContent: async () => { globalThis.__CHIAMATE_FINTE__++; return { text: '["cat"]' }; } }; } }`,
            loader: 'js',
        }));
    },
};
const carica = async (rel, plugins = []) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, plugins, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
globalThis.__CHIAMATE_FINTE__ = 0;
const G = await carica('src/services/geminiService.ts', [finto]);
const C = await carica('src/utils/tagCase.ts');
const S = await carica('src/utils/sidecarTags.ts');
const t = (await carica('src/constants.ts')).translations.en;
globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,AAAA'; queueMicrotask(() => this.onloadend && this.onloadend()); } };

const src = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const prendi = (inizio, fineRe) => {
    const i = src.indexOf(inizio);
    if (i < 0) { console.log('NO  non trovato in src/App.tsx: ' + inizio.trim()); process.exit(1); }
    fineRe.lastIndex = i;
    const f = fineRe.exec(src);
    return src.slice(i, f.index + f[0].length);
};
const codice = (await esbuild.transform([
    prendi('    const handleCancelAITagging = useCallback(', /\r?\n    \}, \[\]\);\r?\n/g),
    prendi('    const handleAITagAll = useCallback(', /\r?\n    \}, \[[^\]]*\]\);\r?\n/g),
    prendi('    const handleClearApiKey = useCallback(', /\r?\n    \}, \[t\]\);\r?\n/g),
].join('\n'), { loader: 'ts' })).code;
const NOMI = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'aiRpm', 'aiSkipTagged', 'images',
    'imagesRef', 'isGlobalAITagging', 't', 'updateImageTags', 'getGeminiTags', 'classifyGeminiError', 'showNotification',
    'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'aiCancelRequestedRef', 'setAiCancelRequested',
    'aiAbortControllerRef', 'setIsGlobalAITagging', 'setGlobalAIProgress', 'countNewTagsIgnoringCase', 'globalTriggersRef',
    'hasTagsBeyondTriggers', 'useCallback', 'console', 'txtNonLettoInVigore', 'progettoGenRef',
    'geminiApiKeyRef', 'aiSingolaControllerRef', 'aiLottoRef', 'setToast', 'deleteSecret', 'setGeminiApiKey', 'setIsAIBusy', 'provaModelliRef'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { handleAITagAll, handleClearApiKey, handleCancelAITagging };');

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 0xAE, 0x42, 0x60, 0x82]);
// ITALIANO: lotto di 3 foto; dopo 300 ms (il lotto aspetta la seconda foto) `azione` sulle funzioni vere.
//           deleteSecret risponde dopo 5 ms con `cancellata`, come il processo principale.
// ENGLISH: a 3-photo batch; after 300 ms (the batch waits for the second photo) `azione` on the real
//          functions. deleteSecret answers after 5 ms with `cancellata`, like the main process.
const prova = async (azione, cancellata = true) => {
    const foto = ['a', 'b', 'c'].map(id => ({ id, isTrashed: false, tags: [], file: new File([PNG], id + '.png', { type: 'image/png' }) }));
    const chiave = 'AIza' + 'x'.repeat(35);
    const r = { avvisi: [], suoni: 0 };
    const dip = {
        aiEnabled: true, geminiApiKey: chiave, aiModel: 'gemini-3.8-flash', aiMaxTags: 30, aiCustomPrompt: '', aiRpm: 14,
        aiSkipTagged: false, images: foto, imagesRef: { current: foto }, isGlobalAITagging: false, t,
        updateImageTags: (id, tags) => { const f = foto.find(x => x.id === id); if (f) f.tags = tags; },
        getGeminiTags: G.getGeminiTags, classifyGeminiError: G.classifyGeminiError,
        showNotification: (m, tipo) => r.avvisi.push([tipo, m]),
        soundManager: { chime() { r.suoni++; } }, setRiparaModello: () => { }, setIsApiKeyDialogOpen: () => { },
        aiCancelRequestedRef: { current: false }, setAiCancelRequested: () => { }, aiAbortControllerRef: { current: null },
        setIsGlobalAITagging: () => { }, setGlobalAIProgress: () => { },
        countNewTagsIgnoringCase: C.countNewTagsIgnoringCase, globalTriggersRef: { current: [] },
        hasTagsBeyondTriggers: C.hasTagsBeyondTriggers, useCallback: (f) => f,
        console: { log() { }, warn() { }, error() { } }, txtNonLettoInVigore: S.txtNonLettoInVigore,
        progettoGenRef: { current: 0 }, geminiApiKeyRef: { current: chiave }, aiSingolaControllerRef: { current: null }, aiLottoRef: { current: 0 }, setToast: () => { },
        deleteSecret: () => new Promise(ok => setTimeout(() => ok(cancellata), 5)),
        setGeminiApiKey: () => { }, setIsAIBusy: () => { }, provaModelliRef: { current: null },
    };
    const f = fabbrica(...NOMI.map(n => dip[n]));
    const lotto = f.handleAITagAll();
    await new Promise(ok => setTimeout(ok, 300));
    await azione(f);
    await lotto;
    r.ultimo = r.avvisi[r.avvisi.length - 1] || null;
    r.chiamate = globalThis.__CHIAMATE_FINTE__;
    globalThis.__CHIAMATE_FINTE__ = 0;
    return r;
};
const eRiepilogo = (avviso) => !!avviso && String(avviso[1]).startsWith(t.aiBatchCancelled.split('{ok}')[0]);

console.log('\n--- "Togli la chiave" mentre il lotto aspetta ---');
{
    const r = await prova((f) => f.handleClearApiKey(), false);
    dice('chiave NON cancellata: l\'errore "verra\' caricata di nuovo" resta l\'ultimo avviso', [t.aiKeyNotRemoved, 'error'], r.ultimo && [r.ultimo[1], r.ultimo[0]]);
    dice('...nessun riepilogo "annullato" dopo', false, r.avvisi.some(eRiepilogo));
    dice('...e nessuna altra foto parte', 1, r.chiamate);
}
{
    const r = await prova((f) => f.handleClearApiKey(), true);
    dice('chiave cancellata: "API key rimossa" resta l\'ultimo avviso', [t.aiKeyCleared, 'success'], r.ultimo && [r.ultimo[1], r.ultimo[0]]);
    dice('...nessun riepilogo "annullato" dopo', false, r.avvisi.some(eRiepilogo));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await prova((f) => { f.handleCancelAITagging(); });
    dice('"Annulla" del lotto: il riepilogo azzurro "annullato" come prima', [true, 'info'], [eRiepilogo(r.ultimo), r.ultimo && r.ultimo[0]]);
    dice('...con il suono', 1, r.suoni);
}

process.exit(esito());
