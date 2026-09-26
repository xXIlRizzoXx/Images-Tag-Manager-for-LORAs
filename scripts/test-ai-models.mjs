/* ITALIANO: PROVA DELLA SCELTA AUTOMATICA DEL MODELLO AI E DELLA VERIFICA DELLA CHIAVE
   Gira SENZA rete e SENZA chiave: al posto di Google c'e' un finto che risponde come vuole
   ogni singola prova (elenco dei modelli, chiave sbagliata, modello chiuso, "troppe
   richieste", rete assente). Si prova il codice VERO di src/services/geminiService.ts,
   compilato al volo con esbuild; solo la libreria di Google viene sostituita.
   Uso:  node scripts/test-ai-models.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE AUTOMATIC AI MODEL SELECTION AND OF THE KEY CHECK
   Runs WITHOUT network and WITHOUT a key: Google is replaced by a fake that answers however
   each test needs (model list, bad key, retired model, "too many requests", no network). The
   REAL code of src/services/geminiService.ts is tested, compiled on the fly with esbuild; only
   Google's library is swapped out.
   Usage:  node scripts/test-ai-models.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ITALIANO: gli avvisi del servizio (es. "elenco non ottenuto" nella prova senza rete) sono
//           ATTESI: si mettono da parte, altrimenti la loro traccia sommerge l'esito.
// ENGLISH: the service's warnings (e.g. "list not obtained" in the no-network test) are
//          EXPECTED: set them aside, or their stack trace buries the verdict.
console.warn = () => {};

// --- il Google finto: ogni prova imposta globalThis.__GOOGLE__ come le serve
const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `
                export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI {
                    constructor(opts) { this.chiave = opts && opts.apiKey; }
                    get models() {
                        const g = globalThis.__GOOGLE__;
                        const chiave = this.chiave;
                        return {
                            list: async (p) => { g.chiamate.push('list'); return g.list(chiave, p); },
                            generateContent: async (p) => { g.chiamate.push('generate:' + p.model); return g.generate(chiave, p); },
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/services/geminiService.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, plugins: [finto], logLevel: 'silent',
});
const codice = uscita.outputFiles[0].text;
const S = await import('data:text/javascript;base64,' + Buffer.from(codice).toString('base64'));

// --- aiutanti
const errore = (testo) => { const e = new Error(testo); return e; };
const ERR = {
    chiave: () => errore('[400] API key not valid. Please pass a valid API key. API_KEY_INVALID'),
    chiuso: () => errore('[404] models/xxx is not found for API version v1beta. NOT_FOUND'),
    fretta: () => errore('[429] RESOURCE_EXHAUSTED: quota exceeded'),
    rete:   () => errore('fetch failed: ECONNRESET'),
};

// ITALIANO: gli errori come li costruisce DAVVERO la libreria di Google (ApiError): il messaggio
//           e' TUTTO il corpo JSON della risposta e lo stato HTTP sta a parte, come numero. Il
//           "troppe richieste" vero del piano gratuito contiene la frase "check your plan and
//           billing details": con la sola parola 'billing' diventava "serve la fatturazione".
// ENGLISH: the errors as Google's library REALLY builds them (ApiError): the message is the
//          WHOLE JSON body of the response and the HTTP status sits apart, as a number. The real
//          free-tier "too many requests" contains the phrase "check your plan and billing
//          details": on the word 'billing' alone it became "billing required".
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const apiErrore = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const fretta429 = ({ limite = 10, quotaId = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier', attesa = '23.5' } = {}) => apiErrore(429, {
    code: 429,
    message: 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n'
        + '* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: ' + limite + ', model: gemini-3.10-flash\n'
        + 'Please retry in ' + attesa + 's.',
    status: 'RESOURCE_EXHAUSTED',
    details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{
            quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
            quotaId, quotaDimensions: { location: 'global', model: 'gemini-3.10-flash' }, quotaValue: String(limite) }] },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '23s' },
    ],
});
const VERI = {
    fretta:        () => fretta429(),
    frettaGiorno:  () => fretta429({ limite: 250, quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }),
    // ITALIANO: i decimali dell'attesa sono a caso: qui contengono "401", che da solo sembrava "chiave sbagliata".
    // ENGLISH: the decimals of the wait are random: here they contain "401", which alone looked like "bad key".
    fretta401:     () => fretta429({ attesa: '41.401625' }),
    // ITALIANO: limite 0 = il modello NON ha un piano gratuito: non e' "di corsa", e' "non usabile gratis".
    // ENGLISH: limit 0 = the model has NO free tier: not "too fast", but "not usable for free".
    senzaGratuito: () => fretta429({ limite: 0 }),
    chiave: () => apiErrore(400, { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] }),
    // ITALIANO: il numero del progetto contiene "429": non deve sembrare un limite di frequenza.
    // ENGLISH: the project number contains "429": it must not look like a rate limit.
    servizioSpento: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Generative Language API has not been used in project 842942901234 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=842942901234 then retry.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', domain: 'googleapis.com', metadata: { consumer: 'projects/842942901234' } }] }),
    fatturazione: () => apiErrore(400, { code: 400, status: 'FAILED_PRECONDITION',
        message: 'Gemini API free tier is not available in your country. Please enable billing on your project in Google AI Studio.' }),
    chiuso: () => apiErrore(404, { code: 404, status: 'NOT_FOUND',
        message: 'models/gemini-9.9-flash is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.' }),
};
const M = (nome, azioni = ['generateContent']) => ({ name: 'models/' + nome, displayName: nome, supportedActions: azioni });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });

const googleCon = ({ modelli = [], list, generate } = {}) => {
    globalThis.__GOOGLE__ = {
        chiamate: [],
        list: list || (async () => pagine(modelli)),
        generate: generate || (async () => ({ text: '["ok"]' })),
    };
    return globalThis.__GOOGLE__;
};

let guai = 0, fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok ? '' : `\n        atteso: ${JSON.stringify(atteso)}\n        avuto:  ${JSON.stringify(avuto)}`));
};
const CHIAVE = 'AIza' + 'x'.repeat(35);

// =============================================================================
console.log('\n--- la versione si legge solo subito dopo "gemini-" (difetto F) ---');
dice('gemini-3.6-flash -> [3,6]', [3, 6], S.versioneDi('gemini-3.6-flash'));
dice('gemini-3.10-flash -> [3,10]', [3, 10], S.versioneDi('gemini-3.10-flash'));
dice('la taglia "-8b" NON e una versione', [3, 6], S.versioneDi('gemini-3.6-flash-8b'));
dice('l\'istantanea "-001" NON e una versione', [2, 0], S.versioneDi('gemini-2.0-flash-001'));
dice('senza numero dopo gemini- -> []', [], S.versioneDi('gemini-flash-latest'));
dice('3.10 viene DOPO 3.6 (alfabeticamente sarebbe prima)', true, S.confrontaVersioni([3, 10], [3, 6]) > 0);

console.log('\n--- chi sopravvive al filtro, e in che ordine ---');
const grezzi = [
    M('gemini-3.6-flash'), M('gemini-3.6-flash-8b'), M('gemini-3.10-flash'), M('gemini-3.10-flash-lite'),
    M('gemini-4.0-flash-preview-01-20'), M('gemini-3.9-flash-thinking-exp'), M('gemini-3.6-pro'),
    M('gemini-2.0-flash-001'), M('gemini-3.6-flash-image'), M('gemini-live-2.5-flash'),
    M('gemini-embedding-001', ['embedContent']), M('imagen-4.0-generate-001'), M('gemini-3.6-flash-tts'),
    M('gemini-2.0-flash', []), M('gemini-3.6-flash'),
];
const c = S.scegliCandidati(grezzi);
dice('ordine', ['gemini-3.10-flash', 'gemini-3.10-flash-lite', 'gemini-3.6-flash', 'gemini-3.6-flash-8b', 'gemini-2.0-flash', 'gemini-2.0-flash-001'], c.map(x => x.id));
dice('il flash pieno passa davanti al -8b della stessa versione', true, c.findIndex(x => x.id === 'gemini-3.6-flash') < c.findIndex(x => x.id === 'gemini-3.6-flash-8b'));
dice('niente anteprime, sperimentali, pro, immagini, voce, live, embedding', false, c.some(x => /preview|exp|pro|image|tts|live|embedding/.test(x.id)));
dice('nessun doppione', c.length, new Set(c.map(x => x.id)).size);
dice('elenco nullo o spazzatura non esplode', [], S.scegliCandidati([null, {}, { name: 42 }, 'x']));

// =============================================================================
console.log('\n--- verifica della chiave senza legarsi a un modello (difetto C) ---');
let g = googleCon({ modelli: [M('gemini-3.10-flash')], generate: async () => { throw ERR.chiuso(); } });
let v = await S.verifyGeminiApiKey(CHIAVE);
dice('chiave buona accettata ANCHE se il modello di riserva e chiuso', true, v.ok);
dice('per verificarla si chiede solo l\'elenco, nessuna generazione', ['list'], g.chiamate);
googleCon({ list: async () => { throw ERR.chiave(); } });
v = await S.verifyGeminiApiKey(CHIAVE);
dice('chiave sbagliata rifiutata come chiave sbagliata', ['invalid_key', false], [v.errorKind, v.ok]);
// ITALIANO: un Google NUOVO, con l'elenco delle chiamate vuoto: il finto di prima ha gia' una
//           'list' registrata, e se la chiave corta arrivasse a Google risponderebbe comunque
//           "chiave sbagliata", cioe' ok:false. Si guarda quindi l'elenco delle chiamate.
// ENGLISH: a FRESH Google, with an empty call list: the previous fake already holds a 'list',
//          and if the short key reached Google it would still answer "bad key", i.e. ok:false.
//          So the call list is what gets checked.
g = googleCon({ list: async () => { throw ERR.chiave(); } });
v = await S.verifyGeminiApiKey('corta');
dice('chiave troppo corta rifiutata senza chiamare Google', [false, 'invalid_key', []], [v.ok, v.errorKind, g.chiamate]);

// =============================================================================
console.log('\n--- il giro automatico: ogni esito con il suo motivo (difetti E, H) ---');
g = googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.6-flash')] });
let e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.10-flash');
dice('gia sul piu recente: invariato', 'invariato', e.esito);
dice('...e senza spendere nemmeno una prova', ['list'], g.chiamate);

g = googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.6-flash')] });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('ne esiste uno piu recente e passa la prova: aggiornato', ['aggiornato', 'gemini-3.10-flash', true], [e.esito, e.modello, e.cambiato]);
dice('...ed e stato PROVATO prima di adottarlo', true, g.chiamate.includes('generate:gemini-3.10-flash'));

g = googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.6-flash')],
    generate: async (_k, p) => { if (p.model === 'gemini-3.10-flash') throw ERR.chiuso(); return { text: '["ok"]' }; } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-2.0-flash');
dice('il primo non passa la prova: si prende il secondo', ['aggiornato', 'gemini-3.6-flash'], [e.esito, e.modello]);

g = googleCon({ modelli: [M('gemini-3.10-flash')] });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash', true);
dice('il modello in uso e chiuso: riparato', ['riparato', 'gemini-3.10-flash'], [e.esito, e.modello]);

googleCon({ list: async () => { throw ERR.rete(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('niente rete: nonRaggiungibile, e il modello NON cambia', ['nonRaggiungibile', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);

googleCon({ modelli: [] });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('elenco vuoto: nonRaggiungibile', 'nonRaggiungibile', e.esito);

googleCon({ modelli: [M('gemini-3.10-flash')], generate: async () => { throw ERR.fretta(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('"troppe richieste" durante la prova: occupato, NON scartato', ['occupato', 'gemini-3.6-flash'], [e.esito, e.modello]);

googleCon({ modelli: [M('gemini-3.10-flash')], generate: async () => { throw ERR.rete(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('rete caduta durante la prova: nonRaggiungibile', 'nonRaggiungibile', e.esito);

googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.9-flash')], generate: async () => { throw ERR.chiuso(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('Google risponde ma nessuno passa la prova: nessunoValido', ['nessunoValido', 'gemini-3.6-flash'], [e.esito, e.modello]);
dice('...e l\'elenco trovato viene comunque restituito', 2, e.disponibili.length);

g = googleCon({ modelli: [M('gemini-3.10-flash')] });
e = await S.aggiornaModelloAutomatico('', 'gemini-3.6-flash');
dice('senza chiave non si chiama nemmeno Google', [[], 'nonRaggiungibile'], [g.chiamate, e.esito]);

// =============================================================================
console.log('\n--- gli errori VERI di Google, costruiti come li costruisce la sua libreria ---');
dice('"troppe richieste" vero del piano gratuito: limite di frequenza, NON fatturazione', 'rate_limit', S.classifyGeminiError(VERI.fretta()).kind);
dice('quota del giorno finita: limite di frequenza', 'rate_limit', S.classifyGeminiError(VERI.frettaGiorno()).kind);
dice('"401" nei decimali dell\'attesa non lo trasforma in chiave sbagliata', 'rate_limit', S.classifyGeminiError(VERI.fretta401()).kind);
dice('limite 0 = senza piano gratuito: non usabile, NE occupato NE fatturazione', 'model_unavailable', S.classifyGeminiError(VERI.senzaGratuito()).kind);
dice('il vecchio testo "[429] RESOURCE_EXHAUSTED" resta un limite di frequenza', 'rate_limit', S.classifyGeminiError(ERR.fretta()).kind);
dice('chiave sbagliata vera: chiave sbagliata', 'invalid_key', S.classifyGeminiError(VERI.chiave()).kind);
dice('servizio spento (progetto con "429" nel numero): fatturazione', 'billing_required', S.classifyGeminiError(VERI.servizioSpento()).kind);
dice('piano gratuito non disponibile nel paese: fatturazione', 'billing_required', S.classifyGeminiError(VERI.fatturazione()).kind);
dice('modello chiuso vero: non disponibile', 'model_unavailable', S.classifyGeminiError(VERI.chiuso()).kind);

googleCon({ generate: async () => { throw VERI.fretta(); } });
dice('la prova di un modello sotto "troppe richieste": occupato', 'occupato', await S.provaModello(CHIAVE, 'gemini-3.10-flash'));
googleCon({ generate: async () => { throw VERI.senzaGratuito(); } });
dice('la prova di un modello senza piano gratuito: no', 'no', await S.provaModello(CHIAVE, 'gemini-3.10-flash'));

googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.10-flash-lite'), M('gemini-3.6-flash')],
    generate: async (_k, p) => { if (p.model === 'gemini-3.10-flash') throw VERI.fretta(); return { text: '["ok"]' }; } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('il piu recente e di corsa: si resta dove si e, NIENTE discesa al -lite', ['occupato', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);

googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.10-flash-lite'), M('gemini-3.6-flash')], generate: async () => { throw VERI.fretta(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('tutte le prove di corsa: occupato, NON nessunoValido', ['occupato', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);

googleCon({ modelli: [M('gemini-3.10-flash'), M('gemini-3.9-flash'), M('gemini-3.6-flash')],
    generate: async (_k, p) => { if (p.model === 'gemini-3.10-flash') throw VERI.senzaGratuito(); return { text: '["ok"]' }; } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('il piu recente non e gratuito: si passa al successivo che lo e', ['aggiornato', 'gemini-3.9-flash', true], [e.esito, e.modello, e.cambiato]);

googleCon({ list: async () => { throw VERI.fretta(); } });
v = await S.verifyGeminiApiKey(CHIAVE);
dice('chiave buona ma di corsa: limite di frequenza, NON fatturazione', [false, 'rate_limit'], [v.ok, v.errorKind]);

// =============================================================================
console.log('\n--- l\'elenco dei modelli non puo restare appeso per sempre ---');
// ITALIANO: su una connessione che si apre e non risponde mai, senza un segnale con scadenza la
//           richiesta non finisce piu' e il pulsante "Controlla ora" resta bloccato fino al riavvio.
// ENGLISH: on a connection that opens and never answers, without a signal with a deadline the
//          request never ends and the "Check now" button stays stuck until a restart.
let segnale;
googleCon({ list: async (_k, p) => { segnale = p && p.config && p.config.abortSignal; return pagine([M('gemini-3.10-flash')]); } });
await S.elencaModelliRemoti(CHIAVE);
dice('l\'elenco parte con un segnale di scadenza', true, segnale instanceof AbortSignal && !segnale.aborted);

// =============================================================================
console.log('\n--- il modello salvato non viene piu buttato via ---');
dice('un modello scoperto da Google si tiene', 'gemini-9.9-flash', S.normalizeModelId('gemini-9.9-flash'));
dice('storto -> riserva', S.DEFAULT_GEMINI_MODEL, S.normalizeModelId('../etc/passwd'));
dice('un flash sconosciuto e gratuito-con-limiti, non a pagamento', 'limited', S.getModelTier('gemini-9.9-flash'));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
