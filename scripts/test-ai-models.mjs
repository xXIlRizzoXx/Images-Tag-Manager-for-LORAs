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
    // ITALIANO: fatturazione spenta (403 BILLING_DISABLED) con "429" nel numero del progetto: non
    //           e' un limite di frequenza. Con uno stato numerico le cifre del testo non contano.
    // ENGLISH: billing disabled (403 BILLING_DISABLED) with "429" in the project number: it is not
    //          a rate limit. With a numeric status the digits in the text do not count.
    fatturazioneSpenta: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'This API method requires billing to be enabled. Please enable billing on project #842942901234 by visiting https://console.developers.google.com/billing/enable?project=842942901234 then retry.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'BILLING_DISABLED', domain: 'googleapis.com', metadata: { consumer: 'projects/842942901234', service: 'generativelanguage.googleapis.com' } }] }),
    // ITALIANO: il servizio spento con "401" nel numero del progetto: la chiave e' buona.
    // ENGLISH: the service disabled with "401" in the project number: the key is fine.
    servizioSpento401: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Generative Language API has not been used in project 840112345678 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=840112345678 then retry.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', domain: 'googleapis.com', metadata: { consumer: 'projects/840112345678' } }] }),
    // ITALIANO: una chiave che Google ha spento perche' finita in pubblico, o bloccata per questa API:
    //           va cambiata la chiave, la fatturazione non c'entra.
    // ENGLISH: a key Google switched off because it leaked, or blocked for this API: the key must
    //          be replaced, billing has nothing to do with it.
    chiaveTrapelata: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Your API key was reported as leaked. Please use another API key.' }),
    chiaveBloccata: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: 'Requests to this API generativelanguage.googleapis.com method google.ai.generativelanguage.v1beta.GenerativeService.GenerateContent are blocked.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_SERVICE_BLOCKED', domain: 'googleapis.com' }] }),
    // ITALIANO: Google sovraccarico (503) o con un guasto interno (500): passa da solo, si riprova.
    //           Il secondo contiene "401" fra le cifre: non e' una chiave sbagliata.
    // ENGLISH: Google overloaded (503) or with an internal fault (500): it passes, retry. The
    //          second one holds "401" among its digits: it is not a bad key.
    sovraccarico: () => apiErrore(503, { code: 503, status: 'UNAVAILABLE',
        message: 'The model is overloaded. Please try again later.' }),
    interno: () => apiErrore(500, { code: 500, status: 'INTERNAL',
        message: 'An internal error has occurred (request 7740193). Please retry or report in https://developers.generativeai.google/guide/troubleshooting' }),
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

// ITALIANO: una chiave scaduta, revocata o sbagliata NON e' "Google non raggiungibile": il
//           motivo e' la chiave, e l'utente deve saperlo invece di controllare la rete.
// ENGLISH: an expired, revoked or wrong key is NOT "Google unreachable": the reason is the
//          key, and the user must know it instead of checking the network.
googleCon({ list: async () => { throw VERI.chiave(); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
dice('chiave sbagliata all\'elenco: chiaveNonValida, e il modello NON cambia', ['chiaveNonValida', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);
googleCon({ list: async () => { throw apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key expired. Please renew the API key.',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] }); } });
e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash', true);
dice('chiave scaduta durante una riparazione: chiaveNonValida', 'chiaveNonValida', e.esito);

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
dice('fatturazione spenta (progetto con "429" nel numero): fatturazione', 'billing_required', S.classifyGeminiError(VERI.fatturazioneSpenta()).kind);
dice('servizio spento (progetto con "401" nel numero): fatturazione, NON chiave sbagliata', 'billing_required', S.classifyGeminiError(VERI.servizioSpento401()).kind);
dice('chiave segnalata come trapelata: chiave sbagliata, NON fatturazione', 'invalid_key', S.classifyGeminiError(VERI.chiaveTrapelata()).kind);
dice('chiave bloccata per questa API: chiave sbagliata, NON fatturazione', 'invalid_key', S.classifyGeminiError(VERI.chiaveBloccata()).kind);
dice('il vecchio testo "[401] Unauthorized" senza stato resta chiave sbagliata', 'invalid_key', S.classifyGeminiError(errore('[401] Unauthorized')).kind);

console.log('\n--- le cifre "404" e "403" nel testo non valgono come stato quando lo stato c\'e\' ---');
// ITALIANO: un progetto sospeso (403) con "404" nel numero del progetto: e' un problema della
//           chiave o del progetto, NON un modello che non esiste (prima partiva la riparazione).
// ENGLISH: a suspended project (403) with "404" in the project number: it is a key or project
//          problem, NOT a model that does not exist (the repair used to start).
dice('403 progetto sospeso (progetto con "404" nel numero): fatturazione, NON modello non disponibile', 'billing_required',
    S.classifyGeminiError(apiErrore(403, { code: 403, status: 'PERMISSION_DENIED',
        message: "Permission denied: Consumer 'projects/840412345678' has been suspended." })).kind);
dice('400 argomento non valido (progetto con "404" nel numero): sconosciuto, NON modello non disponibile', 'unknown',
    S.classifyGeminiError(apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT',
        message: 'Request contains an invalid argument (project 840412345678).' })).kind);
dice('400 argomento non valido (progetto con "403" nel numero): sconosciuto, NON fatturazione', 'unknown',
    S.classifyGeminiError(apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT',
        message: 'Request contains an invalid argument (project 840312345678).' })).kind);
dice('404 vero senza la parola NOT_FOUND: resta non disponibile', 'model_unavailable',
    S.classifyGeminiError(apiErrore(404, { code: 404, message: 'Requested entity was not found.' })).kind);
dice('403 vero senza la parola PERMISSION_DENIED: resta fatturazione', 'billing_required',
    S.classifyGeminiError(apiErrore(403, { code: 403, message: 'The caller does not have permission' })).kind);
dice('il vecchio testo "[404] ..." senza stato resta non disponibile', 'model_unavailable', S.classifyGeminiError(errore('[404] models/x was removed')).kind);
dice('il vecchio testo "[403] ..." senza stato resta fatturazione', 'billing_required', S.classifyGeminiError(errore('[403] Forbidden')).kind);

console.log('\n--- la quota del GIORNO finita si riconosce da quella del minuto ---');
{
    const giorno = S.classifyGeminiError(VERI.frettaGiorno());
    dice('quota del giorno: limite di frequenza, e si sa che e quella del giorno', ['rate_limit', true], [giorno.kind, giorno.quotaGiorno === true]);
    const minuto = S.classifyGeminiError(VERI.fretta());
    dice('quota del minuto: limite di frequenza, NON del giorno', ['rate_limit', false], [minuto.kind, minuto.quotaGiorno === true]);
    dice('limite 0 del giorno resta "non usabile gratis"', 'model_unavailable',
        S.classifyGeminiError(fretta429({ limite: 0, quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' })).kind);
}
googleCon({ generate: async () => { throw VERI.frettaGiorno(); } });
dice('la prova di un modello con la quota del giorno finita: occupato, NON scartato', 'occupato', await S.provaModello(CHIAVE, 'gemini-3.10-flash'));

console.log('\n--- Google sovraccarico o con un guasto interno: passeggero, non sconosciuto ---');
dice('503 "model overloaded": occupato', 'busy', S.classifyGeminiError(VERI.sovraccarico()).kind);
dice('500 INTERNAL (con "401" fra le cifre): occupato', 'busy', S.classifyGeminiError(VERI.interno()).kind);
dice('la rete assente resta sconosciuta', 'unknown', S.classifyGeminiError(ERR.rete()).kind);
{
    const modelli = [M('gemini-3.8-flash'), M('gemini-3.7-flash'), M('gemini-3.6-flash')];
    const sovraccarico38 = async (_k, p) => { if (p.model === 'gemini-3.8-flash') throw VERI.sovraccarico(); return { text: '["ok"]' }; };
    googleCon({ modelli, generate: sovraccarico38 });
    e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash', true);
    dice('riparazione: il piu recente e sovraccarico, si passa al successivo che funziona', ['riparato', 'gemini-3.7-flash', true], [e.esito, e.modello, e.cambiato]);
    googleCon({ modelli, generate: sovraccarico38 });
    e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash');
    dice('controllo normale: il piu recente e sovraccarico, si resta dove si e (niente discesa)', ['occupato', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);
    googleCon({ modelli, generate: async () => { throw VERI.sovraccarico(); } });
    e = await S.aggiornaModelloAutomatico(CHIAVE, 'gemini-3.6-flash', true);
    dice('riparazione con tutti sovraccarichi: occupato, NON "Google non raggiungibile"', ['occupato', 'gemini-3.6-flash', false], [e.esito, e.modello, e.cambiato]);
}

console.log('\n--- nella tendina solo modelli sensati, e il "gratis" solo dove lo e davvero ---');
{
    // ITALIANO: l'elenco pubblico di Google del 26 settembre 2026, tutto dichiarato "generateContent".
    // ENGLISH: Google's public list of 26 September 2026, all declared "generateContent".
    const elenco = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash',
        'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-live',
        'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image',
        'gemini-omni-1.1-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'].map(n => M(n));
    const scelti = S.scegliCandidati(elenco).map(x => x.id);
    dice('il modello video senza numero di versione (omni) NON e un candidato', false, scelti.some(id => id.includes('omni')));
    dice('l\'ordine dei gratuiti resta 3.8, 3.7, 3.6, 3.5', ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'], scelti.slice(0, 4));
    dice('un flash-lite NON si dichiara "gratuito con limiti" (3.5-lite non ha il piano gratuito)', false, S.getModelTier('gemini-3.5-flash-lite') === 'limited');
    dice('...ma nemmeno "a pagamento" (2.5-lite invece ce l\'ha)', false, S.getModelTier('gemini-2.5-flash-lite') === 'paid');
    dice('il modello video NON si dichiara "gratuito con limiti"', false, S.getModelTier('gemini-omni-1.1-flash') === 'limited');
    dice('il flash pieno resta "gratuito con limiti"', 'limited', S.getModelTier('gemini-3.8-flash'));
}

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
// ITALIANO: un segnale qualunque non basta: deve SCADERE. Qui Google apre la connessione e non
//           risponde mai (rifiuta solo quando il segnale scatta) e la scadenza vera viene
//           accorciata a 20 ms: l'elenco e la verifica della chiave devono finire da soli, non
//           restare appesi. Senza la scadenza la gara la vince "appeso".
// ENGLISH: any signal is not enough: it must EXPIRE. Here Google opens the connection and never
//          answers (it rejects only when the signal fires) and the real deadline is shortened to
//          20 ms: the listing and the key check must end on their own, not hang. Without the
//          deadline the race is won by "appeso" (hung).
{
    const timeoutVero = AbortSignal.timeout;
    const chiesti = [];
    AbortSignal.timeout = (ms) => { chiesti.push(ms); return timeoutVero.call(AbortSignal, 20); };
    const corsa = (promessa) => {
        let timer;
        const appeso = new Promise(r => { timer = setTimeout(() => r('appeso'), 2000); });
        return Promise.race([promessa, appeso]).finally(() => clearTimeout(timer));
    };
    try {
        googleCon({ list: (_k, p) => new Promise((_, rifiuta) => {
            const s = p && p.config && p.config.abortSignal;
            if (s) s.addEventListener('abort', () => rifiuta(s.reason || new Error('aborted')), { once: true });
        }) });
        dice('l\'elenco appeso si interrompe da solo', 'interrotto', await corsa(S.elencaModelliRemoti(CHIAVE).then(() => 'risolto', () => 'interrotto')));
        dice('la verifica della chiave appesa si interrompe da sola', false, await corsa(S.verifyGeminiApiKey(CHIAVE).then(r => r.ok)));
        dice('...con un limite di tempo vero (fra 1 ms e 60 s)', true, chiesti.length === 2 && chiesti.every(ms => ms > 0 && ms <= 60000));
    } finally {
        AbortSignal.timeout = timeoutVero;
    }
}

// =============================================================================
console.log('\n--- il modello salvato non viene piu buttato via ---');
dice('un modello scoperto da Google si tiene', 'gemini-9.9-flash', S.normalizeModelId('gemini-9.9-flash'));
dice('storto -> riserva', S.DEFAULT_GEMINI_MODEL, S.normalizeModelId('../etc/passwd'));
dice('un flash sconosciuto e gratuito-con-limiti, non a pagamento', 'limited', S.getModelTier('gemini-9.9-flash'));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
