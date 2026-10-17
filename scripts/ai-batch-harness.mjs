/* ITALIANO: BANCO DI PROVA DI "TAGGA TUTTE CON AI" (taggatura in blocco)
   Ritaglia da src/App.tsx i testi VERI di handleAITagAll, di handleCancelAITagging e
   dell'interruttore AI delle Impostazioni (il suo onChange), li compila con esbuild e li esegue
   con il servizio vero di src/services/geminiService.ts, i testi veri di src/constants.ts e un
   Google finto (nessuna rete, nessuna chiave): ogni prova decide cosa risponde ogni richiesta e
   riceve anche le opzioni della richiesta (per esempio il segnale di annullamento). L'orologio e'
   finto: le attese passano subito. Nessuna finestra, nessun file toccato.
   Non e' una prova: run-tests.mjs lancia solo i file test-*.mjs.

   ENGLISH: TEST BENCH FOR "AUTO-TAG ALL WITH AI" (bulk tagging)
   Cuts the REAL text of handleAITagAll, of handleCancelAITagging and of the Settings AI switch
   (its onChange) out of src/App.tsx, compiles it with esbuild and runs it with the real service of
   src/services/geminiService.ts, the real strings of src/constants.ts and a fake Google (no
   network, no key): every test decides what each request answers and also gets the request's
   options (for example the cancel signal). The clock is fake: waits pass at once. No window, no
   file touched.
   Not a test: run-tests.mjs only runs test-*.mjs files. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ITALIANO: il Google finto: generate(n, richiesta) decide la risposta della richiesta numero n.
// ENGLISH: the fake Google: generate(n, request) decides the answer of request number n.
const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `
                export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI {
                    constructor() {}
                    get models() {
                        const g = globalThis.__GOOGLE__;
                        return {
                            list: async () => ({ async *[Symbol.asyncIterator]() { } }),
                            generateContent: async (richiesta) => { g.chiamate++; return g.generate(g.chiamate, richiesta); },
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};
const carica = async (rel, plugins = []) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, plugins, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/services/geminiService.ts', [finto]);
export const tagCase = await carica('src/utils/tagCase.ts');
const sidecar = await carica('src/utils/sidecarTags.ts');
export const lingue = (await carica('src/constants.ts')).translations;
export const t = lingue.en;

// ITALIANO: Node ha File ma non FileReader: basta un finto che dia un data URL qualunque.
// ENGLISH: Node has File but no FileReader: a fake returning any data URL is enough.
globalThis.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/png;base64,AAAA';
        queueMicrotask(() => this.onloadend && this.onloadend());
    }
};

export const sorgenteApp = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const prendi = (inizioTesto, fineRegex, nome) => {
    const inizio = sorgenteApp.indexOf(inizioTesto);
    fineRegex.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : fineRegex.exec(sorgenteApp);
    if (!fine) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
    return sorgenteApp.slice(inizio, fine.index + fine[0].length);
};
const testoTutte = prendi('    const handleAITagAll = useCallback(', /\r?\n    \}, \[[^\]]*\]\);\r?\n/g, 'handleAITagAll');
const testoAnnulla = prendi('    const handleCancelAITagging = useCallback(', /\r?\n    \}, \[\]\);\r?\n/g, 'handleCancelAITagging');
// ITALIANO: l'onChange dell'interruttore AI nelle Impostazioni, cosi' com'e' scritto nel JSX.
// ENGLISH: the onChange of the AI switch in Settings, exactly as written in the JSX.
const INIZIO_INTERRUTTORE = '<AppleToggle checked={aiEnabled} onChange={';
const iInterruttore = sorgenteApp.indexOf(INIZIO_INTERRUTTORE);
const fInterruttore = sorgenteApp.indexOf('} colorClass="bg-purple-500"', iInterruttore);
if (iInterruttore < 0 || fInterruttore < 0) { console.log('NO  interruttore AI non trovato in src/App.tsx'); process.exit(1); }
const testoInterruttore = 'const interruttoreAI = ' + sorgenteApp.slice(iInterruttore + INIZIO_INTERRUTTORE.length, fInterruttore) + ';';
const codice = (await esbuild.transform([testoAnnulla, testoTutte, testoInterruttore].join('\n'), { loader: 'ts' })).code;

const DIPENDENZE = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'aiRpm', 'aiSkipTagged', 'images',
    'imagesRef', 'isGlobalAITagging', 't', 'updateImageTags', 'getGeminiTags', 'classifyGeminiError', 'showNotification',
    'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'aiCancelRequestedRef', 'setAiCancelRequested',
    'aiAbortControllerRef', 'setIsGlobalAITagging', 'setGlobalAIProgress', 'countNewTagsIgnoringCase', 'globalTriggersRef',
    'hasTagsBeyondTriggers', 'setAiEnabled', 'useCallback', 'Date', 'setTimeout', 'console', 'txtNonLettoInVigore', 'progettoGenRef',
    'geminiApiKeyRef'];
const fabbrica = new Function(...DIPENDENZE, codice + '\nreturn { handleAITagAll, handleCancelAITagging, interruttoreAI };');

export const BUONA = { text: '["cat", "sofa"]' };

// ITALIANO: il PNG piu' piccolo (firma + IEND): il servizio legge i byte per togliere i dati nascosti
//           e rifiuta un file che non e' un'immagine vera.
// ENGLISH: the smallest PNG (signature + IEND): the service reads the bytes to remove the hidden data
//          and refuses a file that is not a real image.
const PNG_MINIMO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 0xAE, 0x42, 0x60, 0x82]);

/* ITALIANO: un'app finta con `fotoIniziali` (id e tag). `generate(n, richiesta)` risponde alla
   richiesta numero n. app.tutte() avvia "Tagga tutte con AI"; app.interruttore(v) e' il clic
   sull'interruttore AI; app.annulla() e' il pulsante Annulla.
   ENGLISH: a fake app with `fotoIniziali` (ids and tags). `generate(n, request)` answers request
   number n. app.tutte() starts "Auto-tag all with AI"; app.interruttore(v) is the click on the AI
   switch; app.annulla() is the Cancel button. */
export const nuovaApp = (fotoIniziali, generate, { skip = false, trigger = [] } = {}) => {
    globalThis.__GOOGLE__ = { chiamate: 0, generate };
    const foto = fotoIniziali.map(({ id, tags = [] }) => ({
        id, isTrashed: false, tags: [...tags], file: new File([PNG_MINIMO], `${id}.png`, { type: 'image/png' }),
    }));
    // ITALIANO: `progressi` raccoglie ogni stato della barra (setGlobalAIProgress), in ordine.
    // ENGLISH: `progressi` collects every state of the progress bar (setGlobalAIProgress), in order.
    const app = { notifiche: [], aiAttiva: true, finestraChiave: false, foto, progressi: [], suoni: 0 };
    let orologio = 1_000_000;
    const chiave = 'AIza' + 'x'.repeat(35);
    const dip = {
        aiEnabled: true, geminiApiKey: chiave, aiModel: 'gemini-3.8-flash', aiMaxTags: 30, aiCustomPrompt: '',
        aiRpm: 14, aiSkipTagged: skip, images: foto, imagesRef: { current: foto }, isGlobalAITagging: false, t,
        updateImageTags: (id, tags) => { const f = foto.find(x => x.id === id); if (f) f.tags = tags; },
        getGeminiTags: S.getGeminiTags, classifyGeminiError: S.classifyGeminiError,
        showNotification: (m, tipo) => app.notifiche.push([m, tipo]),
        soundManager: { chime() { app.suoni++; } },
        setRiparaModello: () => { },
        setIsApiKeyDialogOpen: (v) => { app.finestraChiave = v; },
        aiCancelRequestedRef: { current: false }, setAiCancelRequested: () => { },
        aiAbortControllerRef: { current: null }, setIsGlobalAITagging: () => { }, setGlobalAIProgress: (p) => { app.progressi.push(p); },
        countNewTagsIgnoringCase: tagCase.countNewTagsIgnoringCase,
        globalTriggersRef: { current: trigger },
        hasTagsBeyondTriggers: tagCase.hasTagsBeyondTriggers,
        setAiEnabled: (v) => { app.aiAttiva = v; },
        useCallback: (f) => f,
        // ITALIANO: orologio finto: ogni attesa fa avanzare il tempo e finisce subito.
        // ENGLISH: fake clock: every wait moves time forward and ends at once.
        Date: { now: () => orologio },
        setTimeout: (f, ms) => { orologio += Math.max(0, ms || 0); queueMicrotask(f); return 0; },
        console: { log() { }, warn() { }, error() { } },
        txtNonLettoInVigore: sidecar.txtNonLettoInVigore,
        progettoGenRef: { current: 0 },
        // ITALIANO: la chiave com'e' adesso (geminiApiKeyRef in App.tsx): all'inizio quella del lotto.
        // ENGLISH: the key as it is now (geminiApiKeyRef in App.tsx): at first the batch's one.
        geminiApiKeyRef: { current: chiave },
    };
    const pezzi = () => fabbrica(...DIPENDENZE.map(n => dip[n]));
    app.tutte = () => pezzi().handleAITagAll();
    app.annulla = () => pezzi().handleCancelAITagging();
    app.interruttore = (v) => pezzi().interruttoreAI(v);
    app.chiamate = () => globalThis.__GOOGLE__.chiamate;
    app.annullamentoChiesto = () => dip.aiCancelRequestedRef.current;
    // ITALIANO: Chiudi progetto e Reset fermano il lotto cosi' (closeProjectNow, handleResetProject): un
    //           progetto nuovo, la richiesta di annullamento e l'abort della richiesta in volo.
    // ENGLISH: Close project and Reset stop the batch this way (closeProjectNow, handleResetProject): a
    //          new project, the cancel request and the abort of the request in flight.
    app.chiudiProgetto = () => { dip.progettoGenRef.current++; dip.aiCancelRequestedRef.current = true; dip.aiAbortControllerRef.current?.abort(); };
    // ITALIANO: l'elenco vivo delle foto (imagesRef): una prova puo' togliere una foto a meta' richiesta.
    // ENGLISH: the live photo list (imagesRef): a test can remove a photo halfway through a request.
    app.imagesRef = dip.imagesRef;
    // ITALIANO: l'utente salva un'altra chiave (o la stessa) nella finestra della chiave.
    // ENGLISH: the user saves another key (or the same one) in the key dialog.
    app.chiave = chiave;
    app.cambiaChiave = (k) => { dip.geminiApiKeyRef.current = k; };
    return app;
};
