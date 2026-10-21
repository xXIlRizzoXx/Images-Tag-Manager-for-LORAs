/* ITALIANO: PROVA DEL CONTROLLO DEI MODELLI CON UNA CHIAVE SCADUTA, REVOCATA O SBAGLIATA
   Con una chiave che Google non accetta piu' (revocata in AI Studio, scaduta), "Controlla ora"
   diceva "Il controllo dei modelli non e' riuscito a parlare con Google": l'utente controllava
   la rete, mentre il problema era la chiave. La regola: se Google rifiuta la chiave, il messaggio
   dice che e' la chiave; la frase "non raggiungibile" resta per la rete che non risponde.
   Si eseguono i testi VERI di controllaModello presi da src/App.tsx, con il servizio vero di
   src/services/geminiService.ts e un Google finto (nessuna rete, nessuna chiave), sia con il
   modello su Automatico sia con il modello bloccato a mano.
   Uso:  node scripts/test-model-check-invalid-key.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MODEL CHECK WITH AN EXPIRED, REVOKED OR WRONG KEY
   With a key Google no longer accepts (revoked in AI Studio, expired), "Check now" said "The
   model check could not reach Google": the user checked the network, while the key was the
   problem. The rule: if Google refuses the key, the message says it is the key; the
   "could not reach" sentence stays for a network that does not answer.
   The REAL text of controllaModello, taken from src/App.tsx, is run with the real service of
   src/services/geminiService.ts and a fake Google (no network, no key), both with the model on
   Automatic and with the model locked by hand.
   Usage:  node scripts/test-model-check-invalid-key.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
console.warn = () => { };

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
                        return {
                            list: async () => g.list(),
                            generateContent: async (p) => g.generate(p),
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};
const carica = async (rel, plugins = []) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, plugins, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/services/geminiService.ts', [finto]);
const t = (await carica('src/constants.ts')).translations.en;

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const i0 = app.indexOf('    const controllaModello = async (');
const fineControlla = /\r?\n    \};\r?\n/g;
fineControlla.lastIndex = Math.max(i0, 0);
const f0 = i0 < 0 ? null : fineControlla.exec(app);
if (!f0) { console.log('NO  non trovato in src/App.tsx: controllaModello'); process.exit(1); }
const testoControlla = app.slice(i0, f0.index + f0[0].length);

const modulo = `
export const render = (env: any, snap: { aiModel: string; aiModelloFissato: boolean }) => {
    const { t, geminiApiKey, geminiApiKeyRef, controlloModelloRef, sceltaManualeRef, ultimaSceltaRef, aiModelloFissatoRef, aiEnabledRef, setControlloModelloInCorso,
            setModelloControllatoIl, setModelliDisponibili, showNotification, setAiModel, setAiModelloFissato,
            elencaModelliRemoti, aggiornaModelloAutomatico, classifyGeminiError, confrontaVersioni, versioneDi, localStorage } = env;
    const aiModel = snap.aiModel;
    const aiModelloFissato = snap.aiModelloFissato;
${testoControlla}
    return { controllaModello };
};`;
const js = (await esbuild.transform(modulo, { loader: 'ts' })).code;
const { render } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

// ITALIANO: gli errori come li costruisce la libreria di Google (ApiError: corpo JSON + stato numerico).
// ENGLISH: the errors as Google's library builds them (ApiError: JSON body + numeric status).
class ApiError extends Error {
    constructor(messaggio, stato) { super(messaggio); this.name = 'ApiError'; this.status = stato; }
}
const apiErrore = (stato, corpo) => new ApiError(JSON.stringify({ error: corpo }), stato);
const ERRORI = {
    scaduta: () => apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key expired. Please renew the API key.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] }),
    sbagliata: () => apiErrore(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] }),
    rete: () => new Error('fetch failed'),
    // ITALIANO: Google ha risposto, ma rifiuta il progetto della chiave (sospeso, API spenta) o chiede
    //           di rallentare / e' sovraccarico. Il numero di progetto contiene "404" di proposito.
    // ENGLISH: Google answered, but refuses the key's project (suspended, API off) or asks to slow
    //          down / is overloaded. The project number holds "404" on purpose.
    sospeso: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED', message: "Permission denied: Consumer 'projects/840412345678' has been suspended.",
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'CONSUMER_SUSPENDED', domain: 'googleapis.com' }] }),
    apiSpenta: () => apiErrore(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Generative Language API has not been used in project 840412345678 before or it is disabled.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', domain: 'googleapis.com' }] }),
    troppe: () => apiErrore(429, { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Resource has been exhausted (e.g. check quota).' }),
    occupato: () => apiErrore(503, { code: 503, status: 'UNAVAILABLE', message: 'The service is currently unavailable.' }),
};

const M = (nome) => ({ name: 'models/' + nome, displayName: nome, supportedActions: ['generateContent'] });
const pagine = (voci) => ({ async *[Symbol.asyncIterator]() { for (const v of voci) yield v; } });

const prova = async ({ fissato, rotto = false, dilloComunque = true, list, generate }) => {
    const notifiche = [];
    const salvato = new Map();
    const stato = { aiModel: 'gemini-3.6-flash', aiModelloFissato: fissato };
    globalThis.__GOOGLE__ = {
        list: list || (async () => pagine([M('gemini-3.7-flash'), M('gemini-3.6-flash')])),
        generate: generate || (async () => ({ text: '["ok"]' })),
    };
    const env = {
        t, geminiApiKey: 'AIza' + 'x'.repeat(35), geminiApiKeyRef: { current: 'AIza' + 'x'.repeat(35) },
        controlloModelloRef: { current: false }, sceltaManualeRef: { current: 0 }, ultimaSceltaRef: { current: '' },
        aiModelloFissatoRef: { current: fissato }, aiEnabledRef: { current: true },
        setControlloModelloInCorso: () => { }, setModelloControllatoIl: () => { }, setModelliDisponibili: () => { },
        showNotification: (m, tipo) => notifiche.push([m, tipo]),
        setAiModel: (v) => { stato.aiModel = v; }, setAiModelloFissato: (v) => { stato.aiModelloFissato = v; },
        elencaModelliRemoti: S.elencaModelliRemoti, aggiornaModelloAutomatico: S.aggiornaModelloAutomatico,
        classifyGeminiError: S.classifyGeminiError, confrontaVersioni: S.confrontaVersioni, versioneDi: S.versioneDi,
        localStorage: { getItem: (k) => (salvato.has(k) ? salvato.get(k) : null), setItem: (k, v) => salvato.set(k, String(v)) },
    };
    await render(env, stato).controllaModello(rotto, dilloComunque, fissato);
    return { notifiche, stato, controllato: salvato.has('aiModelloControllatoIl') };
};

const chiaveRifiutata = () => [[t.aiModelCheckKeyInvalid, 'error']];
const nonRaggiunto = [[t.aiModelCheckFailed, 'error']];

dice('il testo "chiave rifiutata" esiste', 'string', typeof t.aiModelCheckKeyInvalid);

console.log('\n--- Google rifiuta la chiave: il messaggio dice che e\' la chiave ---');
{
    let r = await prova({ fissato: false, list: async () => { throw ERRORI.scaduta(); } });
    dice('Automatico, chiave scaduta: "chiave rifiutata", NON "non raggiungibile"', chiaveRifiutata(), r.notifiche);
    dice('...il modello non cambia e l\'ultimo controllo non si segna', ['gemini-3.6-flash', false], [r.stato.aiModel, r.controllato]);
    r = await prova({ fissato: true, list: async () => { throw ERRORI.scaduta(); } });
    dice('modello bloccato, chiave scaduta: "chiave rifiutata", NON "non raggiungibile"', chiaveRifiutata(), r.notifiche);
    dice('...il modello resta bloccato e l\'ultimo controllo non si segna', ['gemini-3.6-flash', true, false], [r.stato.aiModel, r.stato.aiModelloFissato, r.controllato]);
    r = await prova({ fissato: false, list: async () => { throw ERRORI.sbagliata(); } });
    dice('Automatico, chiave sbagliata: "chiave rifiutata"', chiaveRifiutata(), r.notifiche);
    r = await prova({ fissato: true, rotto: true, list: async () => { throw ERRORI.sbagliata(); } });
    dice('riparazione (modello bloccato e morto), chiave sbagliata: "chiave rifiutata"', chiaveRifiutata(), r.notifiche);
    r = await prova({ fissato: false, dilloComunque: false, list: async () => { throw ERRORI.scaduta(); } });
    dice('controllo silenzioso all\'avvio, chiave scaduta: nessun avviso', [], r.notifiche);
    r = await prova({ fissato: true, dilloComunque: false, list: async () => { throw ERRORI.scaduta(); } });
    dice('controllo silenzioso all\'avvio, modello bloccato, chiave scaduta: nessun avviso', [], r.notifiche);
}

console.log('\n--- Google ha risposto ma non da\' l\'elenco: NON "non raggiungibile" ---');
{
    // ITALIANO: un progetto sospeso, l'API spenta, troppe richieste o Google sovraccarico: Google
    //           ha risposto, quindi "non e' riuscito a parlare con Google" mandava a controllare la
    //           rete. Vale sia su Automatico sia con il modello bloccato (l'elenco si chiede da li').
    // ENGLISH: a suspended project, the API turned off, too many requests or Google overloaded:
    //          Google answered, so "could not reach Google" sent the user to check the network. It
    //          holds both on Automatic and with the model locked (the list is asked from there).
    dice('il testo "progetto rifiutato" esiste', 'string', typeof t.aiModelCheckProjectRefused);
    const progetto = [[t.aiModelCheckProjectRefused, 'error']];
    const occupato = [[t.aiModelCheckBusy, 'info']];
    for (const fissato of [false, true]) {
        const dove = fissato ? 'modello bloccato' : 'Automatico';
        for (const [nome, errore, atteso] of [
            ['progetto sospeso (403)', ERRORI.sospeso, progetto],
            ['API spenta sul progetto (403)', ERRORI.apiSpenta, progetto],
            ['troppe richieste (429)', ERRORI.troppe, occupato],
            ['Google sovraccarico (503)', ERRORI.occupato, occupato],
        ]) {
            const r = await prova({ fissato, list: async () => { throw errore(); } });
            dice(`${dove}, ${nome}: il messaggio giusto`, atteso, r.notifiche);
            dice(`${dove}, ${nome}: il modello non cambia e l'ultimo controllo non si segna`,
                ['gemini-3.6-flash', fissato, false], [r.stato.aiModel, r.stato.aiModelloFissato, r.controllato]);
        }
        const r = await prova({ fissato, dilloComunque: false, list: async () => { throw ERRORI.sospeso(); } });
        dice(`${dove}, controllo silenzioso all'avvio, progetto sospeso: nessun avviso`, [], r.notifiche);
    }
    let r = await prova({ fissato: true, rotto: true, list: async () => { throw ERRORI.sospeso(); } });
    dice('riparazione (modello bloccato e morto), progetto sospeso: "progetto rifiutato"', progetto, r.notifiche);
    // ITALIANO: il servizio da solo: l'esito dice il perche'.
    // ENGLISH: the service alone: the outcome says why.
    const esiti = [];
    for (const errore of [ERRORI.sospeso, ERRORI.apiSpenta, ERRORI.troppe, ERRORI.occupato, ERRORI.rete, ERRORI.scaduta]) {
        globalThis.__GOOGLE__ = { list: async () => { throw errore(); }, generate: async () => ({ text: '["ok"]' }) };
        esiti.push((await S.aggiornaModelloAutomatico('AIza' + 'x'.repeat(35), 'gemini-3.6-flash')).esito);
    }
    dice('aggiornaModelloAutomatico: un esito per ogni motivo',
        ['progettoRifiutato', 'progettoRifiutato', 'occupato', 'occupato', 'nonRaggiungibile', 'chiaveNonValida'], esiti);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    let r = await prova({ fissato: false, list: async () => { throw ERRORI.rete(); } });
    dice('Automatico, rete assente: resta "non raggiungibile"', nonRaggiunto, r.notifiche);
    r = await prova({ fissato: true, list: async () => { throw ERRORI.rete(); } });
    dice('modello bloccato, rete assente: resta "non raggiungibile"', nonRaggiunto, r.notifiche);
    r = await prova({ fissato: false, generate: async () => { throw apiErrore(503, { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded.' }); } });
    dice('Automatico, prova con Google sovraccarico: resta "occupato"', [[t.aiModelCheckBusy, 'info']], r.notifiche);
    r = await prova({ fissato: true });
    dice('modello bloccato, tutto bene: dice che ce n\'e\' uno piu\' nuovo', [[t.aiModelNewerAvailable.replace('{a}', 'gemini-3.7-flash'), 'info']], r.notifiche);
    r = await prova({ fissato: false });
    dice('Automatico, tutto bene: passa al piu\' recente e lo dice',
        [['gemini-3.7-flash', true], [[t.aiModelSwitched.replace('{da}', 'gemini-3.6-flash').replace('{a}', 'gemini-3.7-flash'), 'info']]],
        [[r.stato.aiModel, r.controllato], r.notifiche]);
}

process.exit(esito());
