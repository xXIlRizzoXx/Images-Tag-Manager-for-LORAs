/* ITALIANO: PROVA DEL "PROGETTO RIFIUTATO" (API GEMINI SPENTA O PROGETTO SOSPESO)
   Una chiave creata in Google Cloud Console su un progetto dove l'API Gemini (Generative
   Language API) non e' attiva riceve 403 PERMISSION_DENIED con motivo SERVICE_DISABLED; un
   progetto sospeso riceve 403 CONSUMER_SUSPENDED. La finestra della chiave e la taggatura (una
   foto e in blocco) dicevano "Questo modello richiede billing abilitato", mentre "Controlla
   ora" con la stessa chiave diceva, giustamente, che Google rifiuta il progetto. Nessun modello
   c'entra (e' l'elenco dei modelli) e il rimedio e' attivare l'API, non pagare.
   Il tipo dell'errore resta 'billing_required' (il controllo dei modelli lo traduce gia' in
   'progettoRifiutato'); in piu' c'e' `progetto: true`, e le tre schermate mostrano la frase del
   progetto. I veri casi di fatturazione (paese senza piano gratuito, BILLING_DISABLED, "does
   not have access") restano "serve la fatturazione".
   Si eseguono i testi VERI di handleAITagSingle, handleAITagAll e handleVerifyApiKey presi da
   src/App.tsx, con il servizio vero e un Google finto (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-ai-project-refused.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "PROJECT REFUSED" (GEMINI API TURNED OFF OR PROJECT SUSPENDED)
   A key created in Google Cloud Console on a project where the Gemini API (Generative Language
   API) is not enabled gets 403 PERMISSION_DENIED with reason SERVICE_DISABLED; a suspended
   project gets 403 CONSUMER_SUSPENDED. The key dialog and tagging (single and bulk) said "This
   model requires billing enabled", while "Check now" with the same key rightly said Google
   refuses the project. No model is involved (it is the model list) and the remedy is enabling
   the API, not paying.
   The error kind stays 'billing_required' (the model check already turns it into
   'progettoRifiutato'); on top of it there is `progetto: true`, and the three screens show the
   project sentence. Real billing cases (country without a free tier, BILLING_DISABLED, "does
   not have access") stay "billing required".
   The REAL text of handleAITagSingle, handleAITagAll and handleVerifyApiKey taken from
   src/App.tsx is run, with the real service and a fake Google (no network, no key).
   Usage:  node scripts/test-ai-project-refused.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const muto = { log() { }, warn() { }, error() { } };
console.warn = () => { };

// ITALIANO: il Google finto: ogni prova decide cosa rispondono generateContent e list.
// ENGLISH: the fake Google: every test decides what generateContent and list answer.
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
                            list: async () => g.list(),
                            generateContent: async () => { g.chiamate++; return g.generate(g.chiamate); },
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
const C = await carica('src/utils/tagCase.ts');
const lingue = (await carica('src/constants.ts')).translations;

globalThis.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/png;base64,AAAA';
        queueMicrotask(() => this.onloadend && this.onloadend());
    }
};

// --- i pezzi veri di src/App.tsx
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const prendi = async (inizioTesto, fineRegex, nome) => {
    const inizio = sorgente.indexOf(inizioTesto);
    fineRegex.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : fineRegex.exec(sorgente);
    if (!fine) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const codiceUna = await prendi('    const handleAITagSingle = useCallback(',
    /\r?\n    \}, \[aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, images, t, updateImageTags\]\);\r?\n/g, 'handleAITagSingle');
const codiceTutte = await prendi('    const handleAITagAll = useCallback(',
    /\r?\n    \}, \[aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, aiRpm, aiSkipTagged, images, isGlobalAITagging, t, updateImageTags\]\);\r?\n/g, 'handleAITagAll');
const codiceChiave = await prendi('    const handleVerifyApiKey = useCallback(', /\r?\n    \}, \[tempApiKey, t\]\);\r?\n/g, 'handleVerifyApiKey');

const DIPENDENZE = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'aiRpm', 'aiSkipTagged', 'images',
    'imagesRef', 'isGlobalAITagging', 't', 'updateImageTags', 'getGeminiTags', 'classifyGeminiError', 'showNotification',
    'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'setIsAIBusy', 'aiCancelRequestedRef', 'setAiCancelRequested',
    'aiAbortControllerRef', 'setIsGlobalAITagging', 'setGlobalAIProgress', 'countNewTagsIgnoringCase', 'useCallback', 'Date', 'setTimeout', 'console', 'progettoGenRef',
    'geminiApiKeyRef', 'aiEnabledRef', 'aiSingolaControllerRef'];
const fabbricaUna = new Function(...DIPENDENZE, codiceUna + '\nreturn handleAITagSingle;');
const fabbricaTutte = new Function(...DIPENDENZE, codiceTutte + '\nreturn handleAITagAll;');
const fabbricaChiave = new Function('tempApiKey', 't', 'verifyGeminiApiKey', 'setApiKeyError', 'setIsVerifyingApiKey', 'setGeminiApiKey',
    'setIsApiKeyDialogOpen', 'soundManager', 'showNotification', 'useCallback', 'geminiApiKeyRef', 'setSecret', codiceChiave + '\nreturn handleVerifyApiKey;');

// --- gli errori come li costruisce DAVVERO la libreria di Google (ApiError)
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const apiErrore = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const PROGETTO = {
    // ITALIANO: API Gemini mai attivata sul progetto (chiave fatta in Google Cloud Console).
    // ENGLISH: Gemini API never enabled on the project (key made in Google Cloud Console).
    apiSpenta: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Generative Language API has not been used in project 842942901234 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=842942901234 then retry.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', domain: 'googleapis.com', metadata: { consumer: 'projects/842942901234', service: 'generativelanguage.googleapis.com' } }] }),
    sospeso: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: "Permission denied: Consumer 'projects/840412345678' has been suspended.",
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'CONSUMER_SUSPENDED', domain: 'googleapis.com' }] }),
    permessoNegato: () => apiErrore(403, { code: 403, message: 'The caller does not have permission' }),
    testoSemplice: () => new Error('[403] Forbidden'),
};
const FATTURAZIONE = {
    paese: () => apiErrore(400, { code: 400, status: 'FAILED_PRECONDITION',
        message: 'User location is not supported for the API use without a billing account linked.' }),
    gratuitoNonNelPaese: () => apiErrore(400, { code: 400, status: 'FAILED_PRECONDITION',
        message: 'Gemini API free tier is not available in your country. Please enable billing on your project in Google AI Studio.' }),
    fatturazioneSpenta: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'This API method requires billing to be enabled. Please enable billing on project #842942901234 by visiting https://console.developers.google.com/billing/enable?project=842942901234 then retry.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'BILLING_DISABLED', domain: 'googleapis.com', metadata: { consumer: 'projects/842942901234', service: 'generativelanguage.googleapis.com' } }] }),
    senzaAccesso: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Your project does not have access to model gemini-9.9-pro. Please enable billing.' }),
    senzaAccessoNudo: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Your project does not have access to this model.' }),
};
const PNG_MINIMO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 0xAE, 0x42, 0x60, 0x82]);

const nuovaApp = (t, quante, generate) => {
    globalThis.__GOOGLE__ = { chiamate: 0, generate, list: async () => ({ async *[Symbol.asyncIterator]() { } }) };
    const foto = Array.from({ length: quante }, (_, i) => ({
        id: 'f' + i, isTrashed: false, tags: [], file: new File([PNG_MINIMO], `f${i}.png`, { type: 'image/png' }),
    }));
    const app = { notifiche: [], suoni: 0, riparazioni: 0, finestraChiave: false, foto };
    let orologio = 1_000_000;
    const dip = {
        aiEnabled: true, geminiApiKey: 'AIza' + 'x'.repeat(35), aiModel: 'gemini-3.6-flash', aiMaxTags: 30, aiCustomPrompt: '',
        aiRpm: 14, aiSkipTagged: false, images: foto, imagesRef: { current: foto }, isGlobalAITagging: false, t,
        updateImageTags: (id, tags) => { const f = foto.find(x => x.id === id); if (f) f.tags = tags; },
        getGeminiTags: S.getGeminiTags, classifyGeminiError: S.classifyGeminiError,
        showNotification: (m, tipo) => app.notifiche.push([m, tipo]),
        soundManager: { chime() { app.suoni++; } },
        setRiparaModello: () => { app.riparazioni++; },
        setIsApiKeyDialogOpen: (v) => { app.finestraChiave = v; },
        setIsAIBusy: () => { }, aiCancelRequestedRef: { current: false }, setAiCancelRequested: () => { },
        aiAbortControllerRef: { current: null }, setIsGlobalAITagging: () => { }, setGlobalAIProgress: () => { },
        countNewTagsIgnoringCase: C.countNewTagsIgnoringCase,
        useCallback: (f) => f,
        Date: { now: () => orologio },
        setTimeout: (f, ms) => { orologio += Math.max(0, ms || 0); queueMicrotask(f); return 0; },
        console: muto,
        progettoGenRef: { current: 0 },
        geminiApiKeyRef: { current: 'AIza' + 'x'.repeat(35) },
        aiEnabledRef: { current: true }, aiSingolaControllerRef: { current: null },
    };
    const args = DIPENDENZE.map(n => dip[n]);
    app.una = (id) => fabbricaUna(...args)(id);
    app.tutte = () => fabbricaTutte(...args)();
    app.chiamate = () => globalThis.__GOOGLE__.chiamate;
    return app;
};

// =============================================================================
console.log('\n--- il servizio: il tipo resta billing_required, ma si sa che e\' il PROGETTO ---');
for (const [nome, crea] of Object.entries(PROGETTO)) {
    const c = S.classifyGeminiError(crea());
    dice(`${nome}: billing_required con progetto=true`, ['billing_required', true], [c.kind, c.progetto === true]);
}
for (const [nome, crea] of Object.entries(FATTURAZIONE)) {
    const c = S.classifyGeminiError(crea());
    dice(`${nome}: billing_required, NON progetto (e\' davvero la fatturazione)`, ['billing_required', false], [c.kind, c.progetto === true]);
}
// ITALIANO: i casi vicini non cambiano tipo e non prendono la bandierina.
// ENGLISH: the neighbouring cases do not change kind and do not get the flag.
{
    const vicini = {
        chiaveTrapelata: [apiErrore(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Your API key was reported as leaked. Please use another API key.' }), 'invalid_key'],
        chiaveBloccata: [apiErrore(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Requests to this API are blocked.',
            details: [{ reason: 'API_KEY_SERVICE_BLOCKED' }] }), 'invalid_key'],
        modelloChiuso: [apiErrore(404, { code: 404, status: 'NOT_FOUND', message: 'models/gemini-9.9-flash is not found for API version v1beta.' }), 'model_unavailable'],
        limite: [apiErrore(429, { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota, please check your plan and billing details. limit: 10' }), 'rate_limit'],
        rete: [new Error('fetch failed: ECONNRESET'), 'unknown'],
    };
    for (const [nome, [err, tipo]] of Object.entries(vicini)) {
        const c = S.classifyGeminiError(err);
        dice(`${nome}: resta ${tipo}, senza progetto`, [tipo, false], [c.kind, c.progetto === true]);
    }
}

console.log('\n--- la verifica della chiave porta la bandierina del progetto ---');
for (const [nome, crea, atteso] of [['apiSpenta', PROGETTO.apiSpenta, true], ['sospeso', PROGETTO.sospeso, true], ['fatturazioneSpenta', FATTURAZIONE.fatturazioneSpenta, false]]) {
    globalThis.__GOOGLE__ = { chiamate: 0, list: async () => { throw crea(); }, generate: async () => ({}) };
    const v = await S.verifyGeminiApiKey('AIzaSy' + 'x'.repeat(33));
    dice(`${nome}: ok=false, billing_required, progetto=${atteso}`, [false, 'billing_required', atteso], [v.ok, v.errorKind, v.progetto === true]);
}

console.log('\n--- il controllo dei modelli dice ancora "progetto rifiutato" (non cambia) ---');
for (const [nome, crea] of [['apiSpenta', PROGETTO.apiSpenta], ['sospeso', PROGETTO.sospeso], ['fatturazioneSpenta', FATTURAZIONE.fatturazioneSpenta]]) {
    globalThis.__GOOGLE__ = { chiamate: 0, list: async () => { throw crea(); }, generate: async () => ({}) };
    const e = await S.aggiornaModelloAutomatico('AIzaSy' + 'x'.repeat(33), 'gemini-3.6-flash');
    dice(`${nome}: progettoRifiutato`, 'progettoRifiutato', e.esito);
}

console.log('\n--- la frase nuova esiste in tutte e nove le lingue ed e\' diversa da quella della fatturazione ---');
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    const t = lingue[l];
    dice(`${l}: aiProjectRefused esiste, non vuota, diversa da aiBillingRequired e da aiModelCheckProjectRefused`, [true, true, true],
        [typeof t.aiProjectRefused === 'string' && t.aiProjectRefused.trim().length > 20, t.aiProjectRefused !== t.aiBillingRequired, t.aiProjectRefused !== t.aiModelCheckProjectRefused]);
}

for (const l of ['en', 'it']) {
    const t = lingue[l];
    const verifica = async (list) => {
        globalThis.__GOOGLE__ = { chiamate: 0, list, generate: async () => ({ text: '["ok"]' }) };
        const errori = [];
        await fabbricaChiave('AIzaSy' + 'x'.repeat(33), t, S.verifyGeminiApiKey, (m) => errori.push(m), () => { }, () => { },
            () => { }, { chime() { } }, () => { }, (f) => f, { current: '' }, async () => true)();
        return errori.filter(Boolean).pop();
    };
    console.log(`\n--- ${l}: la finestra della chiave ---`);
    dice('API Gemini spenta sul progetto: la frase del progetto, NON "serve la fatturazione"', t.aiProjectRefused, await verifica(async () => { throw PROGETTO.apiSpenta(); }));
    dice('progetto sospeso: la frase del progetto', t.aiProjectRefused, await verifica(async () => { throw PROGETTO.sospeso(); }));
    dice('fatturazione spenta: resta "serve la fatturazione"', t.aiBillingRequired, await verifica(async () => { throw FATTURAZIONE.fatturazioneSpenta(); }));
    dice('paese senza piano gratuito: resta "serve la fatturazione"', t.aiBillingRequired, await verifica(async () => { throw FATTURAZIONE.paese(); }));

    console.log(`\n--- ${l}: una foto ---`);
    {
        const app = nuovaApp(t, 1, async () => { throw PROGETTO.apiSpenta(); });
        await app.una('f0');
        dice('API spenta: la frase del progetto, nessuna finestra della chiave, nessuna riparazione', [[[`${t.aiError}: ${t.aiProjectRefused}`, 'error']], false, 0],
            [app.notifiche, app.finestraChiave, app.riparazioni]);
    }
    {
        const app = nuovaApp(t, 1, async () => { throw FATTURAZIONE.fatturazioneSpenta(); });
        await app.una('f0');
        dice('fatturazione spenta: resta "serve la fatturazione"', [[`${t.aiError}: ${t.aiBillingRequired}`, 'error']], app.notifiche);
    }

    console.log(`\n--- ${l}: in blocco ---`);
    {
        const app = nuovaApp(t, 3, async () => { throw PROGETTO.sospeso(); });
        await app.tutte();
        dice('progetto sospeso: si ferma alla prima foto con la frase del progetto, senza riparazione', [1, [[`${t.aiError}: ${t.aiProjectRefused}`, 'error']], 0],
            [app.chiamate(), app.notifiche, app.riparazioni]);
    }
    {
        const app = nuovaApp(t, 3, async () => { throw FATTURAZIONE.senzaAccesso(); });
        await app.tutte();
        dice('modello senza accesso (fatturazione): resta "serve la fatturazione" e si ferma', [1, [[`${t.aiError}: ${t.aiBillingRequired}`, 'error']]],
            [app.chiamate(), app.notifiche]);
    }
}

process.exit(esito());
