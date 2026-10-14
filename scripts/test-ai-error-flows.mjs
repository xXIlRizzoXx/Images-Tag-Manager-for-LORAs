/* ITALIANO: PROVA DI COSA FA L'APP CON GLI ERRORI DI GEMINI (UNA FOTO, IN BLOCCO, CHIAVE)
   Tre errori di Google venivano trattati male:
   - la quota GRATUITA DEL GIORNO finita: la taggatura in blocco aspettava 15 s + 45 s e riprovava
     ogni foto tre volte, per ore, e alla fine diceva solo "Non riuscite: 80" senza il perche';
   - una foto RIFIUTATA dal filtro di Google (o una risposta illeggibile): contata fra le
     "taggate", con il suono e il messaggio verde, anche se non aveva ricevuto niente;
   - Google SOVRACCARICO (503) o con un guasto interno (500): nessun nuovo tentativo in blocco, e
     per una foto sola il messaggio era il JSON grezzo di Google, in inglese in tutte le lingue.
   E una chiave che Google ha spento perche' trapelata veniva detta "serve la fatturazione".
   Si eseguono i testi VERI di handleAITagSingle, handleAITagAll e handleVerifyApiKey presi da
   src/App.tsx, con il servizio vero di src/services/geminiService.ts, un Google finto (nessuna
   rete, nessuna chiave) e un orologio finto (le attese di 15 e 45 s passano subito).
   Uso:  node scripts/test-ai-error-flows.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHAT THE APP DOES WITH GEMINI ERRORS (ONE PHOTO, BULK, KEY)
   Three Google errors were handled badly:
   - the FREE DAILY quota used up: bulk tagging waited 15 s + 45 s and retried every photo three
     times, for hours, and in the end only said "Failed: 80" with no reason;
   - a photo REFUSED by Google's filter (or an unreadable answer): counted as "tagged", with the
     chime and the green message, although it got nothing;
   - Google OVERLOADED (503) or with an internal fault (500): no retry in bulk, and for a single
     photo the message was Google's raw JSON, in English in every language.
   And a key Google switched off because it leaked was called "billing required".
   The REAL text of handleAITagSingle, handleAITagAll and handleVerifyApiKey taken from
   src/App.tsx is run, with the real service of src/services/geminiService.ts, a fake Google (no
   network, no key) and a fake clock (the 15 and 45 s waits pass at once).
   Usage:  node scripts/test-ai-error-flows.mjs      (exits with code 1 if anything is off) */

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
const lingue = (await carica('src/constants.ts')).translations;

// ITALIANO: Node ha File ma non FileReader: basta un finto che dia un data URL qualunque.
// ENGLISH: Node has File but no FileReader: a fake returning any data URL is enough.
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
    'aiAbortControllerRef', 'setIsGlobalAITagging', 'setGlobalAIProgress', 'useCallback', 'Date', 'setTimeout', 'console'];
const fabbricaUna = new Function(...DIPENDENZE, codiceUna + '\nreturn handleAITagSingle;');
const fabbricaTutte = new Function(...DIPENDENZE, codiceTutte + '\nreturn handleAITagAll;');
const fabbricaChiave = new Function('tempApiKey', 't', 'verifyGeminiApiKey', 'setApiKeyError', 'setIsVerifyingApiKey', 'setGeminiApiKey',
    'setIsApiKeyDialogOpen', 'soundManager', 'showNotification', 'useCallback', codiceChiave + '\nreturn handleVerifyApiKey;');

// --- gli errori come li costruisce DAVVERO la libreria di Google (ApiError)
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const apiErrore = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const quota429 = (quotaId, limite) => apiErrore(429, { code: 429, status: 'RESOURCE_EXHAUSTED',
    message: 'You exceeded your current quota, please check your plan and billing details.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: ' + limite + ', model: gemini-3.6-flash\nPlease retry in 12.5s.',
    details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId, quotaValue: String(limite) }] }] });
const ERRORI = {
    giorno: () => quota429('GenerateRequestsPerDayPerProjectPerModel-FreeTier', 20),
    minuto: () => quota429('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', 10),
    sovraccarico: () => apiErrore(503, { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded. Please try again later.' }),
    trapelata: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Your API key was reported as leaked. Please use another API key.' }),
};
const BLOCCATA = { text: undefined, promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } };
const BUONA = { text: '["cat", "sofa"]' };

// --- un'app finta intorno ai pezzi veri
const nuovaApp = (t, quante, generate) => {
    globalThis.__GOOGLE__ = { chiamate: 0, generate, list: async () => ({ async *[Symbol.asyncIterator]() { } }) };
    const foto = Array.from({ length: quante }, (_, i) => ({
        id: 'f' + i, isTrashed: false, tags: [], file: new File([new Uint8Array([1, 2, 3])], `f${i}.png`, { type: 'image/png' }),
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
        useCallback: (f) => f,
        // ITALIANO: orologio finto: ogni attesa fa avanzare il tempo e finisce subito.
        // ENGLISH: fake clock: every wait moves time forward and ends at once.
        Date: { now: () => orologio },
        setTimeout: (f, ms) => { orologio += Math.max(0, ms || 0); queueMicrotask(f); return 0; },
        console: muto,
    };
    const args = DIPENDENZE.map(n => dip[n]);
    app.una = (id) => fabbricaUna(...args)(id);
    app.tutte = () => fabbricaTutte(...args)();
    app.chiamate = () => globalThis.__GOOGLE__.chiamate;
    return app;
};
const riepilogo = (t, n) => t.aiBatchDone.replace('{ok}', String(n.ok)).replace('{err}', String(n.err)).replace('{skip}', '0').replace('{n}', String(n.tag));

for (const l of ['en', 'it']) {
    const t = lingue[l];
    console.log(`\n--- ${l}: la quota gratuita del GIORNO finita ferma la taggatura in blocco ---`);
    dice('il testo della quota del giorno esiste', 'string', typeof t.aiDailyQuota);
    {
        const app = nuovaApp(t, 5, async () => { throw ERRORI.giorno(); });
        await app.tutte();
        dice('si ferma alla prima risposta: una sola richiesta, niente attese inutili', 1, app.chiamate());
        dice('...e dice il perche\', senza un riepilogo verde sopra', [[`${t.aiError}: ${t.aiDailyQuota}`, 'error']], app.notifiche);
        dice('...senza cercare un altro modello', 0, app.riparazioni);
    }
    {
        // ITALIANO: la quota del MINUTO resta com'era: si aspetta e si riprova.
        // ENGLISH: the per-MINUTE quota stays as it was: wait and retry.
        const app = nuovaApp(t, 1, async (n) => { if (n < 3) throw ERRORI.minuto(); return BUONA; });
        await app.tutte();
        dice('quota del minuto: si riprova e la foto viene taggata', [3, [[riepilogo(t, { ok: 1, err: 0, tag: 2 }), 'success']]], [app.chiamate(), app.notifiche]);
    }
    {
        const app = nuovaApp(t, 1, async () => { throw ERRORI.giorno(); });
        await app.una('f0');
        dice('una foto, quota del giorno: lo dice, non "rallenta"', [[`${t.aiError}: ${t.aiDailyQuota}`, 'error']], app.notifiche);
    }

    console.log(`\n--- ${l}: una foto rifiutata da Google NON e "taggata" ---`);
    dice('il testo della foto rifiutata esiste', 'string', typeof t.aiResponseBlocked);
    {
        const app = nuovaApp(t, 2, async (n) => (n === 1 ? BLOCCATA : BUONA));
        await app.tutte();
        dice('in blocco: la rifiutata conta fra le non riuscite, senza riprovarla', [2, [[riepilogo(t, { ok: 1, err: 1, tag: 2 }), 'info']]], [app.chiamate(), app.notifiche]);
        dice('...e resta senza tag', [], app.foto[0].tags);
    }
    {
        const app = nuovaApp(t, 1, async () => BLOCCATA);
        const aggiunti = await app.una('f0');
        dice('una foto: messaggio d\'errore tradotto, nessun suono di successo', [0, 0, [[`${t.aiError}: ${t.aiResponseBlocked}`, 'error']]], [aggiunti, app.suoni, app.notifiche]);
    }

    console.log(`\n--- ${l}: Google sovraccarico (503): si riprova, e il messaggio e tradotto ---`);
    dice('il testo di Google sovraccarico esiste', 'string', typeof t.aiServerBusy);
    {
        const app = nuovaApp(t, 1, async (n) => { if (n === 1) throw ERRORI.sovraccarico(); return BUONA; });
        await app.tutte();
        dice('in blocco: dopo il 503 si riprova e la foto viene taggata', [2, [[riepilogo(t, { ok: 1, err: 0, tag: 2 }), 'success']]], [app.chiamate(), app.notifiche]);
    }
    {
        const app = nuovaApp(t, 1, async () => { throw ERRORI.sovraccarico(); });
        await app.una('f0');
        dice('una foto: la frase tradotta, non il JSON di Google', [[`${t.aiError}: ${t.aiServerBusy}`, 'error']], app.notifiche);
    }

    console.log(`\n--- ${l}: la finestra della chiave ---`);
    const verifica = async (list) => {
        globalThis.__GOOGLE__ = { chiamate: 0, list, generate: async () => BUONA };
        const errori = [];
        await fabbricaChiave('AIzaSy' + 'x'.repeat(33), t, S.verifyGeminiApiKey, (m) => errori.push(m), () => { }, () => { },
            () => { }, { chime() { } }, () => { }, (f) => f)();
        return errori.filter(Boolean).pop();
    };
    dice('chiave trapelata: "chiave non valida", NON "serve la fatturazione"', t.aiKeyInvalid, await verifica(async () => { throw ERRORI.trapelata(); }));
    dice('Google sovraccarico: la frase tradotta, non il JSON', t.aiServerBusy, await verifica(async () => { throw ERRORI.sovraccarico(); }));
}

process.exit(esito());
